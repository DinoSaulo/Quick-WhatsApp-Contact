import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => ({}));
const mockStorage = vi.hoisted(() => ({
  getAutoHighlightEnabled: vi.fn(),
  getLanguage: vi.fn(),
  setPendingContextCountry: vi.fn(),
  setPendingContextNumber: vi.fn()
}));
const mockLocation = vi.hoisted(() => ({
  detectCountryCodeFromUrl: vi.fn()
}));

vi.mock("../src/utils/storage.js", () => mockStorage);
vi.mock("../src/utils/location.js", () => mockLocation);

function eventFor(name) {
  return { addListener: vi.fn((handler) => { handlers[name] = handler; }) };
}

async function sendSelection(selectionText, pageUrl = "https://example.pt") {
  const sendResponse = vi.fn();
  const keepsChannelOpen = handlers.message(
    { type: "quick-whatsapp-contact.process-selection", selectionText },
    { tab: { url: pageUrl } },
    sendResponse
  );
  await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
  return { keepsChannelOpen, response: sendResponse.mock.calls[0][0] };
}

describe("background selection security integration", () => {
  beforeAll(async () => {
    global.chrome = {
      runtime: {
        onInstalled: eventFor("installed"),
        onStartup: eventFor("startup"),
        onMessage: eventFor("message")
      },
      storage: { onChanged: eventFor("storageChanged") },
      permissions: {
        onAdded: eventFor("permissionsAdded"),
        onRemoved: eventFor("permissionsRemoved"),
        contains: vi.fn()
      },
      scripting: {
        getRegisteredContentScripts: vi.fn(),
        unregisterContentScripts: vi.fn(),
        registerContentScripts: vi.fn()
      },
      contextMenus: {
        onClicked: eventFor("contextClicked"),
        removeAll: vi.fn(),
        create: vi.fn()
      },
      tabs: { create: vi.fn() },
      action: { openPopup: vi.fn() }
    };
    await import("../src/background.js");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getLanguage.mockResolvedValue("en-US");
    mockStorage.getAutoHighlightEnabled.mockResolvedValue(false);
    mockStorage.setPendingContextCountry.mockResolvedValue();
    mockStorage.setPendingContextNumber.mockResolvedValue();
    mockLocation.detectCountryCodeFromUrl.mockReturnValue("PT");
    chrome.tabs.create.mockResolvedValue({});
    chrome.action.openPopup.mockResolvedValue();
    chrome.permissions.contains.mockResolvedValue(false);
    chrome.scripting.getRegisteredContentScripts.mockResolvedValue([]);
    chrome.scripting.unregisterContentScripts.mockResolvedValue();
    chrome.scripting.registerContentScripts.mockResolvedValue();
  });

  it("ignores messages outside the extension's selection protocol", () => {
    const result = handlers.message(
      { type: "attacker.control", selectionText: "+351912345678" },
      { tab: { url: "https://example.pt" } },
      vi.fn()
    );

    expect(result).toBeUndefined();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.action.openPopup).not.toHaveBeenCalled();
  });

  it("rejects hostile international selections instead of extracting embedded digits", async () => {
    const result = await sendSelection(
      '<script>alert("x")</script> +351 912 345 678 <img src=x>'
    );

    expect(result.keepsChannelOpen).toBe(true);
    expect(result.response).toEqual({ ok: true });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.action.openPopup).not.toHaveBeenCalled();
  });

  it("rejects hostile local selections", async () => {
    await sendSelection('<img src=x onerror=alert("x")> 912 345 678');

    expect(mockStorage.setPendingContextCountry).not.toHaveBeenCalled();
    expect(mockStorage.setPendingContextNumber).not.toHaveBeenCalled();
    expect(chrome.action.openPopup).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("performs no navigation for a selection without phone digits", async () => {
    await sendSelection('<script>alert("x")</script>');

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.action.openPopup).not.toHaveBeenCalled();
    expect(mockStorage.setPendingContextNumber).not.toHaveBeenCalled();
  });

  it("does not trust a page URL as a navigation destination", async () => {
    mockLocation.detectCountryCodeFromUrl.mockReturnValue("");

    await sendSelection("912 345 678", "javascript:alert(document.cookie)");

    expect(mockStorage.setPendingContextCountry).not.toHaveBeenCalled();
    expect(mockStorage.setPendingContextNumber).toHaveBeenCalledWith("912345678");
    expect(chrome.action.openPopup).toHaveBeenCalledOnce();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("registers page helpers only when enabled and optional host access is granted", async () => {
    mockStorage.getAutoHighlightEnabled.mockResolvedValue(true);
    chrome.permissions.contains.mockResolvedValue(true);

    await handlers.installed();

    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "quick-whatsapp-contact.page-helpers",
        matches: ["http://*/*", "https://*/*"],
        persistAcrossSessions: true
      })
    ]);
  });

  it("does not register page helpers without optional host access", async () => {
    mockStorage.getAutoHighlightEnabled.mockResolvedValue(true);
    chrome.permissions.contains.mockResolvedValue(false);

    await handlers.installed();

    expect(chrome.scripting.registerContentScripts).not.toHaveBeenCalled();
  });

  it("unregisters stale page helpers when the feature is disabled", async () => {
    chrome.scripting.getRegisteredContentScripts.mockResolvedValue([
      { id: "quick-whatsapp-contact.page-helpers" }
    ]);

    await handlers.permissionsRemoved();

    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: ["quick-whatsapp-contact.page-helpers"]
    });
  });
});
