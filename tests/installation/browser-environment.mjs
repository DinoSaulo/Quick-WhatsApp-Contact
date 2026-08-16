import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const STANDARD_BROWSER_ARGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-dev-shm-usage", // Critical for CI/Docker: prevents /dev/shm exhaustion
  "--disable-gpu", // Disable GPU for headless CI
];

// --disable-extensions must NOT be in this list: extension-install.mjs — the only caller that
// feeds createBrowserArgs()'s output into a real browser launch — always passes
// enableExtensions: true precisely so it can load and test our own extension, and Chrome's
// --disable-extensions has no "re-enable" counterpart a later flag can undo (see the matching
// comment in puppeteer-helpers.mjs's launchBrowserWithStabilityFlags(), which had the exact same
// flag duplicated and was fixed first). This copy was missed in that pass because isCI here
// defaults from the real process.env.CI, which is only "true" inside actual CI — a local run
// (isCI false by default) never exercises this list at all, so the fix looked complete against
// local verification alone and only broke again once it reached GitHub Actions, where CI=true
// unconditionally. Confirmed as the cause of a repeat "waiting for service worker" 30s timeout in
// CI, after the first fix, on already-fixed code.
export const CI_STABILITY_FLAGS = [
  "--disable-background-networking",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-extensions-with-background-pages",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-features=ChromeHeadless",
  "--disable-geolocation",
  "--disable-metrics",
  "--disable-plugins",
  "--disable-preconnect",
  "--disable-prompt-on-repost",
  "--disable-sync",
  "--enable-features=NetworkService,NetworkServiceInProcess",
  "--metrics-recording-only",
];

export function browserExecutableCandidates({
  platform = process.platform,
  env = process.env,
} = {}) {
  const configuredPaths = [
    env.CHROME_PATH,
    env.CHROMIUM_PATH,
    env.PUPPETEER_EXECUTABLE_PATH,
  ];

  const platformPaths = {
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      resolve(
        env.LOCALAPPDATA ?? "",
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

  return [...configuredPaths, ...(platformPaths[platform] ?? [])].filter(Boolean);
}

export function findBrowserExecutable({ exists = existsSync, ...options } = {}) {
  return browserExecutableCandidates(options).find((candidate) => exists(candidate));
}

export function createBrowserArgs({
  isRoot = typeof process.getuid === "function" && process.getuid() === 0,
  isCI = process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.CONTINUOUS_INTEGRATION === "true",
} = {}) {
  const args = [...STANDARD_BROWSER_ARGS];

  // Add sandbox args if running as root (CI containers)
  if (isRoot) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  // Add CI-specific stability flags for more reliable runs
  if (isCI) {
    args.push(...CI_STABILITY_FLAGS);
  }

  return args;
}
