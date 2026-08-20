import { describe, expect, it } from "vitest";
import {
  isAcceptedScreenshotSize,
  parsePngSize,
  PUBLICATION_PLACEHOLDER_PATTERN,
  validateManifest
} from "./store-readiness-checks.mjs";

// A minimal valid 1x1 PNG: signature + IHDR chunk declaring width=1, height=1.
function buildPngBuffer({ signature = "89504e470d0a1a0a", width = 1, height = 1 } = {}) {
  const buffer = Buffer.alloc(24);
  buffer.write(signature, 0, "hex");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("parsePngSize", () => {
  it("reads width/height from a valid PNG signature", () => {
    expect(parsePngSize(buildPngBuffer({ width: 128, height: 128 }))).toEqual({
      isPng: true,
      width: 128,
      height: 128
    });
  });

  it("flags a buffer with the wrong signature as not a PNG", () => {
    const buffer = buildPngBuffer({ signature: "ffd8ffe000104a464946" });
    expect(parsePngSize(buffer).isPng).toBe(false);
  });
});

describe("isAcceptedScreenshotSize", () => {
  it("accepts the 1280x800 landscape size", () => {
    expect(isAcceptedScreenshotSize({ width: 1280, height: 800 })).toBe(true);
  });

  it("accepts the 640x400 landscape size", () => {
    expect(isAcceptedScreenshotSize({ width: 640, height: 400 })).toBe(true);
  });

  it("rejects a mismatched pairing of accepted individual dimensions", () => {
    expect(isAcceptedScreenshotSize({ width: 1280, height: 400 })).toBe(false);
  });

  it("rejects an arbitrary unaccepted size", () => {
    expect(isAcceptedScreenshotSize({ width: 800, height: 600 })).toBe(false);
  });
});

describe("validateManifest", () => {
  const validManifest = () => ({
    manifest_version: 3,
    name: "Quick WhatsApp Contact",
    version: "1.1.0",
    description: "A".repeat(50),
    homepage_url: "https://github.com/DinoSaulo/Quick-WhatsApp-Contact"
  });

  it("returns no errors for a fully valid manifest", () => {
    expect(validateManifest(validManifest())).toEqual([]);
  });

  it("flags a manifest_version other than 3", () => {
    expect(validateManifest({ ...validManifest(), manifest_version: 2 })).toContain(
      "manifest.json must use Manifest V3"
    );
  });

  it("flags a missing name", () => {
    expect(validateManifest({ ...validManifest(), name: "" })).toContain(
      "manifest.json must include name"
    );
  });

  it("flags a missing version", () => {
    expect(validateManifest({ ...validManifest(), version: "" })).toContain(
      "manifest.json must include version"
    );
  });

  it("flags an empty description", () => {
    expect(validateManifest({ ...validManifest(), description: "" })).toContain(
      "manifest description must contain 1-132 characters"
    );
  });

  it("accepts a description at exactly the 132-character limit", () => {
    expect(validateManifest({ ...validManifest(), description: "A".repeat(132) })).toEqual([]);
  });

  it("flags a description one character past the 132-character limit", () => {
    expect(validateManifest({ ...validManifest(), description: "A".repeat(133) })).toContain(
      "manifest description must contain 1-132 characters"
    );
  });

  it("flags a homepage_url using http instead of https", () => {
    expect(
      validateManifest({ ...validManifest(), homepage_url: "http://example.com" })
    ).toContain("homepage_url must be a public HTTPS URL");
  });

  it("flags a missing homepage_url", () => {
    expect(validateManifest({ ...validManifest(), homepage_url: undefined })).toContain(
      "homepage_url must be a public HTTPS URL"
    );
  });

  it("returns every violated rule at once, not just the first", () => {
    const errors = validateManifest({ manifest_version: 2, name: "", version: "", description: "" });
    expect(errors).toHaveLength(5);
  });
});

describe("PUBLICATION_PLACEHOLDER_PATTERN", () => {
  it.each([
    ["[e-mail]"],
    ["[email]"],
    ["A DEFINIR"],
    ["TO BE FILLED"],
    ["TODO(owner)"]
  ])("matches the placeholder marker %s", (marker) => {
    expect(PUBLICATION_PLACEHOLDER_PATTERN.test(`Contact us at ${marker} for support.`)).toBe(true);
  });

  it("does not match real, filled-in publication copy", () => {
    expect(PUBLICATION_PLACEHOLDER_PATTERN.test("Contact us at support@example.com")).toBe(false);
  });
});
