import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumePendingContextCountry,
  consumePendingContextNumber,
  DEFAULT_SETTINGS,
  getAutoHighlightEnabled,
  getDarkModeEnabled,
  getDefaultCountry,
  getLanguage,
  getLastCountry,
  getSettings,
  normalizeLanguage,
  saveLastCountry,
  saveSettings,
  setAutoHighlightEnabled,
  setDarkModeEnabled,
  setDefaultCountry,
  setLanguage,
  setPendingContextCountry,
  setPendingContextNumber
} from "../src/utils/storage.js";

describe("storage utils", () => {
  beforeEach(() => {
    const mockStorage = {
      sync: {
        get: vi.fn(),
        set: vi.fn()
      },
      session: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn()
      }
    };
    vi.stubGlobal("chrome", { storage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizeLanguage aplica en-US por padrão", () => {
    expect(normalizeLanguage("pt-BR")).toBe("pt-BR");
    expect(normalizeLanguage("PT-BR")).toBe("pt-BR");
    expect(normalizeLanguage("de-DE")).toBe("en-US");
    expect(normalizeLanguage("")).toBe("en-US");
  });

  it("saveLastCountry salva no storage sync", async () => {
    await saveLastCountry("55");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.last-country": "55"
    });
  });

  it("getLastCountry retorna do storage sync", async () => {
    chrome.storage.sync.get.mockResolvedValue({
      "quick-whatsapp-contact.last-country": "351"
    });
    const result = await getLastCountry();
    expect(result).toBe("351");
  });

  it("setPendingContextNumber e consumePendingContextNumber funcionam", async () => {
    await setPendingContextNumber("11999999999");
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.pending-context-number": "11999999999"
    });

    chrome.storage.session.get.mockResolvedValue({
      "quick-whatsapp-contact.pending-context-number": "11999999999"
    });
    const consumed = await consumePendingContextNumber();
    expect(consumed).toBe("11999999999");
    expect(chrome.storage.session.remove).toHaveBeenCalledWith(
      "quick-whatsapp-contact.pending-context-number"
    );
  });

  it("setPendingContextCountry e consumePendingContextCountry funcionam", async () => {
    await setPendingContextCountry("PT");
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.pending-context-country": "PT"
    });

    chrome.storage.session.get.mockResolvedValue({
      "quick-whatsapp-contact.pending-context-country": "BR"
    });
    const consumed = await consumePendingContextCountry();
    expect(consumed).toBe("BR");
    expect(chrome.storage.session.remove).toHaveBeenCalledWith(
      "quick-whatsapp-contact.pending-context-country"
    );
  });

  it("consumePendingContextCountry retorna string vazia quando nao houver valor", async () => {
    chrome.storage.session.get.mockResolvedValue({});
    const consumed = await consumePendingContextCountry();
    expect(consumed).toBe("");
  });

  it("getAutoHighlightEnabled usa default true", async () => {
    chrome.storage.sync.get.mockResolvedValue({});
    const result = await getAutoHighlightEnabled();
    expect(result).toBe(true);
  });

  it("setAutoHighlightEnabled salva booleano", async () => {
    await setAutoHighlightEnabled(false);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.auto-highlight-enabled": false
    });
  });

  it("getDarkModeEnabled usa default false", async () => {
    chrome.storage.sync.get.mockResolvedValue({});
    const result = await getDarkModeEnabled();
    expect(result).toBe(false);
  });

  it("setDarkModeEnabled salva booleano", async () => {
    await setDarkModeEnabled(true);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.dark-mode-enabled": true
    });
  });

  it("getDefaultCountry uses an empty default when no country was configured", async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    await expect(getDefaultCountry()).resolves.toBe("");
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(
      "quick-whatsapp-contact.default-country"
    );
  });

  it("gets and sets the configured default country", async () => {
    chrome.storage.sync.get.mockResolvedValue({
      "quick-whatsapp-contact.default-country": "PT"
    });

    await expect(getDefaultCountry()).resolves.toBe("PT");

    await setDefaultCountry("BR");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.default-country": "BR"
    });
  });

  it("clears the configured default country when given null", async () => {
    await setDefaultCountry(null);

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.default-country": ""
    });
  });

  it("getLanguage usa en-US por padrão", async () => {
    chrome.storage.sync.get.mockResolvedValue({});
    const result = await getLanguage();
    expect(result).toBe("en-US");
  });

  it("setLanguage salva idioma normalizado", async () => {
    await setLanguage("pt-br");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.language": "pt-BR"
    });
  });

  it("setLanguage aplica fallback para en-US quando idioma for invalido", async () => {
    await setLanguage("es-ES");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.language": "en-US"
    });
  });

  it("getSettings retorna defaults quando vazio", async () => {
    chrome.storage.sync.get.mockResolvedValue({});
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("getSettings retorna valores salvos e normaliza linguagem", async () => {
    chrome.storage.sync.get.mockResolvedValue({
      "quick-whatsapp-contact.auto-highlight-enabled": false,
      "quick-whatsapp-contact.dark-mode-enabled": true,
      "quick-whatsapp-contact.language": "pt-br"
    });
    const settings = await getSettings();
    expect(settings).toEqual({
      autoHighlightEnabled: false,
      darkModeEnabled: true,
      language: "pt-BR",
      defaultCountry: ""
    });
  });

  it("getSettings includes the configured default country", async () => {
    chrome.storage.sync.get.mockResolvedValue({
      "quick-whatsapp-contact.default-country": "GB"
    });

    const settings = await getSettings();

    expect(settings.defaultCountry).toBe("GB");
  });

  it("saveSettings persiste estrutura completa", async () => {
    await saveSettings({
      autoHighlightEnabled: false,
      darkModeEnabled: true,
      language: "pt-BR"
    });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.auto-highlight-enabled": false,
      "quick-whatsapp-contact.dark-mode-enabled": true,
      "quick-whatsapp-contact.language": "pt-BR",
      "quick-whatsapp-contact.default-country": ""
    });
  });

  it("saveSettings aplica defaults quando campos nao sao enviados", async () => {
    await saveSettings({ language: "invalid" });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "quick-whatsapp-contact.auto-highlight-enabled": true,
      "quick-whatsapp-contact.dark-mode-enabled": false,
      "quick-whatsapp-contact.language": "en-US",
      "quick-whatsapp-contact.default-country": ""
    });
  });

  it("saveSettings persists the configured default country", async () => {
    await saveSettings({ defaultCountry: "PT" });

    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "quick-whatsapp-contact.default-country": "PT"
      })
    );
  });
});
