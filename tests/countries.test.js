import {
  COUNTRIES,
  getCountryByCode,
  getDefaultCountryCodeForLanguage,
  getCountryFlagUrl,
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

  it("generates flag CDN URL for valid ISO2 codes", () => {
    expect(getCountryFlagUrl("BR")).toBe("https://flagcdn.com/w40/br.png");
    expect(getCountryFlagUrl("us")).toBe("https://flagcdn.com/w40/us.png");
    expect(getCountryFlagUrl("invalid")).toBeNull();
    expect(getCountryFlagUrl(null)).toBeNull();
  });

  it("renders flag HTML with image, srcset, and XSS sanitization", () => {
    const country = { iso2: "BR", name: 'Brasil "<script>', flag: "🇧🇷" };
    const html = renderCountryFlagHtml(country);
    expect(html).toContain('src="https://flagcdn.com/w40/br.png"');
    expect(html).toContain('alt="Brasil &quot;&lt;script&gt;"');
    expect(html).not.toContain("<script>");
  });
});
