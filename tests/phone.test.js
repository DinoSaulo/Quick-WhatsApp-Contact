import {
  buildWhatsAppUrl,
  getExpectedFormatsForDdi,
  hasCountryCode,
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
