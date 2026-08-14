// Firefox counterpart to extension-install.mjs. The toolchain is deliberately different from
// the Chrome test, because the two browsers don't offer comparable automation surfaces for
// extensions:
//
//  - Install/uninstall lifecycle: web-ext (Mozilla's own tool) loads the extension as a
//    temporary add-on over Firefox's Remote Debugging Protocol. Its public run() API exposes
//    reloadAllExtensions()/reloadExtensionBySourceDir()/exit() — there is no standalone
//    "uninstall" call for a temporary add-on the way Chrome's Extensions.uninstall CDP command
//    gives puppeteer. "Uninstall" here is therefore exit(): closing the runner is the only
//    supported way to remove a temporary add-on, so this test asserts the runner (and the
//    moz-extension:// pages it owned) are gone afterward, rather than "extension removed, browser
//    and other tabs stay up" the way the Chrome test can.
//  - Page-level checks (does the popup render, do settings apply, does the options page fit its
//    viewport): web-ext has no page-scripting API at all. This connects puppeteer-core to the
//    *same* Firefox process via WebDriver BiDi (Firefox's `--remote-debugging-port` flag) to
//    drive moz-extension:// pages, alongside web-ext handling the extension lifecycle.
//  - The moz-extension:// origin's UUID is normally random per install and per profile, which
//    would make it undiscoverable before the fact. It's pinned deterministically here by
//    pre-seeding the `extensions.webextensions.uuids` profile preference with a UUID this script
//    already knows, mapped to this extension's browser_specific_settings.gecko.id (manifest.json)
//    — the same technique Selenium's own Firefox extension-testing guide documents.
//
// Scenarios NOT covered here, and why: context-menu registration (Firefox exposes no
// programmatic way to query an installed context menu item from outside the background context,
// and BiDi has no equivalent of Chrome's service-worker target discovery to reach that context
// directly); reinstall / settings-not-resurrected (every web-ext run() starts a fresh temporary
// profile, so "a fresh install has default settings" is true by construction here, not a
// regression this extension's code could actually break — unlike the Chrome test, which reuses
// one browser profile across install → uninstall → reinstall).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";
import webExt from "web-ext";
import { findFirefoxExecutable, getAvailablePort } from "./firefox-environment.mjs";

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

async function connectWithRetries(browserWSEndpoint, { attempts = 20, delay = 250 } = {}) {
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
const extensionOrigin = `moz-extension://${EXTENSION_UUID}`;

let extensionRunner;
let browser;

try {
  extensionRunner = await webExt.cmd.run(
    {
      sourceDir: extensionPath,
      firefox: executablePath,
      pref: {
        "extensions.webextensions.uuids": JSON.stringify({ [geckoId]: EXTENSION_UUID }),
      },
      args: ["--headless", `--remote-debugging-port=${biDiPort}`],
      reload: false,
    },
    { shouldExitProgram: false },
  );

  browser = await connectWithRetries(`ws://127.0.0.1:${biDiPort}/session`);

  const popupUrl = `${extensionOrigin}/${expectedManifest.action.default_popup}`;

  const popup = await browser.newPage();
  const pageErrors = [];
  popup.on("pageerror", (error) => pageErrors.push(String(error)));

  await popup.setViewport({ width: 360, height: 600, deviceScaleFactor: 1 });
  await popup.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
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

  assert.equal(installedState.runtimeId, EXTENSION_UUID);
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

  const optionsPage = await browser.newPage();
  await optionsPage.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await optionsPage.goto(`${extensionOrigin}/${expectedManifest.options_ui.page}`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
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
  await extensionRunner.exit();

  await waitUntil(
    () => browser.connected === false,
    "A conexão com o Firefox continuou ativa após exit() do runner (desinstalação).",
  );

  console.log("Firefox extension lifecycle smoke test passed.");
  console.log(`Extension origin: ${extensionOrigin}`);
  console.log("Install validation: passed");
  console.log("Uninstall (runner exit) validation: passed");
} finally {
  if (browser?.connected) {
    await browser.close().catch(() => {});
  }
  await extensionRunner?.exit().catch(() => {});
}
