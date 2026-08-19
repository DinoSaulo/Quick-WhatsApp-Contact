import {
  COUNTRIES,
  getCountryByCode,
  getCountryByIso2,
  getDefaultCountryCodeForLanguage,
  getLocalizedCountries,
  getLocalizedCountryName,
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

  it("resolves a country by ISO2 case-insensitively", () => {
    expect(getCountryByIso2("br")?.code).toBe("BR");
    expect(getCountryByIso2("BR")?.code).toBe("BR");
  });

  it("returns null for an ISO2 code with no matching country", () => {
    expect(getCountryByIso2("ZZ")).toBeNull();
    expect(getCountryByIso2("")).toBeNull();
  });

  it("defines default country by extension language", () => {
    expect(getDefaultCountryCodeForLanguage("pt-BR")).toBe("BR");
    expect(getDefaultCountryCodeForLanguage("PT-br")).toBe("BR");
    expect(getDefaultCountryCodeForLanguage("en-US")).toBe("US");
    expect(getDefaultCountryCodeForLanguage("es-ES")).toBe("ES");
    expect(getDefaultCountryCodeForLanguage("ES-es")).toBe("ES");
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

  it("localizes a single country's name to the requested language", () => {
    const brazil = getCountryByCode("BR");
    expect(getLocalizedCountryName(brazil, "en-US")).toBe("Brazil");
    expect(getLocalizedCountryName(brazil, "pt-BR")).toBe("Brasil");
    expect(getLocalizedCountryName(brazil, "es-ES")).toBe("Brasil");
  });

  it("falls back to the default name for an unresolvable language tag", () => {
    const brazil = getCountryByCode("BR");
    expect(getLocalizedCountryName(brazil, "")).toBe("Brasil");
    expect(getLocalizedCountryName(null, "en-US")).toBe("");
  });

  it("relocalizes and re-sorts the whole country list per language", () => {
    const enCountries = getLocalizedCountries("en-US");
    const germany = enCountries.find((country) => country.code === "DE");

    expect(germany.name).toBe("Germany");
    expect(germany.defaultName).toBe("Alemanha");
    expect(germany.dialCode).toBe("49");
    const sortedNames = enCountries.map((country) => country.name);
    expect(sortedNames).toEqual([...sortedNames].sort((a, b) => a.localeCompare(b, "en-US")));
  });

  it("keeps every country entry when localizing, even if a locale can't be resolved", () => {
    expect(getLocalizedCountries("")).toHaveLength(COUNTRIES.length);
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
