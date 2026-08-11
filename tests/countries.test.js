import {
  COUNTRIES,
  getCountryByCode,
  getDefaultCountryCodeForLanguage,
  getTwemojiAssetName,
  renderEmojiHtml,
  renderCountryFlagHtml
} from "../src/utils/countries.js";
import { describe, expect, it } from "vitest";

describe("countries ddi list", () => {
  it("keeps an extensive list of countries and territories", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(200);
  });

  it("includes DDI options for Puerto Rico", () => {
    const puertoRico = COUNTRIES.filter((country) => country.name === "Porto Rico");
    expect(puertoRico.map((country) => country.dialCode)).toEqual(["1-787", "1-939"]);
  });

  it("includes DDI options for Dominican Republic", () => {
    const dominicanRepublic = COUNTRIES.filter(
      (country) => country.name === "Republica Dominicana"
    );
    expect(dominicanRepublic.map((country) => country.dialCode)).toEqual([
      "1-809",
      "1-829",
      "1-849"
    ]);
  });

  it("resolves Brazil by country code", () => {
    expect(getCountryByCode("BR")?.dialCode).toBe("55");
  });

  it("defines default country by extension language", () => {
    expect(getDefaultCountryCodeForLanguage("pt-BR")).toBe("BR");
    expect(getDefaultCountryCodeForLanguage("PT-br")).toBe("BR");
    expect(getDefaultCountryCodeForLanguage("en-US")).toBe("US");
    expect(getDefaultCountryCodeForLanguage("es-ES")).toBe("US");
  });

  it("renders a local Twemoji flag without remote resources", () => {
    const country = { iso2: "BR", name: "Brasil", flag: "🇧🇷" };
    const html = renderCountryFlagHtml(country);

    expect(html).toContain("../../assets/twemoji/1f1e7-1f1f7.svg");
    expect(html).toContain('class="country-picker__flag-img"');
    expect(html).not.toContain("http");
    expect(html).toContain("<img");
  });

  it("uses a neutral local flag for invalid flag data", () => {
    const html = renderCountryFlagHtml({
      iso2: '<script>alert("x")</script>',
      flag: '<script>alert("x")</script>'
    });

    expect(html).toContain("../../assets/twemoji/1f3f3.svg");
    expect(html).not.toContain("script");
  });

  it("maps emoji code points to deterministic local asset names", () => {
    expect(getTwemojiAssetName("🇵🇹")).toBe("1f1f5-1f1f9.svg");
    expect(getTwemojiAssetName("🌐")).toBe("1f310.svg");
    expect(getTwemojiAssetName("❤️")).toBe("2764.svg");
    expect(getTwemojiAssetName("")).toBe("");
  });

  it("renders the automatic-country globe from the local Twemoji package", () => {
    const html = renderEmojiHtml("🌐");

    expect(html).toContain("../../assets/twemoji/1f310.svg");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("http");
  });

  it("uses an absolute extension URL when the Chrome runtime is available", () => {
    const previousChrome = globalThis.chrome;
    const runtime = {
      getURL(path) {
        expect(this).toBe(runtime);
        return `chrome-extension://extension-id/${path}`;
      }
    };
    globalThis.chrome = {
      runtime
    };

    try {
      expect(renderCountryFlagHtml({ iso2: "PT" })).toContain(
        "chrome-extension://extension-id/assets/twemoji/1f1f5-1f1f9.svg"
      );
    } finally {
      if (previousChrome === undefined) {
        delete globalThis.chrome;
      } else {
        globalThis.chrome = previousChrome;
      }
    }
  });
});
