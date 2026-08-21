import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, getTwemojiAssetName } from "../src/utils/countries.js";

const projectRoot = resolve(import.meta.dirname, "..");
const DEFAULT_FILE_SYSTEM = Object.freeze({
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
});

export function buildExtension({
  root = projectRoot,
  argv = process.argv,
  fileSystem = DEFAULT_FILE_SYSTEM,
  now = () => new Date()
} = {}) {
  const outputRoot = resolve(root, "dist", "extension");
  const manifest = JSON.parse(fileSystem.readFileSync(resolve(root, "manifest.json"), "utf8"));
  const firefoxBuild = argv.includes("--firefox");
  // Opera roda em engine Chromium e ignora as mesmas chaves que o Chrome; hoje o manifest e
  // identico ao do Chrome. Flag existe apenas como ponto de extensao para o futuro.
  const operaBuild = argv.includes("--opera");

  if (firefoxBuild) {
    // Firefox ignores background.service_worker and reports it as an AMO warning. The source
    // manifest keeps both keys for Chrome/Firefox dev; Firefox only needs background.scripts.
    delete manifest.background.service_worker;
    delete manifest.background.type;
  }

  fileSystem.rmSync(resolve(root, "dist"), { recursive: true, force: true });
  fileSystem.mkdirSync(outputRoot, { recursive: true });

  for (const entry of ["src", "icons"]) {
    fileSystem.cpSync(resolve(root, entry), resolve(outputRoot, entry), { recursive: true });
  }
  fileSystem.writeFileSync(
    resolve(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  const developmentAssetsOutput = resolve(root, "assets", "twemoji");
  const packagedAssetsOutput = resolve(outputRoot, "assets", "twemoji");
  fileSystem.rmSync(developmentAssetsOutput, { recursive: true, force: true });
  fileSystem.mkdirSync(developmentAssetsOutput, { recursive: true });
  fileSystem.mkdirSync(packagedAssetsOutput, { recursive: true });
  const emojiAssets = new Set([
    getTwemojiAssetName("🌐"),
    getTwemojiAssetName("🏳"),
    ...COUNTRIES.map((country) => getTwemojiAssetName(country.flag))
  ]);
  for (const assetName of emojiAssets) {
    const sourceAsset = resolve(root, "node_modules", "@twemoji", "svg", assetName);
    fileSystem.cpSync(sourceAsset, resolve(developmentAssetsOutput, assetName));
    fileSystem.cpSync(sourceAsset, resolve(packagedAssetsOutput, assetName));
  }
  const attribution =
    "Twemoji graphics by Twitter, Inc. and contributors. Licensed under CC-BY 4.0.\nhttps://github.com/jdecked/twemoji\n";
  fileSystem.writeFileSync(resolve(developmentAssetsOutput, "ATTRIBUTION.txt"), attribution, "utf8");
  fileSystem.writeFileSync(resolve(packagedAssetsOutput, "ATTRIBUTION.txt"), attribution, "utf8");

  // Pastas de assets estáticos versionadas normalmente (diferente do Twemoji, que é
  // gerado a partir de node_modules): só precisam ser copiadas pro pacote final.
  for (const staticAssetsDir of ["donation-qrcodes", "onboarding"]) {
    const sourceDir = resolve(root, "assets", staticAssetsDir);
    if (fileSystem.existsSync(sourceDir)) {
      fileSystem.cpSync(sourceDir, resolve(outputRoot, "assets", staticAssetsDir), { recursive: true });
    }
  }

  const buildTarget = firefoxBuild ? "firefox" : operaBuild ? "opera" : "chrome";
  fileSystem.writeFileSync(
    resolve(root, "dist", "BUILD_INFO.txt"),
    `Quick WhatsApp Contact ${manifest.version}\nTarget: ${buildTarget}\nBuilt at ${now().toISOString()}\n`,
    "utf8"
  );

  return { outputRoot, manifestVersion: manifest.version, emojiAssetsCount: emojiAssets.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outputRoot, manifestVersion, emojiAssetsCount } = buildExtension();
  console.log(`Extension ${manifestVersion} built at ${outputRoot} with ${emojiAssetsCount} local Twemoji assets`);
}
