// Confirms the browser a CI installation-test-firefox* matrix entry actually has installed
// matches the major version declared in that job's label/firefoxMajor (.github/workflows/ci.yml).
// Mirrors scripts/verify-chrome-version.mjs: reuses the same findFirefoxExecutable() lookup
// tests/installation/firefox-extension-install.mjs uses, so "what CI verifies" and "what the
// lifecycle test actually runs against" stay the same code path.
import { execFileSync } from "node:child_process";
import { findFirefoxExecutable } from "../tests/installation/firefox-environment.mjs";

const expectedMajor = process.argv[2];

if (!expectedMajor) {
  console.error("Usage: node scripts/verify-firefox-version.mjs <expectedMajorVersion>");
  process.exit(1);
}

const executablePath = findFirefoxExecutable();

if (!executablePath) {
  console.error("::error::Nenhum executavel Firefox encontrado neste runner.");
  process.exit(1);
}

// Same rationale as verify-chrome-version.mjs: reading the executable's own file version
// metadata on Windows sidesteps any single-instance/already-running-process quirk instead of
// trusting `firefox.exe --version` to print to this process's stdout.
const rawVersion =
  process.platform === "win32"
    ? execFileSync(
        "powershell.exe",
        ["-NoProfile", "-Command", `(Get-Item -LiteralPath '${executablePath}').VersionInfo.ProductVersion`],
        { encoding: "utf8" },
      ).trim()
    : execFileSync(executablePath, ["--version"], { encoding: "utf8" }).trim();
const actualMajor = rawVersion.match(/\d+/)?.[0] ?? "";

console.log(
  `Firefox instalado: "${rawVersion}" (major ${actualMajor || "desconhecido"}, esperado ${expectedMajor})`,
);

if (actualMajor !== expectedMajor) {
  console.error(
    `::error::A versao major do Firefox mudou (esperado ${expectedMajor}, encontrado ${actualMajor || "nenhum"}). Atualize firefoxMajor e o rotulo do job em .github/workflows/ci.yml.`,
  );
  process.exit(1);
}
