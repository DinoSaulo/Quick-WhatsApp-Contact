import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));

// Guards the Chrome Web Store publishing groundwork (see docs/STORE_READINESS.md and
// docs/RELEASE_CHECKLIST.md) — cheap checks that the pieces this repo is responsible for
// (as opposed to Developer Dashboard account settings, which live outside the repo) stay
// present and mutually consistent as the docs get edited.
describe("Chrome Web Store publishing groundwork", () => {
  it("disables Jekyll processing so docs/privacy.html is served byte-for-byte by GitHub Pages", () => {
    expect(existsSync(resolve(projectRoot, "docs/.nojekyll"))).toBe(true);
  });

  it("publishes a standalone, styled privacy policy page alongside the source PRIVACY.md", () => {
    const html = readFileSync(resolve(projectRoot, "docs/privacy.html"), "utf8");

    expect(html).toContain("<title>Política de Privacidade");
    expect(html).toContain("chrome.storage.sync");
    expect(html).toContain("chrome.storage.session");
  });

  it("keeps PRIVACY.md and docs/privacy.html pointing at the same published URL", () => {
    const privacyMd = readFileSync(resolve(projectRoot, "PRIVACY.md"), "utf8");
    const publishedUrl = "https://dinosaulo.github.io/Quick-WhatsApp-Contact/privacy.html";

    expect(privacyMd).toContain(publishedUrl);
    expect(readFileSync(resolve(projectRoot, "docs/STORE_LISTING.md"), "utf8")).toContain(publishedUrl);
  });

  it("points manifest homepage_url at the same repository the privacy policy is published from", () => {
    expect(manifest.homepage_url).toBe("https://github.com/DinoSaulo/Quick-WhatsApp-Contact");
  });

  it("has store listing copy ready to paste into the Developer Dashboard", () => {
    expect(existsSync(resolve(projectRoot, "docs/STORE_LISTING.md"))).toBe(true);
  });

  it("includes the mandatory 440x280 small promotional tile", () => {
    const image = readFileSync(resolve(projectRoot, "store-assets/small-promo-440x280.png"));

    expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(image.readUInt32BE(16)).toBe(440);
    expect(image.readUInt32BE(20)).toBe(280);
  });

  it("documents how to capture a real, policy-compliant store screenshot", () => {
    const instructions = readFileSync(resolve(projectRoot, "store-assets/README.md"), "utf8");

    expect(instructions).toContain("1280×800");
    expect(instructions).toContain("Do not use an AI-generated UI");
  });
});
