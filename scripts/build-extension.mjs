import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COUNTRIES, getTwemojiAssetName } from "../src/utils/countries.js";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "dist", "extension");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));

rmSync(resolve(projectRoot, "dist"), { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const entry of ["manifest.json", "src", "icons"]) {
  cpSync(resolve(projectRoot, entry), resolve(outputRoot, entry), { recursive: true });
}

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

writeFileSync(
  resolve(projectRoot, "dist", "BUILD_INFO.txt"),
  `Quick WhatsApp Contact ${manifest.version}\nBuilt at ${new Date().toISOString()}\n`,
  "utf8"
);

console.log(
  `Extension ${manifest.version} built at ${outputRoot} with ${emojiAssets.size} local Twemoji assets`
);
