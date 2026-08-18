// Confirms the browser a CI matrix entry actually installed matches its declared major version.
// Reuses extension-install.mjs's own findBrowserExecutable() so "what CI verifies" and "what the smoke test runs" never drift apart.
import { execFileSync } from "node:child_process";
import { findBrowserExecutable } from "../tests/installation/browser-environment.mjs";

const expectedMajor = process.argv[2];

if (!expectedMajor) {
  console.error("Usage: node scripts/verify-chrome-version.mjs <expectedMajorVersion>");
  process.exit(1);
}

const executablePath = findBrowserExecutable();

if (!executablePath) {
  console.error("::error::Nenhum executavel Chrome/Chromium encontrado neste runner.");
  process.exit(1);
}

// `chrome.exe --version` is unreliable on Windows when another Chrome instance is already running
// (singleton mechanism prints "Opening in existing browser session." instead) — reading file version metadata sidesteps that.
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
  `Chrome/Chromium instalado: "${rawVersion}" (major ${actualMajor || "desconhecido"}, esperado ${expectedMajor})`,
);

if (actualMajor !== expectedMajor) {
  console.error(
    `::error::A versao major do Chrome mudou (esperado ${expectedMajor}, encontrado ${actualMajor || "nenhum"}). Atualize chromeMajor e o rotulo do job em .github/workflows/ci.yml.`,
  );
  process.exit(1);
}
