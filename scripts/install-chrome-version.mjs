// Downloads and extracts an exact Chrome for Testing build for the version resolve-chrome-versions.mjs
// picked. Prints the executable's absolute path on stdout for the workflow step to capture as CHROME_PATH.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const KNOWN_GOOD_VERSIONS_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";
// Ubuntu-only job (see installation-test-pinned in .github/workflows/ci.yml) — the exact-version
// matrix's job is precise version coverage, not OS diversity, so a single platform is enough.
const PLATFORM = "linux64";

const version = process.argv[2];

if (!version) {
  console.error("Usage: node scripts/install-chrome-version.mjs <exact Chrome version>");
  process.exit(1);
}

// Idempotent: ci.yml caches .chrome-for-testing/<version> keyed by exact version (actions/cache),
// so a cache hit means this executable already exists — skip the network round-trip entirely.
const cachedExecutablePath = resolve(".chrome-for-testing", version, "chrome-linux64", "chrome");
if (existsSync(cachedExecutablePath)) {
  console.log(cachedExecutablePath);
  process.exit(0);
}

const catalogResponse = await fetch(KNOWN_GOOD_VERSIONS_URL);
if (!catalogResponse.ok) {
  throw new Error(`Falha ao consultar ${KNOWN_GOOD_VERSIONS_URL}: HTTP ${catalogResponse.status}`);
}

const { versions } = await catalogResponse.json();
const entry = versions.find((candidate) => candidate.version === version);

if (!entry) {
  throw new Error(`Versao ${version} nao encontrada no catalogo do Chrome for Testing.`);
}

const download = entry.downloads?.chrome?.find((candidate) => candidate.platform === PLATFORM);

if (!download) {
  throw new Error(`Nenhum build ${PLATFORM} disponivel para a versao ${version}.`);
}

const destDir = resolve(".chrome-for-testing", version);
mkdirSync(destDir, { recursive: true });

const zipPath = resolve(destDir, "chrome-linux64.zip");
const zipResponse = await fetch(download.url);
if (!zipResponse.ok) {
  throw new Error(`Falha ao baixar ${download.url}: HTTP ${zipResponse.status}`);
}
writeFileSync(zipPath, Buffer.from(await zipResponse.arrayBuffer()));

// GitHub-hosted ubuntu-latest runners ship `unzip` in the base image, so this avoids adding a zip
// extraction dependency just for a script that only runs in this one CI job.
execFileSync("unzip", ["-q", zipPath, "-d", destDir]);

const executablePath = resolve(destDir, "chrome-linux64", "chrome");
chmodSync(executablePath, 0o755);

console.log(executablePath);
