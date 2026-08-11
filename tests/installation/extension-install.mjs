import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const projectRoot = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

function findBrowserExecutable() {
  const configuredPaths = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ];

  const platformPaths = {
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      resolve(
        process.env.LOCALAPPDATA ?? "",
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      "C:\\Program Files\\Chromium\\Application\\chrome.exe",
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ],
  };

  return [...configuredPaths, ...(platformPaths[process.platform] ?? [])]
    .filter(Boolean)
    .find(existsSync);
}

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
  const browserArgs = ["--no-first-run", "--no-default-browser-check"];

  // GitHub Actions job containers run as root. Chromium refuses to start as
  // root unless its process sandbox is disabled; the outer job container
  // remains the isolation boundary in this CI-only scenario.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    browserArgs.push("--no-sandbox", "--disable-setuid-sandbox");
  }

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

  const popupUrl = `${extensionOrigin}/${expectedManifest.action.default_popup}`;

  const popup = await browser.newPage();
  const pageErrors = [];
  popup.on("pageerror", (error) => pageErrors.push(String(error)));

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

    return {
      runtimeId: chrome.runtime.id,
      manifest: chrome.runtime.getManifest(),
      title: document.title,
      country: document.querySelector("#country-trigger")?.textContent?.trim(),
      flagUrl: flag?.src,
      flagComplete: flag?.complete,
      flagNaturalWidth: flag?.naturalWidth,
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
  assert.deepEqual(pageErrors, [], `Erros no popup: ${pageErrors.join("; ")}`);

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

  console.log("Chrome/Chromium extension lifecycle smoke test passed.");
  console.log(`Browser: ${await browser.version()}`);
  console.log(`Extension ID: ${extensionId}`);
  console.log("Install validation: passed");
  console.log("Uninstall validation: passed");
} finally {
  await browser?.close();
}
