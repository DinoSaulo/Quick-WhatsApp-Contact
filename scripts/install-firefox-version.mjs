// Downloads and extracts an exact Firefox release for the version
// scripts/resolve-firefox-versions.mjs picked, so .github/workflows/ci.yml's
// installation-test-firefox-pinned matrix can run the real install/uninstall lifecycle test
// (tests/installation/firefox-extension-install.mjs) against that precise major. Mirrors
// scripts/install-chrome-version.mjs's shape, against Mozilla's public release archive instead
// of Chrome for Testing. Prints the extracted executable's absolute path on stdout; the
// workflow step captures it into $GITHUB_ENV as FIREFOX_PATH, which
// tests/installation/firefox-environment.mjs's findFirefoxExecutable() already checks first.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Confirmed live against archive.mozilla.org/pub/firefox/releases/<version>/linux-x86_64/en-US/:
// current releases ship as a single firefox-<version>.tar.xz (older releases used .tar.bz2, but
// every version installation-test-firefox-pinned ever resolves is recent enough to be .tar.xz).
const PLATFORM_DIR = "linux-x86_64";

const version = process.argv[2];

if (!version) {
  console.error("Usage: node scripts/install-firefox-version.mjs <exact Firefox version>");
  process.exit(1);
}

const downloadUrl = `https://archive.mozilla.org/pub/firefox/releases/${version}/${PLATFORM_DIR}/en-US/firefox-${version}.tar.xz`;

const destDir = resolve(".firefox-releases", version);
mkdirSync(destDir, { recursive: true });

const archivePath = resolve(destDir, "firefox.tar.xz");
const archiveResponse = await fetch(downloadUrl);
if (!archiveResponse.ok) {
  throw new Error(`Falha ao baixar ${downloadUrl}: HTTP ${archiveResponse.status}`);
}
writeFileSync(archivePath, Buffer.from(await archiveResponse.arrayBuffer()));

// GNU tar (ubuntu-latest's default) auto-detects xz compression from the archive itself, no
// separate `xz` binary or `-J`/`--xz` flag needed. Extracts to a top-level firefox/ directory.
execFileSync("tar", ["-xf", archivePath, "-C", destDir]);

const executablePath = resolve(destDir, "firefox", "firefox");
chmodSync(executablePath, 0o755);

console.log(executablePath);
