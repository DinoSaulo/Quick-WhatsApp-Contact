import { existsSync } from "node:fs";
import { resolve } from "node:path";

const STANDARD_BROWSER_ARGS = [
  "--no-first-run",
  "--no-default-browser-check",
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
} = {}) {
  const args = [...STANDARD_BROWSER_ARGS];

  if (isRoot) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  return args;
}
