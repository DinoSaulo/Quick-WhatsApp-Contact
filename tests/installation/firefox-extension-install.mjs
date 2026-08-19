// Firefox counterpart to extension-install.mjs: web-ext drives install/exit (no standalone "uninstall"), puppeteer-core BiDi drives page checks on the same process, and moz-extension:// pages open via chrome.tabs.create() (see openExtensionTab()), not direct navigation.
// Not covered: context-menu registration (no BiDi equivalent) and reinstall/settings-not-resurrected (every web-ext run() is already a fresh profile).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import webExt from "web-ext";
import { consoleStream as webExtConsoleStream } from "web-ext/util/logger";
import { findFirefoxExecutable, getAvailablePort } from "./firefox-environment.mjs";

// web-ext's own logger drops Firefox's stdout/stderr at "info" level unless something calls
// consoleStream.makeVerbose() — the CLI does that for --verbose, but webExt.cmd.run() has no equivalent, so this flips the same public singleton directly.
webExtConsoleStream.makeVerbose();

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

// Arbitrary, fixed valid UUID for the pinning trick below — kept constant (not generated per run)
// so a failing run's moz-extension:// URLs stay reproducible from CI logs.
const EXTENSION_UUID = "7e8c9b2e-6f1a-4d3b-9c5e-2a1f8b6d4c7e";

async function waitUntil(predicate, failureMessage, timeout = 10_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  assert.fail(failureMessage);
}

// puppeteer-core 25's BiDi setViewport() always fires setScreenOrientationOverride alongside size,
// a command Firefox 140 ESR doesn't support yet (confirmed CI failure) — tolerated narrowly here since neither call site sets isLandscape; anything else still re-throws.
async function setViewportTolerantly(page, viewport) {
  try {
    await page.setViewport(viewport);
  } catch (error) {
    if (!String(error).includes("emulation.setScreenOrientationOverride")) {
      throw error;
    }
    console.warn(
      `⚠️  setViewport()'s screen-orientation half failed (this Firefox build's BiDi implementation ` +
        `doesn't support emulation.setScreenOrientationOverride yet) — continuing, since this test ` +
        `never sets isLandscape and only needs width/height/deviceScaleFactor: ${error.message}`,
    );
  }
}

async function connectWithRetries(browserWSEndpoint, { attempts = 30, delay = 300 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await puppeteer.connect({ browserWSEndpoint, protocol: "webDriverBiDi" });
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delay));
    }
  }
  return undefined;
}

// Attaches a second listener directly to Firefox's child process (undocumented web-ext internals,
// diagnostics-only) so a real crash reaches CI logs; held at module scope for the uncaughtException handler below to read too.
const firefoxDiagnostics = { lines: [], firefoxProcess: null };

// Workspace-relative, not os.tmpdir(): CI needs a known path to hand actions/upload-artifact
// (ci.yml's "Anexar diagnosticos do Firefox" step) — same idea as chromeLogDir in extension-install.mjs.
const diagnosticsRoot = resolve(projectRoot, "ci-diagnostics");
const firefoxLogFile = join(diagnosticsRoot, "firefox.log");

function captureFirefoxProcessOutput(extensionRunner) {
  const firefoxProcess = extensionRunner?.extensionRunners?.[0]?.runningInfo?.firefox;
  firefoxDiagnostics.firefoxProcess = firefoxProcess ?? null;

  if (!firefoxProcess) return;

  firefoxProcess.stdout?.on("data", (chunk) => firefoxDiagnostics.lines.push(`[firefox stdout] ${chunk}`));
  firefoxProcess.stderr?.on("data", (chunk) => firefoxDiagnostics.lines.push(`[firefox stderr] ${chunk}`));
}

function formatFirefoxDiagnostics() {
  const { lines, firefoxProcess } = firefoxDiagnostics;
  const processState = firefoxProcess
    ? `Firefox child process: exitCode=${firefoxProcess.exitCode} signalCode=${firefoxProcess.signalCode} killed=${firefoxProcess.killed}`
    : "Firefox child process handle unavailable (web-ext's internal shape may have changed, or it crashed before web-ext exposed it).";
  const outputTail = lines.slice(-60).join("") || "(nothing captured)";
  // Best-effort, and deliberately the FULL capture (not the last-60 tail above) — this is the
  // copy meant for actions/upload-artifact. Must never throw and mask the real error.
  try {
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(firefoxLogFile, `${processState}\n--- all captured Firefox stdout/stderr lines ---\n${lines.join("") || "(nothing captured)"}`);
  } catch {
    // Ignored — see comment above.
  }
  return `${processState}\n--- last Firefox stdout/stderr lines ---\n${outputTail}`;
}

// Opens `url` via chrome.tabs.create() evaluated inside `driverPage`, not Puppeteer navigation (file-level comment). `onPageFound` runs before load-wait, for listeners that must attach early.
// The resulting tab is invisible to Puppeteer's navigation cache — page.url() stays "about:blank" forever — so readiness uses document.readyState instead.
async function openExtensionTab(driverPage, browser, url, { onPageFound } = {}) {
  const pagesBefore = await browser.pages();

  await driverPage.evaluate(async (targetUrl) => {
    await chrome.tabs.create({ url: targetUrl });
  }, url);

  let newPage;
  await waitUntil(async () => {
    const pagesNow = await browser.pages();
    newPage = pagesNow.find((candidate) => !pagesBefore.includes(candidate));
    return Boolean(newPage);
  }, `Timed out waiting for a new tab to open for ${url}.`);

  await onPageFound?.(newPage);

  await waitUntil(
    () => newPage.evaluate(() => document.readyState === "complete"),
    `Timed out waiting for ${url} to finish loading.`,
  );

  return newPage;
}

assert.ok(
  existsSync(manifestPath),
  `Build da extensão não encontrado em ${manifestPath}. Execute "npm run build" antes do smoke test.`,
);

const expectedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const geckoId = expectedManifest.browser_specific_settings?.gecko?.id;

assert.ok(geckoId, "manifest.json não declara browser_specific_settings.gecko.id.");

const executablePath = findFirefoxExecutable();

assert.ok(
  executablePath,
  "Firefox não encontrado. Defina FIREFOX_PATH ou PUPPETEER_EXECUTABLE_PATH.",
);

const biDiPort = await getAvailablePort();

// Low-risk precaution: a manually-downloaded Firefox tarball has no AppArmor profile registered,
// which recent Ubuntu requires for the content sandbox's user-namespace syscall. Test-harness-only; never apply this to end users.
if (process.platform === "linux") {
  process.env.MOZ_DISABLE_CONTENT_SANDBOX = "1";
}

// Confirmed root cause of ECONNREFUSED on every container Linux job: those run as root, and Firefox
// refuses to launch against a $HOME it doesn't own (GitHub Actions sets $HOME to a dir it owns, not root). Pointing $HOME at a fresh root-owned dir fixes it; harmless no-op elsewhere.
let rootOwnedHome;
if (process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0) {
  rootOwnedHome = mkdtempSync(join(tmpdir(), "quick-whatsapp-contact-firefox-root-home-"));
  process.env.HOME = rootOwnedHome;
}

let extensionRunner;
let browser;

// Safety net for a confirmed web-ext@10.6.0 bug: a later RDP socket error re-emits 'error' outside
// any promise chain as a bare crash with no stack. Also suppresses Node's default exit — this handler now owns calling process.exit() itself.
process.once("uncaughtException", async (error) => {
  console.error(
    "Firefox extension lifecycle smoke test crashed outside this script's own error handling " +
      "(web-ext's internal Firefox RDP connection likely failed or lost its socket after " +
      "connecting).\n" +
      formatFirefoxDiagnostics() +
      `\n--- original error ---\n${error?.stack ?? error}`,
  );

  // Best-effort teardown, capped short — a hung exit() shouldn't keep this process alive in CI.
  await Promise.race([
    extensionRunner?.exit().catch(() => {}),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  process.exit(1);
});

try {
  extensionRunner = await webExt.cmd.run(
    {
      sourceDir: extensionPath,
      firefox: executablePath,
      pref: {
        "extensions.webextensions.uuids": JSON.stringify({ [geckoId]: EXTENSION_UUID }),
      },
      args: ["--headless", `--remote-debugging-port=${biDiPort}`],
      // web-ext's actual option is noReload, not reload — `reload: false` was silently ignored,
      // leaving the file watcher active and causing a real CI failure (spurious reload from build mtime noise, tearing down the background context mid-wait).
      noReload: true,
    },
    { shouldExitProgram: false },
  );

  captureFirefoxProcessOutput(extensionRunner);

  try {
    browser = await connectWithRetries(`ws://127.0.0.1:${biDiPort}/session`);
  } catch (error) {
    throw new Error(
      `Could not connect to Firefox's WebDriver BiDi endpoint at ws://127.0.0.1:${biDiPort}/session ` +
        `after retrying. ${formatFirefoxDiagnostics()}` +
        `\n--- original connection error ---\n${error?.stack ?? error}`,
    );
  }

  // Waits for background.js's onInstalled onboarding tab, this test's entry point into the extension's privileged context (file-level comment); 30s budget covers slow-CI timing.
  // Root cause of the stuck case: candidate.url() is Puppeteer's navigation cache, not a live read for a chrome.tabs.create()'d tab — same bug openExtensionTab() works around; evaluate() fixes discovery too.
  let lastSnapshotAt = 0;
  let driverPage;
  try {
    await waitUntil(
      async () => {
        const pages = await browser.pages();

        for (const candidate of pages) {
          try {
            const liveHref = await candidate.evaluate(() => document.location.href);
            if (liveHref.startsWith("moz-extension://")) {
              driverPage = candidate;
              break;
            }
          } catch {
            // Not evaluable yet (not fully attached, mid-navigation, or similar) — skip it and
            // keep checking the rest; a real match on a later poll will still be found.
          }
        }

        if (!driverPage && Date.now() - lastSnapshotAt >= 5_000) {
          lastSnapshotAt = Date.now();
          const snapshot = await Promise.all(
            pages.map(async (page) => {
              const cached = page.url();
              let live;
              try {
                live = await page.evaluate(() => document.location.href);
              } catch (evalError) {
                live = `(evaluate failed: ${evalError?.message ?? evalError})`;
              }
              return cached === live ? cached : `${cached} (live: ${live})`;
            }),
          );
          console.log(
            `⏳ Still waiting for the onboarding tab (${pages.length} page(s) open: ` +
              `${snapshot.join(", ") || "(none)"})...`,
          );
        }

        return Boolean(driverPage);
      },
      "Timed out waiting for the extension's onboarding tab to open after install.",
      30_000,
    );
  } catch (error) {
    const targets = browser.targets().map((target) => {
      try {
        return `${target.type()} ${target.url()}`;
      } catch (targetError) {
        return `(failed to read target: ${targetError?.message ?? targetError})`;
      }
    });
    throw new Error(
      `${error.message}\n--- all BiDi targets at time of failure ---\n${targets.join("\n") || "(none)"}`,
    );
  }

  const extensionId = new URL(driverPage.url()).host;
  const extensionOrigin = `moz-extension://${extensionId}`;
  const popupUrl = `${extensionOrigin}/${expectedManifest.action.default_popup}`;

  const pageErrors = [];
  const popup = await openExtensionTab(driverPage, browser, popupUrl, {
    onPageFound: (page) => page.on("pageerror", (error) => pageErrors.push(String(error))),
  });
  // setViewport() on a tab opened out-of-band must wait until it's finished loading — called
  // earlier, Firefox's BiDi throws ("browser is null"); CSS layout still recomputes fine regardless.
  await setViewportTolerantly(popup, { width: 360, height: 600, deviceScaleFactor: 1 });
  await popup.waitForSelector("whatsapp-message-popup #country-trigger", { timeout: 10_000 });
  await popup.waitForSelector("#country-trigger .country-picker__flag-img", { timeout: 10_000 });

  const installedState = await popup.evaluate(() => {
    const flag = document.querySelector("#country-trigger .country-picker__flag-img");
    const panel = document.querySelector(".panel");
    const panelBounds = panel?.getBoundingClientRect();

    return {
      runtimeId: chrome.runtime.id,
      manifest: chrome.runtime.getManifest(),
      title: document.title,
      country: document.querySelector("#country-trigger")?.textContent?.trim(),
      flagComplete: flag?.complete,
      flagNaturalWidth: flag?.naturalWidth,
      layout: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        panelRight: panelBounds?.right,
        panelBottom: panelBounds?.bottom,
      },
    };
  });

  // Unlike Chrome, Firefox's chrome.runtime.id returns the manifest's stable gecko.id, not the
  // moz-extension:// origin's random per-profile UUID — extensionId and geckoId are both correct, just different values.
  assert.equal(installedState.runtimeId, geckoId);
  assert.equal(installedState.manifest.name, expectedManifest.name);
  assert.equal(installedState.manifest.version, expectedManifest.version);
  assert.ok(installedState.title, "O popup não possui título.");
  assert.ok(installedState.country, "O seletor de país não foi renderizado.");
  assert.equal(installedState.flagComplete, true);
  assert.ok(installedState.flagNaturalWidth > 0, "A bandeira local não carregou.");
  assert.ok(
    installedState.layout.documentWidth <= installedState.layout.viewportWidth &&
      installedState.layout.panelRight <= installedState.layout.viewportWidth,
    "O popup possui overflow horizontal.",
  );
  assert.ok(
    installedState.layout.documentHeight <= installedState.layout.viewportHeight &&
      installedState.layout.panelBottom <= installedState.layout.viewportHeight,
    "O conteúdo do popup não cabe integralmente na altura compacta de 600px.",
  );
  assert.deepEqual(pageErrors, [], `Erros no popup: ${pageErrors.join("; ")}`);

  await popup.evaluate(async () => {
    await chrome.storage.sync.set({
      "quick-whatsapp-contact.auto-highlight-enabled": false,
      "quick-whatsapp-contact.dark-mode-enabled": true,
      "quick-whatsapp-contact.language": "pt-BR",
      "quick-whatsapp-contact.default-country": "PT",
    });
  });

  const optionsPage = await openExtensionTab(
    driverPage,
    browser,
    `${extensionOrigin}/${expectedManifest.options_ui.page}`,
  );
  // See the comment on the equivalent popup.setViewport() call above — must run after load.
  await setViewportTolerantly(optionsPage, { width: 1200, height: 800, deviceScaleFactor: 1 });
  await optionsPage.waitForSelector("extension-settings-page #country-trigger", {
    timeout: 10_000,
  });

  const optionsState = await optionsPage.evaluate(() => {
    const shell = document.querySelector(".options-shell");
    const bounds = shell?.getBoundingClientRect();
    const brand = document.querySelector(".options-brand img");

    return {
      shellWidth: bounds?.width,
      autoHighlight: document.querySelector("#auto-highlight")?.checked,
      darkMode: document.querySelector("#dark-mode")?.checked,
      language: document.querySelector("#language-hidden")?.value,
      defaultCountry: document.querySelector("#default-country-hidden")?.value,
      theme: document.documentElement.dataset.theme,
      brandComplete: brand?.complete,
      brandNaturalWidth: brand?.naturalWidth,
      hasVerticalOverflow:
        document.documentElement.scrollHeight > window.innerHeight ||
        document.body.scrollHeight > window.innerHeight,
    };
  });

  assert.ok(optionsState.shellWidth <= 720, "A página de opções excedeu 720px.");
  assert.equal(optionsState.autoHighlight, false);
  assert.equal(optionsState.darkMode, true);
  assert.equal(optionsState.language, "pt-BR");
  assert.equal(optionsState.defaultCountry, "PT");
  assert.equal(optionsState.theme, "dark");
  assert.equal(optionsState.brandComplete, true);
  assert.ok(optionsState.brandNaturalWidth > 0, "A marca da página de opções não carregou.");
  assert.equal(optionsState.hasVerticalOverflow, false, "A página de opções possui rolagem vertical.");

  // "Uninstall": popup/optionsPage deliberately left open (mirrors the Chrome test) — exit() is
  // web-ext's only teardown. `browser` must disconnect BEFORE exit() (confirmed: left connected, Firefox stayed alive 75+s) — a fresh connection failing is what proves it's gone.
  await browser.disconnect();
  await extensionRunner.exit();

  await waitUntil(async () => {
    try {
      const stillRunning = await puppeteer.connect({
        browserWSEndpoint: `ws://127.0.0.1:${biDiPort}/session`,
        protocol: "webDriverBiDi",
      });
      await stillRunning.disconnect();
      return false;
    } catch {
      return true;
    }
  }, "O Firefox continuou respondendo ao WebDriver BiDi após exit() do runner (desinstalação).");

  console.log("Firefox extension lifecycle smoke test passed.");
  console.log(`Extension origin: ${extensionOrigin}`);
  console.log("Install validation: passed");
  console.log("Uninstall (runner exit) validation: passed");
} catch (error) {
  // Without this catch, an ordinary failure here (not just a genuine RDP crash) fell through to
  // uncaughtException below, misleadingly printing its "crashed outside this script's own error handling" preamble. This gives ordinary errors accurate framing, then rethrows.
  console.error(
    "❌ Firefox extension lifecycle smoke test failed.\n" +
      formatFirefoxDiagnostics() +
      `\n--- original error ---\n${error?.stack ?? error}`,
  );
  throw error;
} finally {
  if (browser?.connected) {
    await browser.close().catch(() => {});
  }
  await extensionRunner?.exit().catch(() => {});
  if (rootOwnedHome) {
    rmSync(rootOwnedHome, { recursive: true, force: true });
  }
}
