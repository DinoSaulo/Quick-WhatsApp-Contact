// Downloads and extracts an exact Firefox release for the version resolve-firefox-versions.mjs picked
// (mirrors install-chrome-version.mjs, against Mozilla's release archive). Prints the path as FIREFOX_PATH.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Confirmed live against archive.mozilla.org: current releases ship as firefox-<version>.tar.xz
// (older ones used .tar.bz2, but every version we resolve is recent enough to be .tar.xz).
const PLATFORM_DIR = "linux-x86_64";

const version = process.argv[2];

if (!version) {
  console.error("Usage: node scripts/install-firefox-version.mjs <exact Firefox version>");
  process.exit(1);
}

// Idempotent: ci.yml caches .firefox-releases/<version> keyed by exact version (actions/cache),
// so a cache hit means this executable already exists — skip the network round-trip entirely.
const cachedExecutablePath = resolve(".firefox-releases", version, "firefox", "firefox");
if (existsSync(cachedExecutablePath)) {
  console.log(cachedExecutablePath);
  process.exit(0);
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
