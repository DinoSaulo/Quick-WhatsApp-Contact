import { describe, expect, it } from "vitest";
import { PHONE_FORMAT_RULES_BY_DDI } from "../src/utils/phoneFormats.js";

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
});
