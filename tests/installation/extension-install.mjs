import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";
import {
  createBrowserArgs,
  findBrowserExecutable,
} from "./browser-environment.mjs";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

async function waitUntil(predicate, failureMessage, timeout = 10_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  assert.fail(failureMessage);
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

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    pipe: true,
    enableExtensions: true,
    timeout: 30_000,
    args: browserArgs,
  });

  const extensionId = await browser.installExtension(extensionPath);
  const extensionOrigin = `chrome-extension://${extensionId}`;

  assert.match(extensionId, /^[a-p]{32}$/);

  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith(extensionOrigin) &&
      target.url().endsWith("/src/background.js"),
    { timeout: 20_000 },
  );

  // O contextMenus permission só vale algo se o item realmente for registrado no worker de
  // fundo na instalação. update() com um id inexistente popula chrome.runtime.lastError sem
  // lançar — é a única forma de "consultar" um menu de contexto pela API, já que MV3 não expõe
  // um getAll(). A metade "removido na desinstalação" não precisa de uma checagem própria: uma
  // vez desinstalada, o worker que hospedava esse menu deixa de existir, o que as verificações
  // de desinstalação abaixo (service worker consumindo `startsWith(extensionOrigin)`) já cobrem.
  const worker = await workerTarget.worker();
  const contextMenuRegistered = await worker.evaluate(
    () =>
      new Promise((resolveCheck) => {
        chrome.contextMenus.update("quick-whatsapp-contact.send", {}, () => {
          resolveCheck(!chrome.runtime.lastError);
        });
      }),
  );
  assert.equal(
    contextMenuRegistered,
    true,
    "O item de menu de contexto não foi registrado na instalação.",
  );

  const popupUrl = `${extensionOrigin}/${expectedManifest.action.default_popup}`;

  const popup = await browser.newPage();
  const pageErrors = [];
  popup.on("pageerror", (error) => pageErrors.push(String(error)));

  await popup.setViewport({ width: 360, height: 600, deviceScaleFactor: 1 });

  await popup.goto(popupUrl, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await popup.waitForSelector("whatsapp-message-popup #country-trigger", {
    timeout: 10_000,
  });
  await popup.waitForSelector("#country-trigger .country-picker__flag-img", {
    timeout: 10_000,
  });

  const installedState = await popup.evaluate(() => {
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

  await popup.evaluate(async () => {
    await chrome.storage.sync.set({
      "quick-whatsapp-contact.auto-highlight-enabled": false,
      "quick-whatsapp-contact.dark-mode-enabled": true,
      "quick-whatsapp-contact.language": "pt-BR",
      "quick-whatsapp-contact.default-country": "PT",
    });
  });

  const optionsPage = await browser.newPage();
  await optionsPage.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await optionsPage.goto(
    `${extensionOrigin}/${expectedManifest.options_ui.page}`,
    { waitUntil: "domcontentloaded", timeout: 20_000 },
  );
  await optionsPage.waitForSelector("extension-settings-page #country-trigger", {
    timeout: 10_000,
  });

  const optionsState = await optionsPage.evaluate(() => {
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
  await optionsPage.close();

  // A página aberta também é um alvo da extensão; feche-a para que somente os
  // processos mantidos pela instalação sejam considerados na desinstalação.
  await popup.close();
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
  const reinstalledExtensionId = await browser.installExtension(extensionPath);
  assert.match(reinstalledExtensionId, /^[a-p]{32}$/);

  const reinstalledOrigin = `chrome-extension://${reinstalledExtensionId}`;

  await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith(reinstalledOrigin) &&
      target.url().endsWith("/src/background.js"),
    { timeout: 20_000 },
  );

  const reinstalledOptions = await browser.newPage();
  await reinstalledOptions.goto(
    `${reinstalledOrigin}/${expectedManifest.options_ui.page}`,
    { waitUntil: "domcontentloaded", timeout: 20_000 },
  );
  await reinstalledOptions.waitForSelector("extension-settings-page #country-trigger", {
    timeout: 10_000,
  });

  const reinstalledSettings = await reinstalledOptions.evaluate(() => ({
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
  const reinstalledPopup = await browser.newPage();
  await reinstalledPopup.goto(`${reinstalledOrigin}/${expectedManifest.action.default_popup}`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await reinstalledPopup.waitForSelector("whatsapp-message-popup #country-trigger", {
    timeout: 10_000,
  });

  await browser.uninstallExtension(reinstalledExtensionId);

  await waitUntil(
    () => reinstalledPopup.isClosed() && reinstalledOptions.isClosed(),
    "O popup e/ou a página de opções não foram fechados automaticamente ao desinstalar com as abas abertas.",
  );

  console.log("Chrome/Chromium extension lifecycle smoke test passed.");
  console.log(`Browser: ${await browser.version()}`);
  console.log(`Extension ID: ${extensionId}`);
  console.log("Install validation: passed");
  console.log("Uninstall validation: passed");
  console.log("Context menu registration validation: passed");
  console.log("Reinstall validation: passed");
  console.log("Settings-not-resurrected validation: passed");
  console.log("Uninstall-with-pages-open validation: passed");
} finally {
  await browser?.close();
}
