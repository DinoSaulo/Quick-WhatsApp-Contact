// Confirms that the browser installed for a CI matrix entry matches its declared major version.
// It shares browser discovery with the lifecycle smoke test so their selected binaries cannot drift.
import { execFileSync } from "node:child_process";
import { posix, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowserExecutable } from "../tests/installation/browser-environment.mjs";

const POWERSHELL_EXECUTABLE =
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const WINDOWS_VERSION_SCRIPT =
  "& { param([string] $ExecutablePath) " +
  "(Get-Item -LiteralPath $ExecutablePath).VersionInfo.ProductVersion }";
const TRUSTED_WINDOWS_ENV = Object.freeze({
  ...process.env,
  PATH:
    "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem;" +
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0",
});
const isAbsoluteExecutable = (path, platform) =>
  platform === "win32" ? win32.isAbsolute(path) : posix.isAbsolute(path);

export function readChromeVersion(
  executablePath,
  { platform = process.platform, execute = execFileSync } = {},
) {
  if (!isAbsoluteExecutable(executablePath, platform)) {
    throw new Error(`Chrome executable path must be absolute: ${executablePath}`);
  }
  if (platform === "win32") {
    return execute(
      POWERSHELL_EXECUTABLE,
      ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_VERSION_SCRIPT, executablePath],
      { encoding: "utf8", env: TRUSTED_WINDOWS_ENV },
    ).trim();
  }
  return execute(executablePath, ["--version"], { encoding: "utf8" }).trim();
}

export function verifyChromeVersion({
  expectedMajor,
  platform = process.platform,
  findExecutable = findBrowserExecutable,
  execute = execFileSync,
} = {}) {
  if (!/^\d+$/.test(expectedMajor || "")) {
    return {
      ok: false,
      error: "Usage: node scripts/verify-chrome-version.mjs <expectedMajorVersion>",
    };
  }

  const executablePath = findExecutable();
  if (!executablePath) {
    return {
      ok: false,
      error: "::error::Nenhum executavel Chrome/Chromium encontrado neste runner.",
    };
  }
  if (!isAbsoluteExecutable(executablePath, platform)) {
    return {
      ok: false,
      error: `::error::O caminho do Chrome/Chromium deve ser absoluto: ${executablePath}`,
    };
  }

  const rawVersion = readChromeVersion(executablePath, { platform, execute });
  const actualMajor = rawVersion.match(/\d+/)?.[0] ?? "";
  const summary =
    `Chrome/Chromium instalado: "${rawVersion}" ` +
    `(major ${actualMajor || "desconhecido"}, esperado ${expectedMajor})`;
  if (actualMajor !== expectedMajor) {
    return {
      ok: false,
      actualMajor,
      rawVersion,
      summary,
      error:
        `::error::A versao major do Chrome mudou (esperado ${expectedMajor}, ` +
        `encontrado ${actualMajor || "nenhum"}). Atualize chromeMajor e o rotulo do job em ` +
        ".github/workflows/ci.yml.",
    };
  }

  return { ok: true, actualMajor, rawVersion, summary };
}

export function reportChromeVersion(result, { logger = console, runtime = process } = {}) {
  if (result.summary) logger.log(result.summary);
  if (!result.ok) {
    logger.error(result.error);
    runtime.exitCode = 1;
    return false;
  }
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportChromeVersion(verifyChromeVersion({ expectedMajor: process.argv[2] }));
}
