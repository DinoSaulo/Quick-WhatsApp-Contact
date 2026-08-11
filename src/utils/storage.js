const LAST_COUNTRY_STORAGE_KEY = "quick-whatsapp-contact.last-country";
const PENDING_CONTEXT_NUMBER_KEY = "quick-whatsapp-contact.pending-context-number";
const PENDING_CONTEXT_COUNTRY_KEY = "quick-whatsapp-contact.pending-context-country";
const AUTO_HIGHLIGHT_ENABLED_KEY = "quick-whatsapp-contact.auto-highlight-enabled";
const DARK_MODE_ENABLED_KEY = "quick-whatsapp-contact.dark-mode-enabled";
const LANGUAGE_KEY = "quick-whatsapp-contact.language";
const DEFAULT_COUNTRY_KEY = "quick-whatsapp-contact.default-country";

export const DEFAULT_SETTINGS = {
  autoHighlightEnabled: true,
  darkModeEnabled: false,
  language: "en-US",
  defaultCountry: ""
};

export function normalizeLanguage(language = "") {
  return String(language || "").toLowerCase() === "pt-br" ? "pt-BR" : "en-US";
}

export async function saveLastCountry(countryCode) {
  await chrome.storage.sync.set({ [LAST_COUNTRY_STORAGE_KEY]: countryCode });
}

export async function getLastCountry() {
  const result = await chrome.storage.sync.get(LAST_COUNTRY_STORAGE_KEY);
  return result[LAST_COUNTRY_STORAGE_KEY];
}

export async function setPendingContextNumber(phoneNumber) {
  await chrome.storage.session.set({ [PENDING_CONTEXT_NUMBER_KEY]: phoneNumber });
}

export async function consumePendingContextNumber() {
  const result = await chrome.storage.session.get(PENDING_CONTEXT_NUMBER_KEY);
  await chrome.storage.session.remove(PENDING_CONTEXT_NUMBER_KEY);
  return result[PENDING_CONTEXT_NUMBER_KEY] ?? "";
}

export async function setPendingContextCountry(countryCode) {
  await chrome.storage.session.set({ [PENDING_CONTEXT_COUNTRY_KEY]: countryCode });
}

export async function consumePendingContextCountry() {
  const result = await chrome.storage.session.get(PENDING_CONTEXT_COUNTRY_KEY);
  await chrome.storage.session.remove(PENDING_CONTEXT_COUNTRY_KEY);
  return result[PENDING_CONTEXT_COUNTRY_KEY] ?? "";
}

export async function getAutoHighlightEnabled() {
  const result = await chrome.storage.sync.get(AUTO_HIGHLIGHT_ENABLED_KEY);
  if (typeof result[AUTO_HIGHLIGHT_ENABLED_KEY] === "boolean") {
    return result[AUTO_HIGHLIGHT_ENABLED_KEY];
  }
  return DEFAULT_SETTINGS.autoHighlightEnabled;
}

export async function setAutoHighlightEnabled(isEnabled) {
  await chrome.storage.sync.set({ [AUTO_HIGHLIGHT_ENABLED_KEY]: Boolean(isEnabled) });
}

export async function getDarkModeEnabled() {
  const result = await chrome.storage.sync.get(DARK_MODE_ENABLED_KEY);
  if (typeof result[DARK_MODE_ENABLED_KEY] === "boolean") {
    return result[DARK_MODE_ENABLED_KEY];
  }
  return DEFAULT_SETTINGS.darkModeEnabled;
}

export async function setDarkModeEnabled(isEnabled) {
  await chrome.storage.sync.set({ [DARK_MODE_ENABLED_KEY]: Boolean(isEnabled) });
}

export async function getLanguage() {
  const result = await chrome.storage.sync.get(LANGUAGE_KEY);
  return normalizeLanguage(result[LANGUAGE_KEY] ?? DEFAULT_SETTINGS.language);
}

export async function setLanguage(language) {
  await chrome.storage.sync.set({ [LANGUAGE_KEY]: normalizeLanguage(language) });
}

export async function getDefaultCountry() {
  const result = await chrome.storage.sync.get(DEFAULT_COUNTRY_KEY);
  return result[DEFAULT_COUNTRY_KEY] ?? DEFAULT_SETTINGS.defaultCountry;
}

export async function setDefaultCountry(countryCode) {
  await chrome.storage.sync.set({ [DEFAULT_COUNTRY_KEY]: String(countryCode ?? "") });
}

export async function getSettings() {
  const result = await chrome.storage.sync.get([
    AUTO_HIGHLIGHT_ENABLED_KEY,
    DARK_MODE_ENABLED_KEY,
    LANGUAGE_KEY,
    DEFAULT_COUNTRY_KEY
  ]);

  return {
    autoHighlightEnabled:
      typeof result[AUTO_HIGHLIGHT_ENABLED_KEY] === "boolean"
        ? result[AUTO_HIGHLIGHT_ENABLED_KEY]
        : DEFAULT_SETTINGS.autoHighlightEnabled,
    darkModeEnabled:
      typeof result[DARK_MODE_ENABLED_KEY] === "boolean"
        ? result[DARK_MODE_ENABLED_KEY]
        : DEFAULT_SETTINGS.darkModeEnabled,
    language: normalizeLanguage(result[LANGUAGE_KEY] ?? DEFAULT_SETTINGS.language),
    defaultCountry: result[DEFAULT_COUNTRY_KEY] ?? DEFAULT_SETTINGS.defaultCountry
  };
}

export async function saveSettings(settings = {}) {
  await chrome.storage.sync.set({
    [AUTO_HIGHLIGHT_ENABLED_KEY]:
      typeof settings.autoHighlightEnabled === "boolean"
        ? settings.autoHighlightEnabled
        : DEFAULT_SETTINGS.autoHighlightEnabled,
    [DARK_MODE_ENABLED_KEY]:
      typeof settings.darkModeEnabled === "boolean"
        ? settings.darkModeEnabled
        : DEFAULT_SETTINGS.darkModeEnabled,
    [LANGUAGE_KEY]: normalizeLanguage(settings.language ?? DEFAULT_SETTINGS.language),
    [DEFAULT_COUNTRY_KEY]: String(settings.defaultCountry ?? DEFAULT_SETTINGS.defaultCountry)
  });
}
