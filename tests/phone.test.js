import {
  applyPhoneMask,
  buildWhatsAppUrl,
  getExpectedFormatsForDdi,
  getPhoneMaskPlaceholder,
  hasCountryCode,
  isLikelyPhoneText,
  isValidPhoneForSend,
  isLocalNumberValidForDdi,
  joinCountryCodeAndNumber,
  normalizeSelectedNumber,
  sanitizePhoneNumber
} from "../src/utils/phone.js";
import { describe, expect, it } from "vitest";

describe("phone utils", () => {
  it("remove espacos, parenteses e tracos", () => {
    expect(sanitizePhoneNumber("(11) 99999-8888")).toBe("11999998888");
  });

  it("mantem apenas um prefixo de mais no inicio", () => {
    expect(normalizeSelectedNumber("++55 (11) 99999-8888")).toBe("+5511999998888");
  });

  it("identifica quando o número possui DDI", () => {
    expect(hasCountryCode("+351912345678")).toBe(true);
    expect(hasCountryCode("11999998888")).toBe(false);
  });

  it("concatena DDI com número local sanitizado", () => {
    expect(joinCountryCodeAndNumber("55", "(11) 99999-8888")).toBe("5511999998888");
  });

  it("concatena corretamente quando o DDI possui caracteres não numéricos", () => {
    expect(joinCountryCodeAndNumber("1-242", "555-1234")).toBe("12425551234");
  });

  it("concatena corretamente quando o número local já vem com prefixo +", () => {
    expect(joinCountryCodeAndNumber("351", "+91 234 5678")).toBe("351912345678");
  });

  it("não concatena quando o número local esta vazio", () => {
    expect(joinCountryCodeAndNumber("55", "   ")).toBe("");
  });

  it("valida telefone minimo para envio", () => {
    expect(isValidPhoneForSend("+5511999998888")).toBe(true);
    expect(isValidPhoneForSend("55")).toBe(false);
    expect(isValidPhoneForSend("+")).toBe(false);
    expect(isValidPhoneForSend("1".repeat(15))).toBe(true);
    expect(isValidPhoneForSend("1".repeat(16))).toBe(false);
  });

  it("accepts only phone-like selected text with E.164 length limits", () => {
    expect(isLikelyPhoneText("+351 912 345 678")).toBe(true);
    expect(isLikelyPhoneText("call +351 912 345 678")).toBe(false);
    expect(isLikelyPhoneText("1".repeat(16))).toBe(false);
  });

  it("retorna formatos esperados por DDI", () => {
    expect(getExpectedFormatsForDdi("55")).toEqual(["9XXXX-XXXX", "XXXX-XXXX"]);
    expect(getExpectedFormatsForDdi("351")).toEqual(["XXXXXXXXX"]);
    expect(getExpectedFormatsForDdi("999")).toEqual([]);
  });

  it("valida número local com base no DDI selecionado", () => {
    expect(isLocalNumberValidForDdi("91234-5678", "55")).toBe(true);
    expect(isLocalNumberValidForDdi("1234-5678", "55")).toBe(true);
    expect(isLocalNumberValidForDdi("2345-678", "55")).toBe(false);
    expect(isLocalNumberValidForDdi("123-4567", "1")).toBe(true);
    expect(isLocalNumberValidForDdi("12345678", "1")).toBe(false);
  });

  it("monta a URL do WhatsApp com mensagem codificada", () => {
    expect(buildWhatsAppUrl("+55 (11) 99999-8888", "Ola mundo")).toBe(
      "https://wa.me/5511999998888?text=Ola%20mundo"
    );
  });

  it("monta a URL do WhatsApp sem query quando não ha mensagem", () => {
    expect(buildWhatsAppUrl("+55 (11) 99999-8888")).toBe("https://wa.me/5511999998888");
    expect(buildWhatsAppUrl("+55 (11) 99999-8888", "   ")).toBe("https://wa.me/5511999998888");
  });

  it("aplica URL encoding para caracteres especiais", () => {
    expect(buildWhatsAppUrl("5511999999999", "Ola, Joao! Estou interessado: 50% hoje.")).toBe(
      "https://wa.me/5511999999999?text=Ola%2C%20Joao!%20Estou%20interessado%3A%2050%25%20hoje."
    );
    expect(buildWhatsAppUrl("5511999999999", "Ola estou interessado em caf\xE9")).toBe(
      "https://wa.me/5511999999999?text=Ola%20estou%20interessado%20em%20caf%C3%A9"
    );
  });

  it("retorna string vazia quando o telefone e inválido", () => {
    expect(buildWhatsAppUrl("")).toBe("");
    expect(buildWhatsAppUrl("+")).toBe("");
    expect(buildWhatsAppUrl("55")).toBe("");
  });
});

describe("country phone masks", () => {
  it.each([
    ["Brazil", "(11) 99999-8888", "11 99999 9999", "11 99999 8888"],
    ["Portugal", "912-345-678", "999 999 999", "912 345 678"],
    ["United States", "(415) 555-2671", "999 999 9999", "415 555 2671"],
    ["United Kingdom", "020 7946 0958", "9999 999 9999", "0207 946 0958"],
    ["India", "+91 98765 43210", "99999 99999", "91987 65432"]
  ])("formats digits using the %s mask", (_country, raw, mask, expected) => {
    expect(applyPhoneMask(raw, mask)).toBe(expected);
  });

  it("formats partial input without appending separators", () => {
    expect(applyPhoneMask("119", "11 99999 9999")).toBe("11 9");
    expect(applyPhoneMask("912", "999 999 999")).toBe("912");
  });

  it("removes existing punctuation before applying the selected mask", () => {
    expect(applyPhoneMask("12.34/56 abc 789", "999 999 999")).toBe("123 456 789");
  });

  it("truncates digits that exceed the selected country's mask", () => {
    expect(applyPhoneMask("912345678999", "999 999 999")).toBe("912 345 678");
  });

  it("returns an empty value when there are no digits", () => {
    expect(applyPhoneMask("( ) -", "999 999 9999")).toBe("");
  });

  it("leaves the original value untouched when no mask is available", () => {
    expect(applyPhoneMask("+123 custom", "")).toBe("+123 custom");
    expect(applyPhoneMask("123", null)).toBe("123");
  });

  it.each([
    ["11 99999 9999", "__ _____ ____"],
    ["999 999 999", "___ ___ ___"],
    ["9999 999 9999", "____ ___ ____"],
    ["9 99 99 99 99", "_ __ __ __ __"]
  ])("builds a placeholder for mask %s", (mask, expected) => {
    expect(getPhoneMaskPlaceholder(mask)).toBe(expected);
  });

  it("returns an empty placeholder when no mask is available", () => {
    expect(getPhoneMaskPlaceholder("")).toBe("");
    expect(getPhoneMaskPlaceholder(null)).toBe("");
  });
});

describe("phone input security boundaries", () => {
  it("removes HTML and script syntax from selected phone text", () => {
    expect(normalizeSelectedNumber('<img src=x onerror=alert("x")> +351 912 345 678')).toBe(
      "+351912345678"
    );
  });

  it("removes control characters and keeps only phone digits", () => {
    expect(normalizeSelectedNumber("+351\u0000\r\n912\t345\u001f678")).toBe(
      "+351912345678"
    );
  });

  it("collapses multiple plus signs to one leading international prefix", () => {
    expect(normalizeSelectedNumber("+++351+912+345+678")).toBe("+351912345678");
  });

  it("rejects a javascript scheme instead of navigating", () => {
    const url = buildWhatsAppUrl("javascript:+351912345678");

    expect(url).toBe("");
  });

  it.each([
    ["?text=attacker", "https://wa.me/351912345678"],
    ["#fragment", "https://wa.me/351912345678"],
    ["&phone=javascript:alert(1)", "https://wa.me/3519123456781"],
    ["/../../evil", "https://wa.me/351912345678"]
  ])("rejects phone payload %s", (payload) => {
    expect(buildWhatsAppUrl(`+351912345678${payload}`)).toBe("");
  });

  it("encodes message query delimiters instead of creating extra parameters", () => {
    const url = buildWhatsAppUrl("+351912345678", "hello&admin=true#fragment");

    expect(url).toBe(
      "https://wa.me/351912345678?text=hello%26admin%3Dtrue%23fragment"
    );
    expect(new URL(url).searchParams.get("admin")).toBeNull();
  });

  it("encodes line breaks and HTML in messages", () => {
    const url = buildWhatsAppUrl(
      "+351912345678",
      '<script>alert("x")</script>\r\nsecond line'
    );

    expect(new URL(url).searchParams.get("text")).toBe(
      '<script>alert("x")</script>\r\nsecond line'
    );
    expect(url).not.toContain("<script>");
    expect(url).not.toContain("\r");
    expect(url).not.toContain("\n");
  });

  it("rejects payloads that contain no usable phone number", () => {
    expect(buildWhatsAppUrl("javascript:alert('x')")).toBe("");
    expect(buildWhatsAppUrl("<script></script>")).toBe("");
  });
});
