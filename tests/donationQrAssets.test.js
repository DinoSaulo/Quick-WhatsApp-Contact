import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DONATION_METHODS } from "../src/utils/donation.js";

const projectRoot = resolve(import.meta.dirname, "..");
const methodsWithRealPayload = DONATION_METHODS.filter((method) => method.copyText);
const generatedSvgMethods = methodsWithRealPayload.filter((method) => method.qrAsset.endsWith(".svg"));
const staticImageMethods = methodsWithRealPayload.filter((method) => !method.qrAsset.endsWith(".svg"));

describe("donation QR code assets", () => {
  it("has at least one donation method with a real payload to show a QR for", () => {
    // Falha alto se algum dia todos os métodos ficarem vazios (regressão silenciosa).
    expect(methodsWithRealPayload.length).toBeGreaterThan(0);
  });

  it.each(methodsWithRealPayload.map((method) => [method.id, method.qrAsset]))(
    "asset exists for %s at %s",
    (_id, qrAsset) => {
      expect(existsSync(resolve(projectRoot, qrAsset)), qrAsset).toBe(true);
    }
  );

  it.each(generatedSvgMethods.map((method) => [method.id, method.qrAsset]))(
    "generated SVG for %s is self-contained, without scripts or external references",
    (_id, qrAsset) => {
      const svg = readFileSync(resolve(projectRoot, qrAsset), "utf8");
      expect(svg, qrAsset).toMatch(/^<svg\b/);
      expect(svg, qrAsset).not.toMatch(/<script\b/i);
      expect(svg, qrAsset).not.toMatch(/(?:href|src)=["']https?:/i);
    }
  );

  it.each(staticImageMethods.map((method) => [method.id, method.qrAsset]))(
    "manually-supplied image for %s is a real, non-empty %s file",
    (_id, qrAsset) => {
      const buffer = readFileSync(resolve(projectRoot, qrAsset));
      expect(buffer.length, qrAsset).toBeGreaterThan(0);

      const extension = extname(qrAsset).toLowerCase();
      if (extension === ".png") {
        const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect(buffer.subarray(0, 8).equals(pngMagicBytes), qrAsset).toBe(true);
      }
    }
  );
});
