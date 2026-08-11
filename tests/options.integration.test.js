/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStorage = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  setAutoHighlightEnabled: vi.fn(),
  setDefaultCountry: vi.fn(),
  setDarkModeEnabled: vi.fn(),
  setLanguage: vi.fn()
}));

vi.mock("../src/utils/storage.js", () => mockStorage);

async function renderOptionsPage() {
  if (!customElements.get("extension-settings-page")) {
    await import("../src/options/options.js");
  }

  document.body.innerHTML = "<extension-settings-page></extension-settings-page>";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.querySelector("extension-settings-page");
}

describe("options page integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: ""
    });
    mockStorage.saveSettings.mockResolvedValue();
    mockStorage.setDefaultCountry.mockResolvedValue();
    mockStorage.setAutoHighlightEnabled.mockResolvedValue();
    mockStorage.setDarkModeEnabled.mockResolvedValue();
    mockStorage.setLanguage.mockResolvedValue();
    global.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://options-id/${path}`)
      },
      permissions: {
        contains: vi.fn().mockResolvedValue(true),
        request: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(true)
      }
    };
  });

  it("renders default country picker with Automatic option when defaultCountry is empty", async () => {
    const page = await renderOptionsPage();
    const hiddenInput = page.querySelector("#default-country-hidden");
    const trigger = page.querySelector("#country-trigger");

    expect(hiddenInput.value).toBe("");
    expect(trigger.textContent).toContain("— Automatic —");
    expect(trigger.querySelector(".country-picker__flag-img")?.getAttribute("src"))
      .toBe("chrome-extension://options-id/assets/twemoji/1f310.svg");
  });

  it("renders configured default country with a local flag and DDI", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: "PT"
    });

    const page = await renderOptionsPage();
    const hiddenInput = page.querySelector("#default-country-hidden");
    const trigger = page.querySelector("#country-trigger");

    expect(hiddenInput.value).toBe("PT");
    expect(trigger.textContent).toContain("Portugal");
    expect(trigger.textContent).toContain("+351");
    expect(trigger.querySelector(".country-picker__flag-img")?.getAttribute("src"))
      .toBe("chrome-extension://options-id/assets/twemoji/1f1f5-1f1f9.svg");
  });

  it("filters country dropdown options by search query in options page", async () => {
    const page = await renderOptionsPage();
    const trigger = page.querySelector("#country-trigger");
    const searchInput = page.querySelector("#country-search");
    const noResults = page.querySelector("#country-no-results");
    const options = page.querySelectorAll(".country-picker__option");

    trigger.click();
    expect(page.querySelector("#country-menu").hidden).toBe(false);

    searchInput.value = "Alemanha";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    const visibleOptions = Array.from(options).filter((option) => !option.hidden);
    expect(visibleOptions.length).toBe(1);
    expect(visibleOptions[0].getAttribute("data-country-code")).toBe("DE");
    expect(noResults.hidden).toBe(true);

    searchInput.value = "nonexistent999";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    const visibleAfterNoMatch = Array.from(options).filter((option) => !option.hidden);
    expect(visibleAfterNoMatch.length).toBe(0);
    expect(noResults.hidden).toBe(false);
  });

  it("selects a new default country and persists it via setDefaultCountry", async () => {
    const page = await renderOptionsPage();
    const trigger = page.querySelector("#country-trigger");

    trigger.click();
    const targetOption = page.querySelector('[data-country-code="BR"]');
    targetOption.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStorage.setDefaultCountry).toHaveBeenCalledWith("BR");
    expect(page.querySelector("#default-country-hidden").value).toBe("BR");
    expect(trigger.textContent).toContain("Brasil");
    expect(trigger.textContent).toContain("+55");
    expect(page.querySelector("#saved-status").textContent).toBe("Settings saved");
  });

  it("updates the local flag when selecting a country and returning to Automatic", async () => {
    const page = await renderOptionsPage();
    const trigger = page.querySelector("#country-trigger");

    page.querySelector('[data-country-code="BR"]').click();
    await vi.waitFor(() => expect(mockStorage.setDefaultCountry).toHaveBeenCalledWith("BR"));
    expect(trigger.querySelector(".country-picker__flag-img")?.src).toBe(
      "chrome-extension://options-id/assets/twemoji/1f1e7-1f1f7.svg"
    );

    trigger.click();
    page.querySelector('[data-country-code=""]').click();
    await vi.waitFor(() => expect(mockStorage.setDefaultCountry).toHaveBeenLastCalledWith(""));

    expect(page.querySelector("#default-country-hidden").value).toBe("");
    expect(trigger.querySelector(".country-picker__flag-img")?.src).toBe(
      "chrome-extension://options-id/assets/twemoji/1f310.svg"
    );
  });

  it("renders every country option from the extension origin", async () => {
    const page = await renderOptionsPage();
    const flagSources = Array.from(
      page.querySelectorAll(".country-picker__option .country-picker__flag-img")
    ).map((image) => image.src);

    expect(flagSources.length).toBeGreaterThanOrEqual(200);
    expect(flagSources.every((source) =>
      source.startsWith("chrome-extension://options-id/assets/twemoji/")
    )).toBe(true);
    expect(flagSources.some((source) => /^https?:/.test(source))).toBe(false);
  });

  it("closes search dropdown when Escape key is pressed", async () => {
    const page = await renderOptionsPage();
    const trigger = page.querySelector("#country-trigger");
    const searchInput = page.querySelector("#country-search");

    trigger.click();
    expect(page.querySelector("#country-menu").hidden).toBe(false);

    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(page.querySelector("#country-menu").hidden).toBe(true);
  });

  it("prevents script injection from hostile defaultCountry stored settings", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: '<img src=x onerror="window.hacked=true">'
    });

    const page = await renderOptionsPage();

    expect(page.querySelector('img[src="x"]')).toBeNull();
    expect(window.hacked).toBeUndefined();
  });

  it("requests optional site access before enabling page helpers", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: false,
      defaultCountry: ""
    });
    const page = await renderOptionsPage();
    const toggle = page.querySelector("#auto-highlight");

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(mockStorage.setAutoHighlightEnabled).toHaveBeenCalledWith(true));

    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ["http://*/*", "https://*/*"]
    });
  });

  it("keeps page helpers disabled when optional site access is denied", async () => {
    chrome.permissions.request.mockResolvedValue(false);
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: false,
      defaultCountry: ""
    });
    const page = await renderOptionsPage();
    const toggle = page.querySelector("#auto-highlight");

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(mockStorage.setAutoHighlightEnabled).toHaveBeenCalledWith(false));

    expect(toggle.checked).toBe(false);
    expect(page.querySelector("#saved-status").dataset.state).toBe("error");
  });

  it("reconciles stale enabled settings when site access was revoked", async () => {
    chrome.permissions.contains.mockResolvedValue(false);

    const page = await renderOptionsPage();

    expect(mockStorage.setAutoHighlightEnabled).toHaveBeenCalledWith(false);
    expect(page.querySelector("#auto-highlight").checked).toBe(false);
  });

  it("removes optional site access when page helpers are disabled", async () => {
    const page = await renderOptionsPage();
    const toggle = page.querySelector("#auto-highlight");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(mockStorage.setAutoHighlightEnabled).toHaveBeenCalledWith(false));

    expect(chrome.permissions.remove).toHaveBeenCalledWith({
      origins: ["http://*/*", "https://*/*"]
    });
    expect(page.querySelector("#saved-status").dataset.state).toBe("success");
  });

  it("restores the toggle and displays an error when permission removal fails", async () => {
    chrome.permissions.remove.mockRejectedValue(new Error("permission API unavailable"));
    const page = await renderOptionsPage();
    const toggle = page.querySelector("#auto-highlight");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(page.querySelector("#saved-status").dataset.state).toBe("error"));

    expect(toggle.checked).toBe(true);
    expect(mockStorage.setAutoHighlightEnabled).not.toHaveBeenCalled();
  });

  it("associates the page access disclosure with the permission toggle", async () => {
    const page = await renderOptionsPage();
    const toggle = page.querySelector("#auto-highlight");
    const disclosure = page.querySelector("#page-access-disclosure");

    expect(toggle.getAttribute("aria-describedby")).toBe("page-access-disclosure");
    expect(disclosure.textContent.trim().length).toBeGreaterThan(20);
  });
});
