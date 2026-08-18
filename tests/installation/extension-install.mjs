import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
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
  validatePageIsAlive,
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

// File-based (not dumpio/streams, which lose a startup-output race) and workspace-relative (not
// os.tmpdir()) so ci.yml's "Anexar diagnosticos" step can upload it; mkdtempSync keeps each retry attempt's evidence separate.
const diagnosticsRoot = resolve(projectRoot, "ci-diagnostics");
mkdirSync(diagnosticsRoot, { recursive: true });
const chromeLogDir = mkdtempSync(join(diagnosticsRoot, "chrome-log-"));
const chromeLogFile = join(chromeLogDir, "chrome.log");
// An explicit userDataDir (not puppeteer-core's random temp one) lets captureCrashDumpDiagnostics()
// find whatever Crashpad writes. Deliberately NOT under diagnosticsRoot: it's Chrome's entire profile (tens of MB) — copy just the .dmp out instead, always clean this dir up.
const chromeUserDataDir = mkdtempSync(join(tmpdir(), "quick-whatsapp-contact-chrome-userdata-"));
let chromeProcess;
// A bare synchronous read of exitCode/signalCode races Node's event loop — two real CI failures
// showed exitCode=null right alongside a real "Connection closed". Listening for the real events removes that ambiguity.
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
  // before reading state below (see the comment on chromeExitInfo above).
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

// Handles a renderer dying silently (no chrome.log line, process still alive): usually the Linux
// OOM killer's SIGKILL. Scans dmesg for both OOM and segfault traces — a real recurring SIGSEGV once slipped past a regex that only matched OOM wording.
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
    // dmesg is restricted to root on most modern kernels; GitHub Actions grants the runner
    // passwordless sudo, already relied on elsewhere in this workflow for apt-get.
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

// SIGSEGV in a manually-downloaded Chrome-for-Testing binary was already root-caused once to missing
// shared library dependencies (ci.yml's "Instalar Chrome estavel" step) — ldd confirms directly, unconditionally, whether that still holds for this run's exact binary.
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

// Chrome's crash reporter writes a .dmp minidump under user-data-dir on a native crash (only once
// ignoreDefaultArgs re-enables it). Recursive search since the subdirectory moved across Chrome versions; copies any dump into copyDestDir since userDataDir itself is never uploaded.
function captureCrashDumpDiagnostics(userDataDir, copyDestDir) {
  if (process.platform !== "linux") {
    return "(crash-dump diagnostics only implemented for Linux)";
  }
  try {
    const found = execFileSync("find", [userDataDir, "-name", "*.dmp"], {
      encoding: "utf8",
      timeout: 5_000,
    })
      .split("\n")
      .filter(Boolean);
    if (!found.length) {
      return `--- no .dmp crash dump files found under ${userDataDir} ---`;
    }
    const withSizes = found.map((dumpPath) => {
      try {
        const { size } = statSync(dumpPath);
        try {
          copyFileSync(dumpPath, join(copyDestDir, basename(dumpPath)));
          return `${dumpPath} (${size} bytes, copied to ${copyDestDir})`;
        } catch (copyError) {
          return `${dumpPath} (${size} bytes, copy to ${copyDestDir} failed: ${copyError.message})`;
        }
      } catch (error) {
        return `${dumpPath} (stat failed: ${error.message})`;
      }
    });
    return `--- crash dump files found ---\n${withSizes.join("\n")}`;
  } catch (error) {
    return `--- crash dump search under ${userDataDir} ---\n(failed: ${error.message})`;
  }
}

let browser;
// Guards the diagnostics-directory cleanup below: only delete on a genuine pass — on failure it
// must survive this process exiting so ci.yml's later actions/upload-artifact step can find it.
let testSucceeded = false;

try {
  // GitHub Actions job containers run as root, so Chromium's sandbox must be disabled (outer job
  // container is the isolation boundary). --v=1 was rejected as too costly (~594KB/1.5s); plain --enable-logging stays quiet unless something goes wrong.
  const browserArgs = [
    ...createBrowserArgs(),
    "--enable-logging",
    `--log-file=${chromeLogFile}`,
  ];

  // pipe: true (removed) had a known bug class dropping the whole browser connection — matched a
  // real CI failure; left on WebSocket transport. ignoreDefaultArgs overrides only these two; userDataDir lets captureCrashDumpDiagnostics() find its target.
  const launchOptions = launchBrowserWithStabilityFlags({
    executablePath,
    headless: true,
    enableExtensions: true,
    userDataDir: chromeUserDataDir,
    ignoreDefaultArgs: ["--disable-breakpad", "--disable-crash-reporter"],
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

  // background.js's onInstalled opens an onboarding tab concurrently; wait for it before newPage() below.
  // Deliberately not closed explicitly (once preceded a "Connection closed" crash) — uninstallExtension() below closes it anyway.
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

  // A real CI run segfaulted Chrome right as setViewport()'s first CDP command hit a not-yet-ready
  // page. validatePageIsAlive() forces a real round-trip first, turning that into an ordinary error instead of risking a native crash.
  await validatePageIsAlive(popup, "popup page");
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

  // update() with a nonexistent id populates lastError without throwing — the only way to "query" a
  // context menu since MV3 has no getAll(). Checked from the popup, not the service worker: .worker() can put the worker into a permanently dead state (crbug.com/1371432), reproduced in CI.
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
  // Same readiness probe as the popup page above, same reasoning.
  await validatePageIsAlive(optionsPage, "options page");
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

  // Reinstala no mesmo perfil para confirmar: (1) a desinstalação não deixa registro que impeça
  // reinstalar, e (2) chrome.storage.sync é escopado por instalação — nada "ressuscita".
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

  // Same race as the first install above — this second, independent install cycle also opens an
  // onboarding tab; not closed explicitly, for the same reason as above.
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

  // Segundo ciclo de desinstalação, desta vez com popup E opções ainda abertos — o caminho mais
  // realista (usuário não fecha as abas antes de remover a extensão), diferente do ciclo acima.
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

  testSucceeded = true;
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
  // Printed unconditionally, unlike captureBrowserDiagnostics() below: reads only the log file and
  // ChildProcess's own properties, neither depending on the CDP connection that a crash just broke.
  console.error(await formatChromeDiagnostics());
  console.error(captureSystemDiagnostics());
  console.error(captureLinkerDiagnostics(executablePath));
  console.error(captureCrashDumpDiagnostics(chromeUserDataDir, chromeLogDir));
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
  // Best-effort: on Windows, Chrome can briefly hold a file open after close() resolves, turning
  // rmSync into EBUSY/EPERM — must never mask the actual test result. chromeUserDataDir is always removed, pass or fail (never itself a CI artifact).
  try {
    rmSync(chromeUserDataDir, { recursive: true, force: true });
  } catch {
    // Ignored — see comment above.
  }
  // chromeLogDir: only cleaned up on a genuine pass (see testSucceeded above) — on failure it's
  // left behind so ci.yml's "Anexar diagnosticos do Chrome" step can upload it as an artifact.
  if (testSucceeded) {
    try {
      rmSync(chromeLogDir, { recursive: true, force: true });
    } catch {
      // Ignored — see comment above.
    }
  }
}
