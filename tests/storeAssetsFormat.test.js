import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function pngMetadata(relativePath) {
  const bytes = readFileSync(resolve(projectRoot, relativePath));
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25)
  };
}

describe("Chrome Web Store image formats", () => {
  it.each([
    ["store-assets/small-promo-440x280.png", 440, 280],
    ["store-assets/small-promo-real-ui-440x280.png", 440, 280],
    ["store-assets/marquee-real-ui-1400x560.png", 1400, 560],
    ["store-assets/screenshots/real-ui-workflow-1280x800.png", 1280, 800],
    ["store-assets/screenshots/real-ui-popup-1280x800.png", 1280, 800],
    ["store-assets/screenshots/real-ui-chat-flow-1280x800.png", 1280, 800]
  ])("keeps %s at the declared store dimensions", (relativePath, width, height) => {
    expect(existsSync(resolve(projectRoot, relativePath))).toBe(true);
    expect(pngMetadata(relativePath)).toMatchObject({ width, height });
  });

  it.each([
    "store-assets/small-promo-440x280.png",
    "store-assets/small-promo-real-ui-440x280.png",
    "store-assets/marquee-real-ui-1400x560.png",
    "store-assets/screenshots/real-ui-workflow-1280x800.png",
    "store-assets/screenshots/real-ui-popup-1280x800.png",
    "store-assets/screenshots/real-ui-chat-flow-1280x800.png"
  ])("uses a 24-bit RGB PNG without alpha for %s", (relativePath) => {
    expect(pngMetadata(relativePath).colorType).toBe(2);
  });
});
