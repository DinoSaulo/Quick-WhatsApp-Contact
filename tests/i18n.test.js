import { describe, expect, it } from "vitest";
import { getMessages, t } from "../src/utils/i18n.js";

describe("i18n utils", () => {
  it("retorna dicionário em inglês por padrão", () => {
    const messages = getMessages("unknown");
    expect(messages.popupTitle).toBe("Send message");
  });

  it("retorna dicionário em português quando solicitado", () => {
    const messages = getMessages("pt-BR");
    expect(messages.popupTitle).toBe("Enviar mensagem");
  });

  it("returns the Spanish (Spain) dictionary when requested", () => {
    const messages = getMessages("es-ES");
    expect(messages.popupTitle).toBe("Enviar mensaje");
    expect(messages.optionsTitle).toBe("Ajustes de la extensión");
  });

  it("interpola placeholders corretamente", () => {
    const messages = getMessages("en-US");
    expect(t(messages, "previewFinalNumber", { number: "5511999999999" })).toBe(
      "Final number: +5511999999999"
    );
  });

  it("expoe textos de configuracoes em ambos os idiomas", () => {
    const en = getMessages("en-US");
    const pt = getMessages("pt-BR");
    expect(en.optionsTitle).toBe("Extension settings");
    expect(pt.optionsTitle).toBe("Configurações da extensão");
    expect(en.optionLanguage).toBe("Language");
    expect(pt.optionLanguage).toBe("Idioma");
  });

  it("nomeia os idiomas sem sigla de locale entre parenteses", () => {
    const en = getMessages("en-US");
    const pt = getMessages("pt-BR");
    const es = getMessages("es-ES");
    expect(en.optionLanguageEnglish).toBe("English");
    expect(en.optionLanguagePortuguese).toBe("Portuguese");
    expect(pt.optionLanguageEnglish).toBe("Inglês");
    expect(pt.optionLanguagePortuguese).toBe("Português");
    expect(es.optionLanguageSpanish).toBe("Español");
  });

  it("quando faltar parametro na interpolacao retorna string vazia no placeholder", () => {
    const messages = getMessages("pt-BR");
    expect(t(messages, "validationInvalidFormat", { ddi: "55" })).toBe(
      "Formato inválido para +55. Use: "
    );
  });

  it("keeps the same keys in every language (no missing translations)", () => {
    const enKeys = Object.keys(getMessages("en-US")).sort();
    const ptKeys = Object.keys(getMessages("pt-BR")).sort();
    const esKeys = Object.keys(getMessages("es-ES")).sort();

    expect(ptKeys).toEqual(enKeys);
    expect(esKeys).toEqual(enKeys);
  });
});
