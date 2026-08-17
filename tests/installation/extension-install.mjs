import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import {
  createBrowserArgs,
  findBrowserExecutable,
} from "./browser-environment.mjs";
import {
  launchBrowserWithStabilityFlags,
  safeBrowserClose,
  safePageClose,
  safeEvaluate,
  safeGoto,
  safeWaitForSelector,
  waitUntilWithDiagnostics,
  captureBrowserDiagnostics,
} from "./puppeteer-helpers.mjs";
import { ONBOARDING_PAGE_PATH } from "../../src/utils/tutorial.js";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

async function waitUntil(predicate, failureMessage, timeout = 10_000) {
  try {
    await waitUntilWithDiagnostics(predicate, failureMessage, { timeout });
  } catch (error) {
    assert.fail(error.message);
  }
}

assert.ok(
  existsSync(manifestPath),
  `Build da extensão não encontrado em ${manifestPath}. Execute "npm run build" antes do smoke test.`,
);

const expectedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const executablePath = findBrowserExecutable();

assert.ok(
  executablePath,
  "Chrome/Chromium não encontrado. Defina CHROME_PATH, CHROMIUM_PATH ou PUPPETEER_EXECUTABLE_PATH.",
);

// Unlike firefox-extension-install.mjs (which has captureFirefoxProcessOutput() +
// consoleStream.makeVerbose() for exactly this purpose), this file had no equivalent — every
// Chrome-side diagnosis this test has ever needed came only from Puppeteer's own error messages,
// never from Chrome's actual stdout/stderr. That gap mattered concretely: a run failing with
// "Session closed. Most likely the page has been closed" right after browser.newPage() gives no
// way to tell *why* the tab/renderer went away (crash, OOM, sandbox denial, something else)
// without Chrome's own output.
//
// File-based, not stream-based, and deliberately so: browser.process() (Puppeteer's standard way
// to reach the underlying child process — confirmed via
// node_modules/puppeteer-core/lib/esm/puppeteer/cdp/Browser.js's process() method) only becomes
// available once puppeteer.launch() has already fully resolved. Tried piping Chrome's own
// stdout/stderr (via the dumpio launch option) into a buffer first, and confirmed directly that
// this loses a structural race every time: dumpio wires its own internal
// .pipe(process.stdout/stderr) synchronously inside launch() itself, and by the time our own code
// gets control back to attach a listener, Chrome has typically already emitted (and had drained)
// most or all of its startup output — Node readable streams don't replay already-consumed data to
// a newly attached listener. A log *file* has no such requirement: Chrome writes it continuously
// regardless of whether anything is "listening", so reading it after the fact — however late —
// still sees everything written so far.
const chromeLogDir = mkdtempSync(join(tmpdir(), "quick-whatsapp-contact-chrome-log-"));
const chromeLogFile = join(chromeLogDir, "chrome.log");
let chromeProcess;
// A bare synchronous read of chromeProcess.exitCode/signalCode races Node's own event loop: if
// Chrome's main process just died, the child process 'exit' event that actually updates those
// properties may not have been delivered yet at the moment formatChromeDiagnostics() happens to
// run — which is exactly why two real CI failures in a row showed exitCode=null signalCode=null
// killed=false right alongside a browser-level "Protocol error: Connection closed", a symptom that
// looks a lot like Chrome's process actually going away. Listening for the real events instead of
// guessing from a snapshot removes that ambiguity for whichever failure (if any) shows up next.
let chromeExitInfo = null;
let browserDisconnectedAt = null;

function captureChromeProcessOutput(launchedBrowser) {
  chromeProcess = launchedBrowser.process() ?? null;
  chromeProcess?.once("exit", (code, signal) => {
    chromeExitInfo = { code, signal, at: new Date().toISOString() };
  });
  launchedBrowser.once("disconnected", () => {
    browserDisconnectedAt = new Date().toISOString();
  });
}

async function formatChromeDiagnostics() {
  // Give Node's event loop a moment to actually deliver a same-tick 'exit'/'disconnected' event
  // before reading state below — see the comment on chromeExitInfo above for why a bare
  // synchronous read right after a rejected promise isn't trustworthy on its own.
  await new Promise((resolve) => setTimeout(resolve, 500));

  const processState = chromeProcess
    ? `Chrome child process: exitCode=${chromeProcess.exitCode} signalCode=${chromeProcess.signalCode} killed=${chromeProcess.killed}` +
      (chromeExitInfo
        ? ` (exit event observed at ${chromeExitInfo.at}: code=${chromeExitInfo.code} signal=${chromeExitInfo.signal})`
        : " (no exit event observed — process object itself is still alive as far as Node can tell)")
    : "Chrome child process handle unavailable (browser.process() returned null — connected via .connect() rather than .launch()?).";
  const disconnectState = browserDisconnectedAt
    ? `Puppeteer's own 'disconnected' event fired at ${browserDisconnectedAt}.`
    : "Puppeteer's own 'disconnected' event never fired — the CDP connection failure wasn't reported as a full disconnect.";
  let outputTail = "(nothing captured)";
  if (existsSync(chromeLogFile)) {
    const lines = readFileSync(chromeLogFile, "utf8").split("\n");
    outputTail = lines.slice(-60).join("\n") || outputTail;
  }
  return `${processState}\n${disconnectState}\n--- last Chrome log lines (${chromeLogFile}) ---\n${outputTail}`;
}

// Confirmed the SIGSEGV/missing-dependencies bug above; this exists for the failure mode that
// showed up immediately after fixing it — a newly-created tab's renderer closing right after
// browser.newPage(), with the top-level Chrome process still alive (exitCode/signalCode both
// null) and nothing informative in chrome.log around it. A silent renderer death with no
// Chrome-internal log line points outward more than inward: the most common cause of exactly this
// shape is the Linux kernel's OOM killer sending a bare SIGKILL, which Chrome has no chance to log
// anything about (it's killed, not crashing through its own code) but which the kernel itself
// records. The dmesg scan also now catches segfault traces, not just OOM — added after a real
// SIGSEGV recurred on installation-test-pinned (see ci.yml's "Instalar Chrome estavel" step) even
// after that exact crash was already fixed there once: the original regex here only matched
// OOM-killer wording, so a genuine segfault line from the kernel (Linux logs these by default,
// e.g. "chrome[1234]: segfault at 0 ip ... in libfoo.so[...]") would have been silently filtered
// out and never seen, even though it was almost certainly sitting right there in dmesg's output.
function captureSystemDiagnostics() {
  if (process.platform !== "linux") {
    return "(system memory/crash diagnostics only implemented for Linux, this test's actual CI target)";
  }

  const sections = [];
  try {
    sections.push(`--- free -h ---\n${execFileSync("free", ["-h"], { encoding: "utf8", timeout: 5_000 })}`);
  } catch (error) {
    sections.push(`--- free -h ---\n(failed: ${error.message})`);
  }
  try {
    // dmesg is restricted to root on most modern kernels (kernel.dmesg_restrict=1); GitHub
    // Actions grants the runner user passwordless sudo, already relied on elsewhere in this repo's
    // workflow for apt-get, so this uses the same trust boundary rather than a new one.
    const dmesg = execFileSync("sudo", ["dmesg", "--ctime"], { encoding: "utf8", timeout: 5_000 });
    const crashLines = dmesg
      .split("\n")
      .filter((line) => /oom|out of memory|killed process|segfault|general protection|traps:/i.test(line));
    sections.push(
      crashLines.length
        ? `--- dmesg lines matching OOM/segfault/crash (${crashLines.length} total) ---\n${crashLines.slice(-20).join("\n")}`
        : "--- dmesg: no OOM/segfault/crash lines found ---",
    );
  } catch (error) {
    sections.push(`--- dmesg ---\n(failed: ${error.message})`);
  }
  return sections.join("\n");
}

// SIGSEGV in a manually-downloaded Chrome-for-Testing binary was already root-caused once to
// missing shared library dependencies (see ci.yml's "Instalar Chrome estavel" step, which installs
// google-chrome-stable purely for its .deb dependency chain as a fix). Its recurrence — after two
// clean runs with that fix live — means either that CI step didn't actually run/succeed this
// time, or a *different* library is missing than whatever was fixed before. ldd answers that
// directly for the exact binary this run is about to launch, and does so unconditionally rather
// than only when a crash happens to occur: unresolved dynamic dependencies show up as "=> not
// found" lines regardless of whether execution ever gets far enough to segfault.
function captureLinkerDiagnostics(execPath) {
  if (process.platform !== "linux" || !execPath) {
    return "(dynamic-linking diagnostics only implemented for Linux)";
  }
  try {
    const ldd = execFileSync("ldd", [execPath], { encoding: "utf8", timeout: 5_000 });
    const missing = ldd.split("\n").filter((line) => line.includes("not found"));
    return missing.length
      ? `--- ldd ${execPath}: missing shared libraries ---\n${missing.join("\n")}`
      : `--- ldd ${execPath}: all shared libraries resolved ---`;
  } catch (error) {
    return `--- ldd ${execPath} ---\n(failed: ${error.message})`;
  }
}

let browser;

try {
  // GitHub Actions job containers run as root. Chromium refuses to start as
  // root unless its process sandbox is disabled; the outer job container
  // remains the isolation boundary in this CI-only scenario.
  // --enable-logging --log-file=<path> exists to make formatChromeDiagnostics() above actually
  // have something to show (see the comment on chromeLogFile for why a file, not dumpio/streams).
  // --v=1 (Chrome's verbose logging) was tested and rejected: ~594KB in 1.5s just for extension
  // install, far too costly to write on every routine run. Plain --enable-logging (default
  // verbosity — WARNING/ERROR/FATAL) is quiet in the common case (a couple of startup lines) but
  // present when something actually goes wrong, which is exactly the tradeoff wanted here.
  const browserArgs = [
    ...createBrowserArgs(),
    "--enable-logging",
    `--log-file=${chromeLogFile}`,
  ];

  // pipe: true previously wired the CDP connection through Chrome's stdio pipes instead of
  // Puppeteer's default WebSocket transport. Nothing in this file's history explains why — it
  // predates every fix in this file's git log — and pipe transport has a known, if old, class of
  // bugs where an unhandled stream error drops the *entire* browser-level connection, not just a
  // single page's session (puppeteer/puppeteer#4374, #6258). That matches a real CI failure here
  // exactly: a "Protocol error: Connection closed" thrown from Connection.send() itself (the
  // browser-level CDP connection), immediately escalating what had been isolated per-page
  // "Session closed" errors. Left on the default WebSocket transport instead — far more
  // battle-tested, and nothing about this test (extension install/uninstall, page navigation,
  // evaluate calls) depends on pipe-specific behavior.
  const launchOptions = launchBrowserWithStabilityFlags({
    executablePath,
    headless: true,
    enableExtensions: true,
    args: browserArgs,
  });

  console.log("🚀 Launching browser with stability flags...");
  browser = await puppeteer.launch(launchOptions);
  captureChromeProcessOutput(browser);

  console.log("📦 Installing extension...");
  const extensionId = await browser.installExtension(extensionPath);
  const extensionOrigin = `chrome-extension://${extensionId}`;

  assert.match(extensionId, /^[a-p]{32}$/);
  console.log(`✅ Extension installed: ${extensionId}`);

  // Confirms the background context actually started, without ever calling .worker() on it — see
  // the context-menu check below for why that distinction matters here.
  console.log("⏳ Waiting for service worker target...");
  await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith(extensionOrigin) &&
      target.url().endsWith("/src/background.js"),
    { timeout: 30_000 },
  );

  // background.js's onInstalled listener (reason: "install") calls chrome.tabs.create() to open
  // an onboarding tab — see openOnboardingTab() in src/background.js — independent of and
  // concurrent with anything this script does. firefox-extension-install.mjs already has to
  // account for this (see its own onboarding-tab wait); this file never did, because until now a
  // different, more prominent bug always failed the run first (the service-worker dead-mode bug,
  // then a missing-shared-library SIGSEGV — see git history). With those fixed, this looked like
  // the next layer: browser.newPage() below for the popup was racing that same automatic tab
  // creation, surfacing as "Session closed. Most likely the page has been closed" on
  // Emulation.setTouchEmulationEnabled right after newPage(). Waiting for the onboarding tab to
  // fully exist before creating any other page is still correct and still here.
  //
  // Explicitly closing that tab immediately afterward (this block used to call
  // safePageClose(await onboardingTarget.page()) right here) is NOT still here — removed after two
  // separate CI runs died with a browser-level "Protocol error: Connection closed" (not a
  // page-level session error — the *entire* CDP connection, thrown from Connection.send() itself)
  // at exactly this point, both times only after that close call was added. Chrome starts with
  // exactly one blank "page" target already open before anything in this script runs (confirmed
  // via captureBrowserDiagnostics()'s own output on a clean local launch: totalPages: 1, about:
  // blank) — if the extension's chrome.tabs.create() for the onboarding tab reuses that same
  // initial target rather than opening a genuinely separate one, then closing "the onboarding tab"
  // was closing the only page Chrome had, which is a plausible trigger for a follow-on
  // browser-level failure. Not proven by direct reproduction, but it lines up: the symptom only
  // ever appeared after this specific call was introduced, and removing it is a strict reduction
  // in what this script does to the browser, not a new mechanism to trust. The onboarding tab is
  // left open here; browser.uninstallExtension() below already closes every extension-origin page
  // automatically on uninstall (relied on already for the popup/options pages further down), so
  // nothing further needs to close it explicitly.
  console.log("⏳ Waiting for onboarding tab (opened automatically on install)...");
  const onboardingUrl = `${extensionOrigin}/${ONBOARDING_PAGE_PATH}`;
  await browser.waitForTarget(
    (target) => target.type() === "page" && target.url() === onboardingUrl,
    { timeout: 15_000 },
  );

  const popupUrl = `${extensionOrigin}/${expectedManifest.action.default_popup}`;

  console.log("📄 Opening popup page...");
  const popup = await browser.newPage();
  const pageErrors = [];
  popup.on("pageerror", (error) => pageErrors.push(String(error)));

  await popup.setViewport({ width: 360, height: 600, deviceScaleFactor: 1 });

  await safeGoto(popup, popupUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  console.log("⏳ Waiting for popup content selectors...");
  await safeWaitForSelector(popup, "whatsapp-message-popup #country-trigger", {
    timeout: 10_000,
  });
  await safeWaitForSelector(popup, "#country-trigger .country-picker__flag-img", {
    timeout: 10_000,
  });

  // O contextMenus permission só vale algo se o item realmente for registrado no worker de
  // fundo na instalação. update() com um id inexistente popula chrome.runtime.lastError sem
  // lançar — é a única forma de "consultar" um menu de contexto pela API, já que MV3 não expõe
  // um getAll(). A metade "removido na desinstalação" não precisa de uma checagem própria: uma
  // vez desinstalada, o worker que hospedava esse menu deixa de existir, o que as verificações
  // de desinstalação abaixo (service worker consumindo `startsWith(extensionOrigin)`) já cobrem.
  //
  // Deliberately checked from the popup page, not from the service worker directly. Evaluating
  // straight in the service worker (via workerTarget.worker()) previously handled two known,
  // recoverable races (Chromium's own "CDP can evaluate before the worker is initialized" bug,
  // and background.js's onInstalled listener being itself async — see git history for the retry
  // loop that absorbed both). But a third, confirmed-upstream Chromium/Puppeteer bug stacks on
  // top of those and isn't recoverable by retrying: "getting" a service worker (calling
  // .worker(), which — confirmed by reading its own source — sends Runtime.enable and attaches a
  // CDP session as a side effect of construction, not just of evaluate()) can put it into a
  // permanently dead state that never wakes up again (crbug.com/1371432,
  // puppeteer/puppeteer#9995). Reproduced deterministically in CI: identical extension ID and
  // near-identical timing across two separate runs, "Target closed" followed by dozens of
  // unrecovering "detached frame or worker" errors for the full retry window. chrome.contextMenus
  // is not actually background-context-exclusive — any extension page with the permission can
  // call it — so checking from the popup (a normal page, no dead-mode risk) sidesteps the bug
  // entirely instead of trying to out-retry an upstream Chromium issue. This also removes the
  // need for the worker.close() call this file used to have before uninstallExtension(): that
  // existed only to release the CDP session .worker() attached, and nothing here attaches one
  // anymore.
  console.log("🔍 Verifying context menu registration...");
  let contextMenuRegistered = false;
  try {
    await waitUntil(async () => {
      contextMenuRegistered = await popup.evaluate(
        () =>
          new Promise((resolveCheck) => {
            chrome.contextMenus.update("quick-whatsapp-contact.send", {}, () => {
              resolveCheck(!chrome.runtime.lastError);
            });
          }),
      );
      return contextMenuRegistered;
    }, "Timed out waiting for the context menu item to be registered.");
  } catch (error) {
    console.error(`⚠️  Context menu check failed: ${error.message}`);
    // Log diagnostics before re-throwing
    if (browser) {
      const diag = await captureBrowserDiagnostics(browser);
      console.error(`Browser state: ${JSON.stringify(diag, null, 2)}`);
    }
    throw error;
  }
  assert.equal(
    contextMenuRegistered,
    true,
    "O item de menu de contexto não foi registrado na instalação.",
  );

  console.log("🔍 Evaluating popup state...");
  const installedState = await safeEvaluate(popup, () => {
    const flag = document.querySelector("#country-trigger .country-picker__flag-img");
    const panel = document.querySelector(".panel");
    const panelBounds = panel?.getBoundingClientRect();

    return {
      runtimeId: chrome.runtime.id,
      manifest: chrome.runtime.getManifest(),
      title: document.title,
      country: document.querySelector("#country-trigger")?.textContent?.trim(),
      flagUrl: flag?.src,
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

  assert.equal(installedState.runtimeId, extensionId);
  assert.equal(installedState.manifest.name, expectedManifest.name);
  assert.equal(installedState.manifest.version, expectedManifest.version);
  assert.equal(installedState.manifest.manifest_version, 3);
  assert.ok(installedState.title, "O popup não possui título.");
  assert.ok(installedState.country, "O seletor de país não foi renderizado.");

  const flagUrl = new URL(installedState.flagUrl);
  assert.equal(flagUrl.protocol, "chrome-extension:");
  assert.equal(flagUrl.hostname, extensionId);
  assert.match(flagUrl.pathname, /\/assets\/twemoji\/.*\.svg$/);
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

  console.log("💾 Setting storage preferences...");
  await safeEvaluate(popup, async () => {
    await chrome.storage.sync.set({
      "quick-whatsapp-contact.auto-highlight-enabled": false,
      "quick-whatsapp-contact.dark-mode-enabled": true,
      "quick-whatsapp-contact.language": "pt-BR",
      "quick-whatsapp-contact.default-country": "PT",
    });
  });

  console.log("📄 Opening options page...");
  const optionsPage = await browser.newPage();
  await optionsPage.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await safeGoto(optionsPage, `${extensionOrigin}/${expectedManifest.options_ui.page}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await safeWaitForSelector(optionsPage, "extension-settings-page #country-trigger", {
    timeout: 10_000,
  });

  console.log("🔍 Evaluating options page state...");
  const optionsState = await safeEvaluate(optionsPage, () => {
    const shell = document.querySelector(".options-shell");
    const bounds = shell?.getBoundingClientRect();
    const brand = document.querySelector(".options-brand img");
    const brandBounds = brand?.getBoundingClientRect();

    return {
      shellWidth: bounds?.width,
      shellCenter: bounds ? bounds.left + bounds.width / 2 : undefined,
      viewportCenter: window.innerWidth / 2,
      autoHighlight: document.querySelector("#auto-highlight")?.checked,
      darkMode: document.querySelector("#dark-mode")?.checked,
      language: document.querySelector("#language")?.value,
      defaultCountry: document.querySelector("#default-country-hidden")?.value,
      theme: document.documentElement.dataset.theme,
      brandUrl: brand?.src,
      brandComplete: brand?.complete,
      brandNaturalWidth: brand?.naturalWidth,
      brandCenter: brandBounds ? brandBounds.left + brandBounds.width / 2 : undefined,
      hasVerticalOverflow:
        document.documentElement.scrollHeight > window.innerHeight ||
        document.body.scrollHeight > window.innerHeight,
      projectUrl: document.querySelector('.options-footer a[href*="Quick-WhatsApp-Contact"]')?.href,
      authorUrl: document.querySelector('.options-footer a[href="https://github.com/DinoSaulo"]')?.href,
    };
  });

  assert.ok(optionsState.shellWidth <= 720, "A página de opções excedeu 720px.");
  assert.ok(
    Math.abs(optionsState.shellCenter - optionsState.viewportCenter) <= 1,
    "A página de opções não está centralizada.",
  );
  assert.equal(optionsState.autoHighlight, false);
  assert.equal(optionsState.darkMode, true);
  assert.equal(optionsState.language, "pt-BR");
  assert.equal(optionsState.defaultCountry, "PT");
  assert.equal(optionsState.theme, "dark");
  assert.equal(
    optionsState.brandUrl,
    `${extensionOrigin}/icons/logo-generated-512.png`,
  );
  assert.equal(optionsState.brandComplete, true);
  assert.ok(optionsState.brandNaturalWidth > 0, "A marca da página de opções não carregou.");
  assert.ok(
    Math.abs(optionsState.brandCenter - optionsState.viewportCenter) <= 1,
    "A marca da página de opções não está centralizada.",
  );
  assert.equal(optionsState.hasVerticalOverflow, false, "A página de opções possui rolagem vertical.");
  assert.equal(
    optionsState.projectUrl,
    "https://github.com/DinoSaulo/Quick-WhatsApp-Contact",
  );
  assert.equal(optionsState.authorUrl, "https://github.com/DinoSaulo");
  
  console.log("🔒 Closing pages...");
  await safePageClose(optionsPage);
  await safePageClose(popup);

  // A página aberta também é um alvo da extensão; feche-a para que somente os
  // processos mantidos pela instalação sejam considerados na desinstalação.
  console.log("🗑️  Uninstalling extension...");
  await browser.uninstallExtension(extensionId);

  await waitUntil(
    () =>
      !browser.targets().some(
        (target) =>
          target.type() === "service_worker" &&
          target.url().startsWith(extensionOrigin),
      ),
    "O service worker continuou ativo após a desinstalação.",
  );

  await waitUntil(
    () =>
      !browser
        .targets()
        .some((target) => target.url().startsWith(extensionOrigin)),
    "Ainda existem páginas ou processos da extensão após a desinstalação.",
  );

  const removedPopup = await browser.newPage();
  let navigationFailed = false;

  try {
    await removedPopup.goto(popupUrl, {
      waitUntil: "domcontentloaded",
      timeout: 5_000,
    });
  } catch {
    navigationFailed = true;
  }

  const removedPopupUrl = removedPopup.url();
  await removedPopup.close();

  assert.ok(
    navigationFailed || !removedPopupUrl.startsWith(extensionOrigin),
    "O popup ainda pode ser acessado após a desinstalação.",
  );

  // Reinstala no mesmo perfil para confirmar dois pontos que o ciclo acima não cobre: (1) a
  // desinstalação não deixa nenhum registro (worker, storage) que impeça uma nova instalação
  // limpa, e (2) chrome.storage.sync é escopado por instalação — as configurações setadas antes
  // da desinstalação não devem "ressuscitar" na reinstalação.
  console.log("📦 Reinstalling extension to verify clean state...");
  const reinstalledExtensionId = await browser.installExtension(extensionPath);
  assert.match(reinstalledExtensionId, /^[a-p]{32}$/);

  const reinstalledOrigin = `chrome-extension://${reinstalledExtensionId}`;

  console.log("⏳ Waiting for reinstalled service worker...");
  await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith(reinstalledOrigin) &&
      target.url().endsWith("/src/background.js"),
    { timeout: 30_000 },
  );

  // Same race as the first install above — reason: "install" fires again for this second,
  // independent install cycle, so background.js opens another onboarding tab here too. Not closed
  // explicitly, for the same reason as the first one above.
  console.log("⏳ Waiting for onboarding tab (opened automatically on reinstall)...");
  await browser.waitForTarget(
    (target) =>
      target.type() === "page" &&
      target.url() === `${reinstalledOrigin}/${ONBOARDING_PAGE_PATH}`,
    { timeout: 15_000 },
  );

  const reinstalledOptions = await browser.newPage();
  console.log("📄 Verifying clean settings on reinstalled extension...");
  await safeGoto(
    reinstalledOptions,
    `${reinstalledOrigin}/${expectedManifest.options_ui.page}`,
    { waitUntil: "domcontentloaded", timeout: 30_000 },
  );
  await safeWaitForSelector(reinstalledOptions, "extension-settings-page #country-trigger", {
    timeout: 10_000,
  });

  const reinstalledSettings = await safeEvaluate(reinstalledOptions, () => ({
    autoHighlight: document.querySelector("#auto-highlight")?.checked,
    darkMode: document.querySelector("#dark-mode")?.checked,
    language: document.querySelector("#language")?.value,
    defaultCountry: document.querySelector("#default-country-hidden")?.value,
  }));

  assert.equal(
    reinstalledSettings.autoHighlight,
    false,
    "auto-highlight não voltou ao padrão após reinstalar; configurações antigas ressuscitaram.",
  );
  assert.equal(
    reinstalledSettings.darkMode,
    false,
    "dark-mode não voltou ao padrão após reinstalar; configurações antigas ressuscitaram.",
  );
  assert.equal(
    reinstalledSettings.language,
    "en-US",
    "O idioma não voltou ao padrão após reinstalar; configurações antigas ressuscitaram.",
  );
  assert.equal(
    reinstalledSettings.defaultCountry,
    "",
    "O país padrão não voltou ao padrão após reinstalar; configurações antigas ressuscitaram.",
  );

  // Segundo ciclo de desinstalação, desta vez deliberadamente com o popup E a página de opções
  // ainda abertos — o caminho mais realista (um usuário não fecha suas abas antes de remover a
  // extensão em chrome://extensions), e diferente do primeiro ciclo acima, que fecha o popup
  // antes de desinstalar.
  console.log("🔄 Testing uninstall with open pages...");
  const reinstalledPopup = await browser.newPage();
  await safeGoto(reinstalledPopup, `${reinstalledOrigin}/${expectedManifest.action.default_popup}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await safeWaitForSelector(reinstalledPopup, "whatsapp-message-popup #country-trigger", {
    timeout: 10_000,
  });

  await browser.uninstallExtension(reinstalledExtensionId);

  await waitUntil(
    () => reinstalledPopup.isClosed() && reinstalledOptions.isClosed(),
    "O popup e/ou a página de opções não foram fechados automaticamente ao desinstalar com as abas abertas.",
  );

  console.log("✅ Chrome/Chromium extension lifecycle smoke test passed.");
  console.log(`Browser: ${await browser.version()}`);
  console.log(`Extension ID: ${extensionId}`);
  console.log("Install validation: passed");
  console.log("Uninstall validation: passed");
  console.log("Context menu registration validation: passed");
  console.log("Reinstall validation: passed");
  console.log("Settings-not-resurrected validation: passed");
  console.log("Uninstall-with-pages-open validation: passed");
} catch (error) {
  console.error("❌ Test failed:", error);
  // Printed unconditionally, unlike captureBrowserDiagnostics() below: this reads only the log
  // file on disk and the raw ChildProcess object's own properties, neither of which depends on the
  // CDP connection — confirmed useful precisely because of that: captureBrowserDiagnostics() has
  // failed with "Tab target session is not defined" on exactly the kind of crash this exists to
  // help diagnose.
  console.error(await formatChromeDiagnostics());
  console.error(captureSystemDiagnostics());
  console.error(captureLinkerDiagnostics(executablePath));
  if (browser) {
    try {
      const diag = await captureBrowserDiagnostics(browser);
      console.error("Browser diagnostics:", JSON.stringify(diag, null, 2));
    } catch (diagError) {
      console.error("Failed to capture diagnostics:", diagError);
    }
  }
  throw error;
} finally {
  console.log("🔒 Closing browser...");
  await safeBrowserClose(browser);
  // Best-effort: on Windows specifically, the log file can still be held open by Chrome's own
  // process for a brief moment after close() resolves, which turns rmSync into EBUSY/EPERM
  // instead of silently no-op'ing the way a missing path does even with force: true. Harmless to
  // leave behind in CI (ephemeral runners), so this must never let a cleanup failure mask the
  // actual test result.
  try {
    rmSync(chromeLogDir, { recursive: true, force: true });
  } catch {
    // Ignored — see comment above.
  }
}
