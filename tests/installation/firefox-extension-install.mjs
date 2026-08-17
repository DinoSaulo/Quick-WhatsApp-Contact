// Firefox counterpart to extension-install.mjs. The toolchain is deliberately different from
// the Chrome test, because the two browsers don't offer comparable automation surfaces for
// extensions:
//
//  - Install/uninstall lifecycle: web-ext (Mozilla's own tool) loads the extension as a
//    temporary add-on over Firefox's Remote Debugging Protocol. Its public run() API exposes
//    reloadAllExtensions()/reloadExtensionBySourceDir()/exit() — there is no standalone
//    "uninstall" call for a temporary add-on the way Chrome's Extensions.uninstall CDP command
//    gives puppeteer. "Uninstall" here is therefore exit(): closing the runner is the only
//    supported way to remove a temporary add-on, so this test asserts Firefox itself is gone
//    afterward, rather than "extension removed, browser and other tabs stay up" the way the
//    Chrome test can. Confirmed directly: extensionRunner.exit() does not actually terminate
//    Firefox while this script's own BiDi connection (`browser`) is still attached — Firefox
//    stayed fully alive and responsive to BiDi commands 75+ seconds after exit() resolved in that
//    order. Disconnecting `browser` *before* calling exit() instead lets Firefox quit within
//    about a second — see the comment at that call site.
//  - Page-level checks (does the popup render, do settings apply, does the options page fit its
//    viewport): web-ext has no page-scripting API at all. This connects puppeteer-core to the
//    *same* Firefox process via WebDriver BiDi (Firefox's `--remote-debugging-port` flag) to
//    drive moz-extension:// pages, alongside web-ext handling the extension lifecycle.
//  - The moz-extension:// origin's UUID is normally random per install and per profile. This
//    script *attempts* to pin it deterministically by pre-seeding the
//    `extensions.webextensions.uuids` profile preference with a UUID it already knows, mapped to
//    this extension's browser_specific_settings.gecko.id (manifest.json) — the same technique
//    Selenium's own Firefox extension-testing guide documents. In practice that pref has been
//    observed to not always take effect against a fresh temporary profile (web-ext's install
//    model), so nothing below *trusts* EXTENSION_UUID — the real origin is always read back from
//    an actual open extension page instead (see driverPage below). The pref is left in place only
//    because it's harmless and may still help in environments where it does take effect.
//  - Neither Puppeteer nor a foreign page can navigate a tab to a moz-extension:// page that isn't
//    web-accessible: page.goto("moz-extension://...") is rejected outright by Firefox's WebDriver
//    BiDi implementation ("Navigation to ... is not allowed in this context"), and even a script
//    already running in the browser (e.g. `window.location.href = "moz-extension://..."` from
//    about:blank) is denied by Firefox's WebExtension isolation ("Location.href setter: Access to
//    '...' from script denied") — the same protection that stops an arbitrary website from loading
//    a non-web-accessible extension page. The one thing that *is* always allowed is the
//    extension's own privileged code opening its own pages, via chrome.tabs.create() — exactly
//    what this extension's background.js already does for its onboarding tab (see
//    openOnboardingTab()). So every moz-extension:// page below is opened by calling
//    chrome.tabs.create() from inside that already-open onboarding tab, not by driving navigation
//    through Puppeteer — see openExtensionTab() below.
//
// Scenarios NOT covered here, and why: context-menu registration (Firefox exposes no
// programmatic way to query an installed context menu item from outside the background context,
// and BiDi has no equivalent of Chrome's service-worker target discovery to reach that context
// directly); reinstall / settings-not-resurrected (every web-ext run() starts a fresh temporary
// profile, so "a fresh install has default settings" is true by construction here, not a
// regression this extension's code could actually break — unlike the Chrome test, which reuses
// one browser profile across install → uninstall → reinstall).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import webExt from "web-ext";
import { consoleStream as webExtConsoleStream } from "web-ext/util/logger";
import { findFirefoxExecutable, getAvailablePort } from "./firefox-environment.mjs";

// web-ext logs Firefox's own launch args and every stdout/stderr line it receives from the
// Firefox child process via log.debug() (node_modules/web-ext/lib/firefox/index.js) — but that
// stream stays at "info" level and drops debug/trace lines unless something calls
// consoleStream.makeVerbose(), which the CLI only does for its own --verbose flag
// (node_modules/web-ext/lib/program.js's enableVerboseMode()). The programmatic webExt.cmd.run()
// API this script uses has no equivalent option, but consoleStream is a plain singleton exported
// from web-ext's own public "./util/logger" subpath — the same instance web-ext's internal
// logger already writes through — so flipping it here reaches the same effect. This is what
// finally gets Firefox's real stdout/stderr into CI output for a run where the crash happens
// before webExt.cmd.run() resolves, i.e. before captureFirefoxProcessOutput() below ever gets a
// chance to attach its own listeners.
webExtConsoleStream.makeVerbose();

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

// Arbitrary, fixed valid UUID — never used for anything but this pinning trick, so any value in
// the correct format works. Keeping it constant (instead of generating one per run) makes a
// failing run's moz-extension:// URLs reproducible when read back from CI logs.
const EXTENSION_UUID = "7e8c9b2e-6f1a-4d3b-9c5e-2a1f8b6d4c7e";

async function waitUntil(predicate, failureMessage, timeout = 10_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  assert.fail(failureMessage);
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

// web-ext already captures the Firefox child process's own stdout/stderr internally (see
// node_modules/web-ext/lib/firefox/index.js) and would log it via its own logger — but only at
// debug/trace level, which stays silent unless web-ext's *CLI* --verbose flag is used; the
// programmatic webExt.cmd.run() API this script calls has no equivalent switch. So this attaches
// a second, independent listener directly to the same child process (extensionRunner is a
// MultiExtensionRunner wrapping one FirefoxDesktopExtensionRunner per browser instance — both are
// plain, public fields on the pinned web-ext@10.6.0 this repo uses, not officially documented
// API, so this is diagnostics-only and never anything this test's pass/fail depends on) purely so
// that if Firefox itself ever fails or crashes, the *actual* Firefox-side error ends up in the CI
// log instead of only the generic ECONNREFUSED our own WebSocket connection attempt sees.
//
// Held at module scope (rather than returned to the caller) because the uncaughtException
// safety net below also needs to read it, from a context that isn't downstream of the call that
// originally captured it — see the comment on that handler for why.
const firefoxDiagnostics = { lines: [], firefoxProcess: null };

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
  return `${processState}\n--- last Firefox stdout/stderr lines ---\n${outputTail}`;
}

// Opens `url` (a moz-extension:// page belonging to this same extension) by asking the extension
// itself to do it — evaluate()-ing chrome.tabs.create() inside `driverPage`, an already-open
// extension-origin page — rather than driving navigation through Puppeteer (see the file-level
// comment above for why the obvious approaches don't work). `onPageFound`, if given, runs against
// the new tab as soon as it's detected, before this function waits for it to finish loading —
// use it to attach listeners (e.g. "pageerror") that need to be in place before/while the page's
// own scripts run, or to set its viewport before layout-dependent content settles.
//
// One wrinkle confirmed by direct inspection (document.location.href, document.readyState,
// document.title, and waitForSelector() all behave correctly on the returned page): a tab opened
// this way is invisible to Puppeteer's own navigation bookkeeping, so page.url() on it stays
// "about:blank" forever even after it has fully loaded — Puppeteer only updates that cache for
// navigations it initiated itself. The tab's actual content and interactivity are unaffected;
// page.url() specifically just isn't a trustworthy signal for it, so nothing here or below reads
// it. Readiness is instead confirmed the same way real page content would be: evaluate()-ing
// document.readyState inside the tab itself.
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

// Unconfirmed for the non-container Ubuntu/bare-runner leg, but left in place as a low-risk
// precaution: recent Ubuntu restricts unprivileged processes from creating user namespaces via
// AppArmor unless the binary has a registered profile — apt/snap-packaged Firefox gets one from
// the OS, a manually downloaded tarball extracted to an arbitrary path (see
// scripts/install-firefox-version.mjs) does not, and Firefox's content-process sandbox needs
// exactly that syscall. Content sandboxing only protects against a compromised *web page's*
// renderer process; it has no bearing on this test's own security-relevant assertions (which run
// in Node, driving the browser, not in page content), so disabling it here is a test-harness-only
// concession — it must never be applied to how end users actually run this extension.
if (process.platform === "linux") {
  process.env.MOZ_DISABLE_CONTENT_SANDBOX = "1";
}

// Confirmed root cause (from CI's own verbose Firefox stderr, via consoleStream.makeVerbose()
// above) of the ECONNREFUSED failures on every container-based Linux job (Fedora/Debian/Rocky/
// Arch — see the "installation-test-firefox" matrix in .github/workflows/ci.yml): those jobs run
// as root by default (no `user:` override on the container image), and Firefox refuses to launch
// as root against a $HOME it doesn't own, aborting with "Running Firefox as root in a regular
// user's session is not supported" before it ever opens the RDP port this script waits on — which
// is exactly what a bare ECONNREFUSED with no Firefox output looks like from the outside. The
// mismatch is GitHub Actions' own doing: it sets $HOME to /github/home for every container job,
// a directory *it* creates and owns as a fixed non-root uid for its own bookkeeping, regardless of
// which user is actually running inside the container. Pointing $HOME at a fresh directory this
// (root) process creates — and therefore owns — satisfies Firefox's check without touching the
// real $HOME any other CI step relies on. Harmless as a no-op everywhere else: on macOS/Windows
// and the non-container Ubuntu leg this process never runs as root, so the condition never fires.
let rootOwnedHome;
if (process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0) {
  rootOwnedHome = mkdtempSync(join(tmpdir(), "quick-whatsapp-contact-firefox-root-home-"));
  process.env.HOME = rootOwnedHome;
}

let extensionRunner;
let browser;

// Safety net for a specific, confirmed web-ext@10.6.0 failure mode: its internal Firefox RDP
// client (used to install the temporary add-on — a different connection from this script's own
// BiDi one below) wraps only its *first* connection attempt in a Node `domain`, so an initial
// ECONNREFUSED becomes an ordinary rejection its own retry loop handles
// (node_modules/web-ext/lib/firefox/remote.js's connectWithMaxRetries). A *later* socket error on
// an already-open RDP connection — e.g. Firefox crashing sometime after connecting — re-emits
// 'error' from a raw socket callback that isn't part of any promise chain this script awaits, and
// EventEmitter throws synchronously when 'error' has no listener. No try/catch here can intercept
// that: it doesn't reject anything this script is holding onto. Confirmed in CI as a bare
// "Emitted 'error' event on FirefoxRDPClient instance" crash with no application stack frames at
// all — this handler is what turns that into a readable diagnostic instead.
//
// Registering this listener also suppresses Node's own default "print stack, exit(1)" behavior
// for uncaught exceptions, so *this* handler now owns exiting the process — it must call
// process.exit() itself or the run would hang.
process.once("uncaughtException", async (error) => {
  console.error(
    "Firefox extension lifecycle smoke test crashed outside this script's own error handling " +
      "(web-ext's internal Firefox RDP connection likely failed or lost its socket after " +
      "connecting).\n" +
      formatFirefoxDiagnostics() +
      `\n--- original error ---\n${error?.stack ?? error}`,
  );

  // Best-effort teardown, capped short: the crash almost certainly means Firefox is already gone
  // or unreachable, so a hung exit() here shouldn't be allowed to keep this process alive in CI.
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
      // web-ext's actual option is noReload, not reload — the previous `reload: false` here was
      // silently ignored (unrecognized key), leaving the file watcher active. Confirmed as the
      // cause of a real CI failure: it fired a spurious reload right after install (mtime noise
      // from the `npm run build` step moments earlier making dist/extension/{assets,icons} look
      // "changed"), tearing down the extension's background context before this script's wait for
      // the onboarding tab could see it, and turning a working install into a timeout.
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

  // background.js's onInstalled listener opens an onboarding tab on a fresh install (see
  // openOnboardingTab() there). That tab is this test's entry point into the extension's own
  // privileged context — see the file-level comment above for why it's needed — and its origin is
  // read back from it directly rather than assumed from EXTENSION_UUID/the pref above.
  // The default 10s waitUntil() budget was observed timing out here specifically on the bare
  // Ubuntu CI runner (not reproducible locally, including with CI=true set) alongside a Firefox-
  // internal "RemoteAgent WARN PollPromise timed out after 100 ms" line — a warning Mozilla's own
  // tooling associates with resource contention/timing pressure, not a specific logic bug. This
  // tab can only open after background.js's onInstalled listener finishes an async chain of its
  // own (a Promise.all of a context-menu rebuild and a chrome.scripting registration sync — see
  // src/background.js) before ever calling openOnboardingTab(), so a loaded CI runner plausibly
  // just needs more room than a local machine does for that whole chain plus Firefox's own BiDi
  // target discovery to complete. Lower confidence than the Chrome-side timing fixes in this same
  // file: those were directly reproduced and root-caused locally, this one could only be
  // diagnosed from the CI log and a documented but non-specific Firefox warning.
  // A 30s timeout wasn't enough on at least one real CI run (installation-test-firefox-pinned, a
  // manually-downloaded Firefox build) — but the accompanying log showed near-total silence for
  // the whole wait, not gradually-progressing activity, which doesn't fit "just needed more time"
  // the way the earlier bare-Ubuntu timeout did. That run's Firefox stderr also showed a
  // "Sandbox: CanCreateUserNamespace() ... EPERM" line, but that specific message is independently
  // documented (Mozilla Bugzilla #1981001, cypress-io/cypress-docker-images#1343) as a benign,
  // always-present warning on namespace-restricted Linux setups — not fatal, and this same run's
  // Firefox demonstrably did keep working past it (connected, installed the extension, disabled
  // reload). So neither "give it more time" nor "fix the sandbox" is backed by real evidence yet.
  // Rather than guess at a third fix blind, this captures what this script itself can see at the
  // moment of failure — every BiDi target and its URL, not just the "page"-typed ones
  // browser.pages() filters to, in case the onboarding tab (or something else revealing) exists
  // under a target type this test wasn't looking at — so the *next* occurrence is diagnosable
  // instead of another guess.
  // A real CI failure showed only the BiDi-targets snapshot at the *end* of this wait (two
  // "about:blank" pages, no moz-extension:// page) — informative about the final state, but silent
  // on whether anything happened in between. The existing comment above already had to guess
  // between "just needs more time" (gradual progress) and something more stuck (near-total
  // silence) with no way to actually tell them apart from a single end-of-wait snapshot. Logging a
  // throttled snapshot during the wait itself (not just on failure) answers that directly for
  // whichever hypothesis the next occurrence supports, instead of another guess.
  let lastSnapshotAt = 0;
  let driverPage;
  try {
    await waitUntil(
      async () => {
        const pages = await browser.pages();
        driverPage = pages.find((candidate) => candidate.url().startsWith("moz-extension://"));

        if (!driverPage && Date.now() - lastSnapshotAt >= 5_000) {
          lastSnapshotAt = Date.now();
          console.log(
            `⏳ Still waiting for the onboarding tab (${pages.length} page(s) open: ` +
              `${pages.map((page) => page.url()).join(", ") || "(none)"})...`,
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
  // setViewport() on a tab opened out-of-band (see openExtensionTab's comment) has to wait until
  // after the tab has actually finished loading — called any earlier, Firefox's BiDi
  // implementation throws ("can't access property clientHeight, browser is null") because the
  // browsing context's underlying browser-window reference isn't attached yet. CSS layout still
  // recomputes correctly against the new viewport regardless of when it's set relative to load,
  // so this doesn't affect the layout assertions below.
  await popup.setViewport({ width: 360, height: 600, deviceScaleFactor: 1 });
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

  // Unlike Chrome (where chrome.runtime.id and the chrome-extension:// host are the same value),
  // Firefox's chrome.runtime.id/browser.runtime.id returns the manifest-declared, stable
  // browser_specific_settings.gecko.id — not the moz-extension:// origin's UUID, which is random
  // per profile and only used for resource URLs. extensionId (the UUID, asserted implicitly by
  // every moz-extension://${extensionId}/... page having loaded above) and geckoId (this
  // extension's actual identity) are two different, both-correct values.
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
  await optionsPage.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
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
      language: document.querySelector("#language")?.value,
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

  // "Uninstall": popup and optionsPage are deliberately left open (mirrors the Chrome test's
  // second, pages-still-open uninstall cycle) — exit() is the only teardown web-ext's temporary
  // add-on model supports, so it's exercised the harder way, not with tabs pre-closed.
  //
  // This script's own `browser` connection has to be disconnected *before* calling
  // extensionRunner.exit(), not after: a lingering BiDi client keeps Firefox from actually
  // quitting even once exit() asks it to (confirmed directly — leaving `browser` connected across
  // exit() left Firefox fully alive and still answering BiDi commands 75+ seconds later; calling
  // browser.disconnect() first instead makes it quit within about a second). That also means
  // browser.connected can't be used to confirm the uninstall — it's this script's own flag, not a
  // signal about the remote process, and disconnecting it first makes it false immediately by
  // construction either way. A fresh connection attempt to the same endpoint failing is what
  // actually proves the process is gone.
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
  // Without this, every ordinary failure in the try block above — not just a genuine RDP crash —
  // fell through this file's top-level try/finally (previously no catch at all) as an unhandled
  // top-level module rejection, which Node routes through the same reporting path as
  // uncaughtException (confirmed empirically earlier in this file's history). That made the
  // uncaughtException handler below's "crashed outside this script's own error handling" preamble
  // print for completely ordinary, well-formed errors (e.g. the onboarding-tab wait's own timeout,
  // which already builds an informative message with a BiDi targets dump) — misleading, since that
  // text specifically describes the *other* failure mode that handler exists for (a raw RDP socket
  // error with no application stack frames at all). This catch gives ordinary errors an accurate,
  // Chrome-test-equivalent path instead: log with correct framing, then rethrow so the process
  // still exits non-zero and `finally` below still runs.
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
