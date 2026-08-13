// Confirms the browser a CI installation-test matrix entry actually has installed matches the
// major version declared in that job's label/chromeMajor (.github/workflows/ci.yml). A plain
// `chromium --version` shell command only works on the Linux container entries (Fedora, Debian,
// Rocky Linux, Arch Linux), where the package manager symlinks the binary onto PATH — on
// Windows and macOS, Chrome lives at a fixed, non-PATH path, so this reuses the same
// findBrowserExecutable() lookup tests/installation/extension-install.mjs uses to locate the
// real browser puppeteer-core will launch, keeping "what CI verifies" and "what the smoke test
// actually runs against" the same code path instead of two separate, driftable ones.
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

// `chrome.exe --version` is unreliable on Windows: when another Chrome instance is already
// running (the desktop browser, or a leftover process), the singleton mechanism just activates
// that window and prints "Opening in existing browser session." instead of a version — reading
// the executable's own file version metadata sidesteps that entirely and is not affected by
// whether Chrome is already running.
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
