import { existsSync } from "node:fs";
import { createServer } from "node:net";

// Mirrors browser-environment.mjs's Chrome lookup: Debian/Ubuntu ship the binary as `firefox-esr`
// (ci.yml's installation-test-firefox Debian entry), so it's listed separately from plain `firefox`.
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

// Firefox's BiDi endpoint needs a port handed to it up front via --remote-debugging-port — unlike
// Chrome, web-ext exposes no stream to scrape an auto-assigned one from, so we bind port 0 and read back what the OS assigned.
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
