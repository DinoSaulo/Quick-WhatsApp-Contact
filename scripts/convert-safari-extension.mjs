// Wraps dist/extension (already built by "npm run build" at Level 1 — never rebuilt here) into a
// macOS Safari Web Extension app via xcrun's converter, then compiles it with xcodebuild.

// Prints the built .app's absolute path on stdout, for the workflow step to capture as SAFARI_APP_PATH.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error(
    `Build da extensão não encontrado em ${manifestPath}. Baixe o artefato extension-build (ou rode "npm run build") antes.`,
  );
}

const APP_NAME = "Quick WhatsApp Contact";
// Real CI failure's root cause: host app ID = <prefix>.<sanitized APP_NAME>, extension ID =
// "<BUNDLE_ID>.Extension" verbatim — a fixed last component made them cousins, not parent/child.
const BUNDLE_ID_BASE = "dev.dinosaulo.quickwhatsappcontact";
const BUNDLE_ID = `${BUNDLE_ID_BASE}.${APP_NAME.replace(/\s+/g, "-")}`;

const outputRoot = resolve(projectRoot, ".safari-build");
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

// --macos-only skips generating an iOS target (and its simulator/signing requirements), which this
// CI smoke test never needs. --no-open/--force keep the tool non-interactive and idempotent.
execFileSync(
  "xcrun",
  [
    "safari-web-extension-converter",
    extensionPath,
    "--project-location",
    outputRoot,
    "--app-name",
    APP_NAME,
    "--bundle-identifier",
    BUNDLE_ID,
    "--macos-only",
    "--no-open",
    "--force",
    "--swift",
  ],
  { stdio: "inherit" },
);

const projectSearch = execFileSync(
  "find",
  [outputRoot, "-maxdepth", "3", "-name", "*.xcodeproj"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

if (projectSearch.length !== 1) {
  throw new Error(
    `Esperava exatamente 1 .xcodeproj gerado sob ${outputRoot}, encontrei ${projectSearch.length}: ${projectSearch.join(", ")}`,
  );
}

const xcodeprojPath = projectSearch[0];
const derivedDataPath = resolve(outputRoot, "DerivedData");

const diagnosticsRoot = resolve(projectRoot, "ci-diagnostics");
mkdirSync(diagnosticsRoot, { recursive: true });
const xcodebuildLogFile = resolve(diagnosticsRoot, "safari-xcodebuild.log");

// Ad-hoc signing, not disabled: ValidateEmbeddedBinary checks the .appex's signature even with
// CODE_SIGNING_ALLOWED=NO (confirmed by a real CI failure); "-" is Xcode's no-certificate identity.

// -verbose + captured (not inherited) output: xcodebuild otherwise only prints phase names like
// "ValidateEmbeddedBinary ... (2 failures)" on a plain failure, with no further detail anywhere else.
const xcodebuildArgs = [
  "-project",
  xcodeprojPath,
  "-scheme",
  APP_NAME,
  "-configuration",
  "Release",
  "-derivedDataPath",
  derivedDataPath,
  "CODE_SIGNING_ALLOWED=YES",
  "CODE_SIGNING_REQUIRED=NO",
  "CODE_SIGN_IDENTITY=-",
  "CODE_SIGN_STYLE=Manual",
  "-verbose",
  "build",
];

const xcodebuildResult = spawnSync("xcodebuild", xcodebuildArgs, { encoding: "utf8" });
const xcodebuildOutput = `${xcodebuildResult.stdout ?? ""}${xcodebuildResult.stderr ?? ""}`;
writeFileSync(xcodebuildLogFile, xcodebuildOutput, "utf8");
// stderr, not stdout: ci.yml captures this script's stdout via $(...) as SAFARI_APP_PATH, so the
// transcript must never land there — it would corrupt that variable with the whole log's text.
console.error(xcodebuildOutput);

// Xcode's own binary build log has richer per-phase detail than even -verbose's stdout/stderr for
// some failures. Best-effort, raw copy only (no parsing of its gzipped format) — never fatal.
try {
  const activityLogs = execFileSync(
    "find",
    [resolve(derivedDataPath, "Logs", "Build"), "-name", "*.xcactivitylog"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  for (const logPath of activityLogs) {
    copyFileSync(logPath, resolve(diagnosticsRoot, basename(logPath)));
  }
} catch (activityLogError) {
  console.warn(`⚠️  Não foi possível copiar diagnósticos .xcactivitylog: ${activityLogError.message}`);
}

if (xcodebuildResult.status !== 0) {
  throw new Error(
    `xcodebuild falhou (exit ${xcodebuildResult.status ?? "null"}, signal ${xcodebuildResult.signal ?? "none"}). ` +
      `Log completo em ${xcodebuildLogFile}.`,
  );
}

const appPath = resolve(derivedDataPath, "Build", "Products", "Release", `${APP_NAME}.app`);

if (!existsSync(appPath)) {
  throw new Error(`xcodebuild reportou sucesso, mas ${appPath} não existe.`);
}

console.log(appPath);
