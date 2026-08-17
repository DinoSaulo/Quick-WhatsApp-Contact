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
// --disable-breakpad is deliberately NOT in this list (it briefly was, and removing it here alone
// turned out to be a no-op worth documenting): puppeteer-core's own ChromeLauncher.defaultArgs()
// hardcodes both --disable-breakpad and --disable-crash-reporter unconditionally, before this
// file's args are ever merged in (node_modules/puppeteer-core/lib/esm/puppeteer/node/
// ChromeLauncher.js) — so this array never actually controlled whether Chrome's own crash
// reporter was on. The only way to override a puppeteer-core *default* arg (as opposed to adding
// one of our own) is puppeteer.launch()'s ignoreDefaultArgs option, which extension-install.mjs
// now passes directly for both flags — see the comment at that launch() call for why (getting a
// real crash report/minidump out of a SIGSEGV that --disable-breakpad/--disable-crash-reporter
// would otherwise silently swallow).
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

  // Add sandbox args if running as root (CI containers) OR on Linux at all — not just root.
  // Confirmed root cause of a real CI failure (installation-test-pinned, a bare non-root
  // ubuntu-latest runner): recent Ubuntu restricts unprivileged processes from creating user
  // namespaces via AppArmor unless the binary has a registered profile. apt/dnf/pacman-installed
  // Chromium gets one from the OS; scripts/install-chrome-version.mjs downloads Chrome for Testing
  // straight to .chrome-for-testing/<version>/ instead, an arbitrary path with no such profile —
  // and Chrome's own sandbox process needs exactly that syscall to start. The crash surfaces as an
  // immediate "Target closed" during ChromeLauncher's very first CDP handshake, before any of this
  // script's own code runs, not as anything root-related. Same reasoning already applied to
  // Firefox via MOZ_DISABLE_CONTENT_SANDBOX in firefox-extension-install.mjs: content sandboxing
  // only protects against a compromised *web page's* renderer process, has no bearing on this
  // test's own security-relevant assertions (which run in Node, driving the browser), so disabling
  // it here is a test-harness-only concession — it must never be applied to how end users actually
  // run this extension.
  if (isRoot || isLinux) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  // Add CI-specific stability flags for more reliable runs
  if (isCI) {
    args.push(...CI_STABILITY_FLAGS);
  }

  return args;
}
