import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function pngMetadata(relativePath) {
  const bytes = readFileSync(resolve(projectRoot, relativePath));
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  expect(bytes.subarray(0, 8)).toEqual(pngSignature);
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

function pngCornerAlpha(relativePath) {
  const bytes = readFileSync(resolve(projectRoot, relativePath));
  const { width, height, colorType } = pngMetadata(relativePath);
  const idatChunks = [];

  expect(bytes.readUInt8(24)).toBe(8);
  expect(colorType).toBe(6);
  expect(bytes.readUInt8(28)).toBe(0);

  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");

    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }

    offset += length + 12;
  }

  const compressedRows = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left, above, upperLeft) => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);

    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
      return left;
    }
    return aboveDistance <= upperLeftDistance ? above : upperLeft;
  };

  for (let row = 0; row < height; row += 1) {
    const sourceOffset = row * (stride + 1);
    const filter = compressedRows[sourceOffset];
    const targetOffset = row * stride;

    if (filter > 4) {
      throw new Error(`Unsupported PNG filter ${filter} in ${relativePath}`);
    }

    for (let column = 0; column < stride; column += 1) {
      const raw = compressedRows[sourceOffset + column + 1];
      const left = column >= bytesPerPixel ? pixels[targetOffset + column - bytesPerPixel] : 0;
      const above = row > 0 ? pixels[targetOffset + column - stride] : 0;
      const upperLeft = row > 0 && column >= bytesPerPixel
        ? pixels[targetOffset + column - stride - bytesPerPixel]
        : 0;
      let predictor = 0;

      if (filter === 1) predictor = left;
      if (filter === 2) predictor = above;
      if (filter === 3) predictor = Math.floor((left + above) / 2);
      if (filter === 4) predictor = paeth(left, above, upperLeft);

      pixels[targetOffset + column] = (raw + predictor) & 0xff;
    }
  }

  return [
    pixels[3],
    pixels[stride - 1],
    pixels[(height - 1) * stride + 3],
    pixels[height * stride - 1],
  ];
}

describe("extension branding assets", () => {
  it("uses maximum-fill assets for the Chrome toolbar action", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(projectRoot, "manifest.json"), "utf8"),
    );

    expect(manifest.action.default_icon).toEqual({
      16: "icons/toolbar16.png",
      24: "icons/toolbar24.png",
      32: "icons/toolbar32.png",
    });
  });

  it.each([
    ["icons/icon16.png", 16],
    ["icons/icon48.png", 48],
    ["icons/icon128.png", 128],
    ["icons/logo-generated-512.png", 512],
    ["icons/toolbar16.png", 16],
    ["icons/toolbar24.png", 24],
    ["icons/toolbar32.png", 32],
  ])("keeps %s as an exact square PNG", (relativePath, size) => {
    expect(pngMetadata(relativePath)).toMatchObject({
      width: size,
      height: size,
    });
  });

  it.each([
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "icons/logo-generated-512.png",
    "icons/toolbar16.png",
    "icons/toolbar24.png",
    "icons/toolbar32.png",
  ])("keeps %s in RGBA format for a transparent background", (relativePath) => {
    expect(pngMetadata(relativePath).colorType).toBe(6);
    expect(pngCornerAlpha(relativePath)).toEqual([0, 0, 0, 0]);
  });

  it("centers the branded image in the README", () => {
    const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");

    expect(readme).toMatch(
      /<p align="center">[\s\S]*icons\/logo-generated-512\.png[\s\S]*<\/p>/,
    );
  });

  it("renders the branded image in a centered options-page container", () => {
    const html = readFileSync(
      resolve(projectRoot, "src", "options", "options.html"),
      "utf8",
    );
    const styles = readFileSync(
      resolve(projectRoot, "src", "options", "options.css"),
      "utf8",
    );

    expect(html).toMatch(
      /class="options-brand"[\s\S]*\.\.\/\.\.\/icons\/logo-generated-512\.png/,
    );
    expect(styles).toMatch(
      /\.options-brand\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;/s,
    );
  });
});
