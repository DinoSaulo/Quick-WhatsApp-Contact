import { getMessages } from "./utils/i18n.js";
import { detectCountryCodeFromUrl } from "./utils/location.js";
import {
  buildWhatsAppUrl,
  hasCountryCode,
  isLikelyPhoneText,
  normalizeSelectedNumber
} from "./utils/phone.js";
import {
  getAutoHighlightEnabled,
  getLanguage,
  setPendingContextCountry,
  setPendingContextNumber
} from "./utils/storage.js";
import { ONBOARDING_PAGE_PATH } from "./utils/tutorial.js";

const CONTEXT_MENU_ID = "quick-whatsapp-contact.send";
const PROCESS_SELECTION_MESSAGE = "quick-whatsapp-contact.process-selection";
const LANGUAGE_STORAGE_KEY = "quick-whatsapp-contact.language";
const AUTO_HIGHLIGHT_ENABLED_KEY = "quick-whatsapp-contact.auto-highlight-enabled";
const PAGE_HELPERS_SCRIPT_ID = "quick-whatsapp-contact.page-helpers";
const PAGE_ORIGINS = ["http://*/*", "https://*/*"];

chrome.runtime.onInstalled.addListener(async (details = {}) => {
  await Promise.all([refreshContextMenu(), syncPageHelpersRegistration()]);
  if (details.reason === "install") {
    await openOnboardingTab();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await Promise.all([refreshContextMenu(), syncPageHelpersRegistration()]);
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }
  if (changes[LANGUAGE_STORAGE_KEY]) {
    await refreshContextMenu();
  }
  if (changes[AUTO_HIGHLIGHT_ENABLED_KEY]) {
    await syncPageHelpersRegistration();
  }
});

chrome.permissions.onAdded.addListener(syncPageHelpersRegistration);
chrome.permissions.onRemoved.addListener(syncPageHelpersRegistration);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) {
    return;
  }

  await processSelection(info.selectionText, info.pageUrl);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== PROCESS_SELECTION_MESSAGE) {
    return;
  }

  processSelection(message.selectionText, sender.tab?.url)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});

async function refreshContextMenu() {
  const language = await getLanguage();
  const messages = getMessages(language);
  const title = messages.contextMenuCall;

  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title,
    contexts: ["selection"]
  });
}

async function processSelection(selectionText, urlString) {
  if (!isLikelyPhoneText(selectionText)) {
    return;
  }
  const sanitizedNumber = normalizeSelectedNumber(selectionText);
  if (!sanitizedNumber) {
    return;
  }

  if (hasCountryCode(sanitizedNumber)) {
    const url = buildWhatsAppUrl(sanitizedNumber);
    if (!url) {
      return;
    }

    await openWhatsAppTab(url);
    return;
  }

  const detectedCountry = detectCountryCodeFromUrl(urlString);
  if (detectedCountry) {
    await setPendingContextCountry(detectedCountry);
  }

  await setPendingContextNumber(sanitizedNumber);
  await chrome.action.openPopup();
}

async function openWhatsAppTab(url) {
  return chrome.tabs.create({ url, active: true });
}

async function openOnboardingTab() {
  return chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_PAGE_PATH) });
}

async function syncPageHelpersRegistration() {
  const [isEnabled, hasSiteAccess] = await Promise.all([
    getAutoHighlightEnabled(),
    chrome.permissions.contains({ origins: PAGE_ORIGINS })
  ]);

  const existingScripts = await chrome.scripting.getRegisteredContentScripts({
    ids: [PAGE_HELPERS_SCRIPT_ID]
  });
  if (existingScripts.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [PAGE_HELPERS_SCRIPT_ID] });
  }

  if (!isEnabled || !hasSiteAccess) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: PAGE_HELPERS_SCRIPT_ID,
      matches: PAGE_ORIGINS,
      js: ["src/content/autoHighlight.js", "src/content/selectionButton.js"],
      runAt: "document_idle",
      persistAcrossSessions: true
    }
  ]);
}
