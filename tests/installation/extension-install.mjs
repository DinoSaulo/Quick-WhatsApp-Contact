import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

let browser;

try {
  // GitHub Actions job containers run as root. Chromium refuses to start as
  // root unless its process sandbox is disabled; the outer job container
  // remains the isolation boundary in this CI-only scenario.
  const browserArgs = createBrowserArgs();

  const launchOptions = launchBrowserWithStabilityFlags({
    executablePath,
    headless: true,
    pipe: true,
    enableExtensions: true,
    args: browserArgs,
  });

  console.log("🚀 Launching browser with stability flags...");
  browser = await puppeteer.launch(launchOptions);

  console.log("📦 Installing extension...");
  const extensionId = await browser.installExtension(extensionPath);
  const extensionOrigin = `chrome-extension://${extensionId}`;

  assert.match(extensionId, /^[a-p]{32}$/);
  console.log(`✅ Extension installed: ${extensionId}`);

  console.log("⏳ Waiting for service worker target...");
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith(extensionOrigin) &&
      target.url().endsWith("/src/background.js"),
    { timeout: 30_000 },
  );

  // O contextMenus permission só vale algo se o item realmente for registrado no worker de
  // fundo na instalação. update() com um id inexistente popula chrome.runtime.lastError sem
  // lançar — é a única forma de "consultar" um menu de contexto pela API, já que MV3 não expõe
  // um getAll(). A metade "removido na desinstalação" não precisa de uma checagem própria: uma
  // vez desinstalada, o worker que hospedava esse menu deixa de existir, o que as verificações
  // de desinstalação abaixo (service worker consumindo `startsWith(extensionOrigin)`) já cobrem.
  console.log("🔍 Verifying context menu registration...");
  const worker = await workerTarget.worker();

  // CDP can attach to and evaluate against a service worker target before Chrome has actually
  // finished initializing that worker's global scope — a confirmed, Won't-Fix Chromium bug
  // (https://issues.chromium.org/issues/341213355). Evaluating too early here doesn't throw a
  // useful error; it silently sees a bare worker global with no extension APIs injected yet
  // (confirmed directly: chrome.runtime undefined, chrome.contextMenus undefined, only the
  // ambient chrome.csi/chrome.loadTimes every page/worker gets), so `chrome.contextMenus.update`
  // below would throw "Cannot read properties of undefined" — not because the permission is
  // missing, but because of this race. Poll for chrome.runtime's presence first; verified locally
  // this resolves in ~100-150ms (2 polls), consistently across repeated runs.
  await waitUntil(
    () => worker.evaluate(() => typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined"),
    "Timed out waiting for the service worker's extension APIs (chrome.runtime) to initialize.",
  );

  let contextMenuRegistered = false;
  try {
    contextMenuRegistered = await worker.evaluate(
      () =>
        new Promise((resolveCheck) => {
          chrome.contextMenus.update("quick-whatsapp-contact.send", {}, () => {
            resolveCheck(!chrome.runtime.lastError);
          });
        }),
    );
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

  // Evaluating in the service worker earlier (the context-menu check, and the readiness poll
  // before it) attached a CDP debugger session to it — and, confirmed directly, a service worker
  // with a debugger still attached does not stop just because uninstallExtension() removes the
  // extension: the target lingered indefinitely (still present 15s later) until this was added.
  // CdpWebWorker.close()'s own source comment names this exactly: "For service and shared workers
  // we need to close the target and detach to allow the worker to stop"
  // (node_modules/puppeteer-core/lib/esm/puppeteer/cdp/WebWorker.js). Must run before
  // uninstallExtension(), not after — verified closing first makes the target disappear within
  // 0-1ms; the reverse order was never tested to help, since the whole point is releasing the
  // debugger session that's keeping it pinned alive.
  await worker.close();

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
}
