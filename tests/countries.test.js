import {
  COUNTRIES,
  getCountryByCode,
  getDefaultCountryCodeForLanguage,
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

  it("renders a local emoji flag without remote resources", () => {
    const country = { iso2: "BR", name: "Brasil", flag: "🇧🇷" };
    const html = renderCountryFlagHtml(country);
    expect(html).toContain("🇧🇷");
    expect(html).not.toContain("http");
    expect(html).not.toContain("<img");
  });

  it("uses a neutral local flag for invalid flag data", () => {
    expect(renderCountryFlagHtml({ flag: '<script>alert("x")</script>' })).toContain("🏳");
  });
});
