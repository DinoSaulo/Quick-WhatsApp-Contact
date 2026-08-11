import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  getTwemojiAssetName
} from "../src/utils/countries.js";

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8")
);
const twemojiRoot = resolve(projectRoot, "node_modules", "@twemoji", "svg");
const requiredAssets = new Set([
  getTwemojiAssetName("🌐"),
  getTwemojiAssetName("🏳"),
  ...COUNTRIES.map((country) => getTwemojiAssetName(country.flag))
]);

describe("packaged Twemoji asset catalog", () => {
  it("pins the asset-only package as a development dependency", () => {
    expect(packageJson.devDependencies["@twemoji/svg"]).toBe("15.0.0");
    expect(packageJson.dependencies?.["@twemoji/svg"]).toBeUndefined();
  });

  it("maps every supported country to a safe SVG filename", () => {
    for (const country of COUNTRIES) {
      const assetName = getTwemojiAssetName(country.flag);
      expect(assetName, country.code).toMatch(/^[a-f0-9]+-[a-f0-9]+\.svg$/);
      expect(assetName, country.code).not.toContain("..");
      expect(assetName, country.code).not.toContain("/");
    }
  });

  it("contains every flag, fallback and automatic icon in the installed package", () => {
    expect(requiredAssets.size).toBeGreaterThanOrEqual(200);

    for (const assetName of requiredAssets) {
      expect(existsSync(resolve(twemojiRoot, assetName)), assetName).toBe(true);
    }
  });

  it("uses self-contained SVGs without scripts or external image references", () => {
    for (const assetName of requiredAssets) {
      const svg = readFileSync(resolve(twemojiRoot, assetName), "utf8");
      expect(svg, assetName).toMatch(/^<svg\b/);
      expect(svg, assetName).not.toMatch(/<script\b/i);
      expect(svg, assetName).not.toMatch(/(?:href|src)=["']https?:/i);
    }
  });
});
