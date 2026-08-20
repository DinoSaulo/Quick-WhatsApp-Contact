import { describe, expect, it, vi } from "vitest";
import {
  reportStoreReadiness,
  validateStoreReadiness,
} from "../scripts/validate-store-readiness.mjs";
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

function validManifest() {
  return {
    manifest_version: 3,
    name: "Quick WhatsApp Contact",
    version: "1.1.0",
    description: "Ready for publication",
    homepage_url: "https://github.com/DinoSaulo/Quick-WhatsApp-Contact",
  };
}

describe("validateStoreReadiness", () => {
  it("accepts a complete store fixture without warnings", () => {
    const readFile = (path, encoding) => {
      if (encoding === "utf8") {
        if (path.endsWith("manifest.json")) return JSON.stringify(validManifest());
        return path.endsWith("PRIVACY.md") ? "Uso Limitado" : "Ready for publication";
      }
      if (path.endsWith("icon128.png")) return buildPngBuffer({ width: 128, height: 128 });
      if (path.endsWith("small-promo-440x280.png")) {
        return buildPngBuffer({ width: 440, height: 280 });
      }
      return buildPngBuffer({ width: 1280, height: 800 });
    };

    const result = validateStoreReadiness({
      root: "/project",
      exists: () => true,
      readFile,
      readDirectory: () => ["screen.PNG", "notes.txt"],
    });

    expect(result).toEqual({ errors: [], screenshots: ["screen.PNG"], warnings: [] });
  });

  it("reports missing assets, invalid publication copy and the optional marquee warning", () => {
    const exists = (path) =>
      !path.endsWith("icon128.png") &&
      !path.endsWith("screenshots") &&
      !path.endsWith(".nojekyll") &&
      !path.endsWith("marquee-1400x560.png");
    const readFile = (path, encoding) => {
      if (encoding === "utf8") {
        if (path.endsWith("manifest.json")) return JSON.stringify({});
        return "TODO(owner): A DEFINIR";
      }
      return buildPngBuffer({ signature: "0000000000000000", width: 1, height: 1 });
    };

    const result = validateStoreReadiness({ root: "/project", exists, readFile });

    expect(result.errors).toContain("Missing required image: icons/icon128.png");
    expect(result.errors).toContain("Add at least one real screenshot to store-assets/screenshots/");
    expect(result.errors).toContain("docs/.nojekyll is required for Pages from /docs");
    expect(result.warnings).toEqual(["Optional 1400x560 marquee image is not present"]);
  });

  it("rejects more than five screenshots and invalid screenshot dimensions", () => {
    const screenshots = Array.from({ length: 6 }, (_, index) => `screen-${index}.png`);
    const readFile = (path, encoding) => {
      if (encoding === "utf8") {
        if (path.endsWith("manifest.json")) return JSON.stringify(validManifest());
        return path.endsWith("PRIVACY.md") ? "Uso Limitado" : "Ready for publication";
      }
      if (path.endsWith("icon128.png")) return buildPngBuffer({ width: 128, height: 128 });
      if (path.endsWith("small-promo-440x280.png")) {
        return buildPngBuffer({ width: 440, height: 280 });
      }
      return buildPngBuffer({ width: 800, height: 600 });
    };

    const result = validateStoreReadiness({
      root: "/project",
      exists: () => true,
      readFile,
      readDirectory: () => screenshots,
    });

    expect(result.errors).toContain("Chrome Web Store accepts at most five screenshots");
    expect(result.errors.filter((message) => message.includes("must be 1280x800"))).toHaveLength(6);
  });

  it("reports warnings and both possible CLI outcomes", () => {
    const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
    const runtime = {};

    expect(
      reportStoreReadiness(
        { errors: [], screenshots: ["screen.png"], warnings: ["optional missing"] },
        { logger, runtime },
      ),
    ).toBe(true);
    expect(
      reportStoreReadiness(
        { errors: ["invalid"], screenshots: [], warnings: [] },
        { logger, runtime },
      ),
    ).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith("Warning: optional missing");
    expect(logger.log).toHaveBeenCalledWith("Store readiness passed with 1 screenshot(s).");
    expect(logger.error).toHaveBeenCalledWith("Store readiness failed:\n- invalid");
    expect(runtime.exitCode).toBe(1);
  });
});

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
