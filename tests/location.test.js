import { detectCountryCodeFromBrowserLocation, detectCountryCodeFromUrl } from "../src/utils/location.js";
import { describe, expect, it } from "vitest";

describe("browser location detection", () => {
  it("uses region code from primary language when available", () => {
    expect(
      detectCountryCodeFromBrowserLocation({
        languages: ["pt-BR", "en-US"],
        language: "en-US"
      })
    ).toBe("BR");
  });

  it("normalizes UK to GB", () => {
    expect(
      detectCountryCodeFromBrowserLocation({
        languages: ["en-UK"],
        language: "en-UK"
      })
    ).toBe("GB");
  });

  it("supports locale with underscore", () => {
    expect(
      detectCountryCodeFromBrowserLocation({
        languages: ["en_GB"],
        language: "en-US"
      })
    ).toBe("US");
  });

  it("uses fallback US when country cannot be detected", () => {
    expect(
      detectCountryCodeFromBrowserLocation({
        languages: ["en"],
        language: "en"
      })
    ).toBe("US");
  });
});

describe("URL TLD detection", () => {
  it("detects BR from .br and .com.br", () => {
    expect(detectCountryCodeFromUrl("https://example.com.br/path")).toBe("BR");
    expect(detectCountryCodeFromUrl("http://gov.br")).toBe("BR");
  });

  it("detects PT from .pt", () => {
    expect(detectCountryCodeFromUrl("https://www.site.pt")).toBe("PT");
  });

  it("detects uppercase TLD", () => {
    expect(detectCountryCodeFromUrl("https://dominio.COM.BR")).toBe("BR");
    expect(detectCountryCodeFromUrl("https://dominio.PT")).toBe("PT");
  });

  it("returns empty string for non-country specific TLDs like .com or .org", () => {
    expect(detectCountryCodeFromUrl("https://google.com")).toBe("");
    expect(detectCountryCodeFromUrl("https://wikipedia.org")).toBe("");
  });

  it("returns empty string for invalid URLs", () => {
    expect(detectCountryCodeFromUrl("not-a-url")).toBe("");
    expect(detectCountryCodeFromUrl("")).toBe("");
    expect(detectCountryCodeFromUrl(null)).toBe("");
  });

  it.each([
    "https://trusted.pt.attacker.com",
    "https://attacker.com/path/site.pt",
    "https://pt.attacker.invalid",
    "javascript://trusted.pt/%0Aalert(1)",
    "data:text/html,https://trusted.pt"
  ])("does not infer a country from a deceptive URL: %s", (url) => {
    expect(detectCountryCodeFromUrl(url)).toBe("");
  });

  it("uses only the parsed hostname, not credentials that resemble a country domain", () => {
    expect(detectCountryCodeFromUrl("https://trusted.pt@attacker.com/path")).toBe("");
  });
});
