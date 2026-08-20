import { describe, expect, it } from "vitest";
import { PHONE_FORMAT_RULES_BY_DDI } from "../src/utils/phoneFormats.js";
import { COUNTRIES } from "../src/utils/countries.js";

describe("phoneFormats object", () => {
  it("contem formatos validos para o Brasil (55)", () => {
    expect(PHONE_FORMAT_RULES_BY_DDI["55"]).toEqual([
      "(XX) 9XXXX-XXXX",
      "(XX) XXXX-XXXX"
    ]);
  });

  it("contem formato valido para Portugal (351)", () => {
    expect(PHONE_FORMAT_RULES_BY_DDI["351"]).toEqual(["XXXXXXXXX"]);
  });

  it("contem formatos validos para EUA/Canada (1)", () => {
    expect(PHONE_FORMAT_RULES_BY_DDI["1"]).toEqual(["XXX-XXXX"]);
  });

  it("cobre todos os DDIs presentes em COUNTRIES, sem nenhum ficar sem regra", () => {
    const dialCodesInCountries = new Set(
      COUNTRIES.map((country) => country.dialCode.replace(/\D/g, ""))
    );
    const missing = [...dialCodesInCountries].filter(
      (dialCode) => !PHONE_FORMAT_RULES_BY_DDI[dialCode]
    );

    expect(missing).toEqual([]);
  });

  it("nao contem regra para nenhum DDI que nao exista em COUNTRIES", () => {
    const dialCodesInCountries = new Set(
      COUNTRIES.map((country) => country.dialCode.replace(/\D/g, ""))
    );
    const extra = Object.keys(PHONE_FORMAT_RULES_BY_DDI).filter(
      (dialCode) => !dialCodesInCountries.has(dialCode)
    );

    expect(extra).toEqual([]);
  });

  it.each([
    ["93", "Afeganistao", ["XXXXXXXXX"]],
    ["244", "Angola", ["XXXXXXXXX"]],
    ["1268", "Antigua e Barbuda", ["XXXXXXXXXX"]],
    ["376", "Andorra", ["XXXXXX"]],
    ["3906", "Vaticano", ["XXXXXXXXXX"]]
  ])("deriva a regra do DDI %s (%s) a partir do phoneMask ja curado em countries.js", (dialCode, _name, expected) => {
    expect(PHONE_FORMAT_RULES_BY_DDI[dialCode]).toEqual(expected);
  });

  it.each([
    ["1", ["XXX-XXXX"]],
    ["7", ["XXX-XX-XX"]],
    ["20", ["XXXXXXXX", "XXXXXXXXX"]],
    ["32", ["XXXXXXXX", "XXXXXXXXX"]],
    ["36", ["XXXXXXXX", "XXXXXXXXX"]],
    ["39", ["XXXXXXXXXX", "XXXXXXXXXXX"]],
    ["44", ["XXXXXXXXXX", "XXXXXXXXXXX"]],
    ["46", ["XXXXXXXX", "XXXXXXXXX"]],
    ["49", ["XXXXXXXXXXX", "XXXXXXXXXXXX"]],
    ["54", ["XXXXXXXXXX", "XXXXXXXXXXX"]],
    ["55", ["(XX) 9XXXX-XXXX", "(XX) XXXX-XXXX"]],
    ["61", ["XXXXXXXXX"]],
    ["62", ["XXXXXXXXXX", "XXXXXXXXXXX"]],
    ["64", ["XXXXXXXX", "XXXXXXXXXX"]],
    ["82", ["XXXXXXXXX", "XXXXXXXXXX"]]
  ])("preserva os formatos excepcionais do DDI %s", (dialCode, expected) => {
    expect(PHONE_FORMAT_RULES_BY_DDI[dialCode]).toEqual(expected);
  });
});
