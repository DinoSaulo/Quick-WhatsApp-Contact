import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const STANDARD_BROWSER_ARGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-dev-shm-usage", // Critical for CI/Docker: prevents /dev/shm exhaustion
  "--disable-gpu", // Disable GPU for headless CI
];

// --disable-extensions must NOT be in this list (defeats enableExtensions: true, confirmed CI regression twice).
// --disable-breakpad is deliberately absent too — puppeteer-core hardcodes it; override via ignoreDefaultArgs instead (see extension-install.mjs).
export const CI_STABILITY_FLAGS = [
  "--disable-background-networking",
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
  isLinux = process.platform === "linux",
  isCI = process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.CONTINUOUS_INTEGRATION === "true",
} = {}) {
  const args = [...STANDARD_BROWSER_ARGS];

  // Sandbox args for root (CI containers) OR Linux at all — a manually-downloaded (not apt/dnf-installed)
  // Chrome has no AppArmor profile registered, so unprivileged sandbox startup fails even as non-root. Test-harness-only; never apply this to end users.
  if (isRoot || isLinux) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  // Add CI-specific stability flags for more reliable runs
  if (isCI) {
    args.push(...CI_STABILITY_FLAGS);
  }

  return args;
}
