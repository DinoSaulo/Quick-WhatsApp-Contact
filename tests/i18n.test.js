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

  it("quando faltar parametro na interpolacao retorna string vazia no placeholder", () => {
    const messages = getMessages("pt-BR");
    expect(t(messages, "validationInvalidFormat", { ddi: "55" })).toBe(
      "Formato inválido para +55. Use: "
    );
  });
});
