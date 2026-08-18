import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COUNTRIES, getTwemojiAssetName } from "../src/utils/countries.js";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "dist", "extension");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));
const firefoxBuild = process.argv.includes("--firefox");

if (firefoxBuild) {
  // Firefox ignores background.service_worker and reports it as an AMO warning. The source
  // manifest keeps both keys for Chrome/Firefox development; the Firefox artifact only needs background.scripts, which is the supported Firefox form.
  delete manifest.background.service_worker;
  delete manifest.background.type;
}

rmSync(resolve(projectRoot, "dist"), { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const entry of ["src", "icons"]) {
  cpSync(resolve(projectRoot, entry), resolve(outputRoot, entry), { recursive: true });
}
writeFileSync(resolve(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const developmentAssetsOutput = resolve(projectRoot, "assets", "twemoji");
const packagedAssetsOutput = resolve(outputRoot, "assets", "twemoji");
rmSync(developmentAssetsOutput, { recursive: true, force: true });
mkdirSync(developmentAssetsOutput, { recursive: true });
mkdirSync(packagedAssetsOutput, { recursive: true });
const emojiAssets = new Set([
  getTwemojiAssetName("🌐"),
  getTwemojiAssetName("🏳"),
  ...COUNTRIES.map((country) => getTwemojiAssetName(country.flag))
]);
for (const assetName of emojiAssets) {
  const sourceAsset = resolve(projectRoot, "node_modules", "@twemoji", "svg", assetName);
  cpSync(sourceAsset, resolve(developmentAssetsOutput, assetName));
  cpSync(sourceAsset, resolve(packagedAssetsOutput, assetName));
}
const attribution =
  "Twemoji graphics by Twitter, Inc. and contributors. Licensed under CC-BY 4.0.\nhttps://github.com/jdecked/twemoji\n";
writeFileSync(resolve(developmentAssetsOutput, "ATTRIBUTION.txt"), attribution, "utf8");
writeFileSync(resolve(packagedAssetsOutput, "ATTRIBUTION.txt"), attribution, "utf8");

// Pastas de assets estáticos versionadas normalmente (diferente do Twemoji, que é
// gerado a partir de node_modules): só precisam ser copiadas pro pacote final.
for (const staticAssetsDir of ["donation-qrcodes", "onboarding"]) {
  const sourceDir = resolve(projectRoot, "assets", staticAssetsDir);
  if (existsSync(sourceDir)) {
    cpSync(sourceDir, resolve(outputRoot, "assets", staticAssetsDir), { recursive: true });
  }
}

writeFileSync(
  resolve(projectRoot, "dist", "BUILD_INFO.txt"),
  `Quick WhatsApp Contact ${manifest.version}\nTarget: ${firefoxBuild ? "firefox" : "chrome"}\nBuilt at ${new Date().toISOString()}\n`,
  "utf8"
);

console.log(
  `Extension ${manifest.version} built at ${outputRoot} with ${emojiAssets.size} local Twemoji assets`
);
