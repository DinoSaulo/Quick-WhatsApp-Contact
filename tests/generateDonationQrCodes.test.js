import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { generateDonationQrCodes } from "../scripts/generate-donation-qrcodes.mjs";

function createHarness() {
  return {
    fileSystem: { mkdirSync: vi.fn(), writeFileSync: vi.fn() },
    toSvg: vi.fn(async (copyText) => `<svg>${copyText}</svg>`),
    logger: { warn: vi.fn() }
  };
}

describe("generateDonationQrCodes", () => {
  it("generates an SVG for every method with an .svg qrAsset and non-empty copyText", async () => {
    const harness = createHarness();
    const methods = [{ id: "pix", copyText: "00020126...", qrAsset: "assets/donation-qrcodes/pix.svg" }];

    const result = await generateDonationQrCodes({ root: "/project", methods, ...harness });

    expect(result).toEqual({ generated: 1, skipped: 0 });
    expect(harness.toSvg).toHaveBeenCalledWith("00020126...");
    expect(harness.fileSystem.writeFileSync).toHaveBeenCalledWith(
      resolve("/project", "assets", "donation-qrcodes", "pix.svg"),
      "<svg>00020126...</svg>",
      "utf8"
    );
  });

  it("skips a method whose qrAsset is a manually-provided image, not an SVG this script owns", async () => {
    const harness = createHarness();
    const methods = [{ id: "paypal", copyText: "user@example.com", qrAsset: "assets/donation-qrcodes/paypal.png" }];

    const result = await generateDonationQrCodes({ root: "/project", methods, ...harness });

    expect(result).toEqual({ generated: 0, skipped: 1 });
    expect(harness.toSvg).not.toHaveBeenCalled();
    expect(harness.logger.warn).toHaveBeenCalledWith(expect.stringContaining('"paypal"'));
  });

  it("skips a method with an empty copyText instead of generating a blank QR code", async () => {
    const harness = createHarness();
    const methods = [{ id: "mbway", copyText: "", qrAsset: "assets/donation-qrcodes/mbway.svg" }];

    const result = await generateDonationQrCodes({ root: "/project", methods, ...harness });

    expect(result).toEqual({ generated: 0, skipped: 1 });
    expect(harness.toSvg).not.toHaveBeenCalled();
    expect(harness.logger.warn).toHaveBeenCalledWith(expect.stringContaining("copyText vazio"));
  });

  it("tallies generated and skipped counts independently across a mixed list", async () => {
    const harness = createHarness();
    const methods = [
      { id: "pix", copyText: "00020126...", qrAsset: "assets/donation-qrcodes/pix.svg" },
      { id: "mbway", copyText: "", qrAsset: "assets/donation-qrcodes/mbway.svg" },
      { id: "paypal", copyText: "user@example.com", qrAsset: "assets/donation-qrcodes/paypal.png" }
    ];

    const result = await generateDonationQrCodes({ root: "/project", methods, ...harness });

    expect(result).toEqual({ generated: 1, skipped: 2 });
  });

  it("creates the output directory before generating any QR code", async () => {
    const harness = createHarness();

    await generateDonationQrCodes({ root: "/project", methods: [], ...harness });

    expect(harness.fileSystem.mkdirSync).toHaveBeenCalledWith(
      resolve("/project", "assets", "donation-qrcodes"),
      { recursive: true }
    );
  });

  // No toSvg override: exercises the real `qrcode` library end to end, not just the plumbing
  // around it — a fast, deterministic computation with no network or filesystem side effects.
  it("generates a real, valid SVG QR code via the default qrcode encoder", async () => {
    const fileSystem = { mkdirSync: vi.fn(), writeFileSync: vi.fn() };
    const methods = [{ id: "pix", copyText: "hello", qrAsset: "assets/donation-qrcodes/pix.svg" }];

    await generateDonationQrCodes({ root: "/project", methods, fileSystem, logger: { warn: vi.fn() } });

    const [, svg] = fileSystem.writeFileSync.mock.calls[0];
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
