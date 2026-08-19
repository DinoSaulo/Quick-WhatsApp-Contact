// Wraps dist/extension (already built by "npm run build" at Level 1 — never rebuilt here) into a
// macOS Safari Web Extension app via xcrun's converter, then compiles it with xcodebuild.

// Prints the built .app's absolute path on stdout, for the workflow step to capture as SAFARI_APP_PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const extensionPath = resolve(projectRoot, "dist", "extension");
const manifestPath = resolve(extensionPath, "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error(
    `Build da extensão não encontrado em ${manifestPath}. Baixe o artefato extension-build (ou rode "npm run build") antes.`,
  );
}

const APP_NAME = "Quick WhatsApp Contact";
// CI-only identifier — never used for a signed/published build, so it doesn't need to match
// whatever bundle ID a future real Mac App Store submission would use.
const BUNDLE_ID = "dev.dinosaulo.quickwhatsappcontact.safari-ci";

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

// Ad-hoc signing, not disabled: ValidateEmbeddedBinary checks the .appex's signature even with
// CODE_SIGNING_ALLOWED=NO (confirmed by a real CI failure); "-" is Xcode's no-certificate identity.
execFileSync(
  "xcodebuild",
  [
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
    "build",
  ],
  { stdio: "inherit" },
);

const appPath = resolve(derivedDataPath, "Build", "Products", "Release", `${APP_NAME}.app`);

if (!existsSync(appPath)) {
  throw new Error(`xcodebuild reportou sucesso, mas ${appPath} não existe.`);
}

console.log(appPath);
