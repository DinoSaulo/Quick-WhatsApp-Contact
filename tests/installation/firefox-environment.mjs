import { existsSync } from "node:fs";
import { createServer } from "node:net";

// Mirrors browser-environment.mjs's Chrome lookup, one env var narrower: Firefox has no
// "Chromium" naming split to account for, but Debian/Ubuntu ship the binary as `firefox-esr`
// (see .github/workflows/ci.yml's installation-test-firefox Debian entry), which is why that
// candidate is listed separately from plain `firefox`.
export function firefoxExecutableCandidates({
  platform = process.platform,
  env = process.env,
} = {}) {
  const configuredPaths = [env.FIREFOX_PATH, env.PUPPETEER_EXECUTABLE_PATH];

  const platformPaths = {
    win32: [
      "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
    ],
    darwin: ["/Applications/Firefox.app/Contents/MacOS/firefox"],
    linux: ["/usr/bin/firefox", "/usr/bin/firefox-esr"],
  };

  return [...configuredPaths, ...(platformPaths[platform] ?? [])].filter(Boolean);
}

export function findFirefoxExecutable({ exists = existsSync, ...options } = {}) {
  return firefoxExecutableCandidates(options).find((candidate) => exists(candidate));
}

// Firefox's WebDriver BiDi endpoint (which puppeteer-core connects to for the popup/options page
// checks in firefox-extension-install.mjs) needs a port handed to it up front via
// --remote-debugging-port — unlike Chrome, web-ext's programmatic API exposes no stdout/stderr
// stream we could otherwise scrape an auto-assigned port from. Binding port 0 and reading back
// what the OS assigned is the standard way to reserve a free port without hardcoding one that
// might collide with something else on the runner.
export function getAvailablePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.on("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}
