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
  });

  it("renders default country picker with Automatic option when defaultCountry is empty", async () => {
    const page = await renderOptionsPage();
    const hiddenInput = page.querySelector("#default-country-hidden");
    const trigger = page.querySelector("#country-trigger");

    expect(hiddenInput.value).toBe("");
    expect(trigger.textContent).toContain("— Automatic —");
  });

  it("renders configured default country with flag image and DDI", async () => {
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
    expect(trigger.querySelector(".country-picker__flag-img")?.getAttribute("src")).toBe(
      "https://flagcdn.com/w40/pt.png"
    );
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
});
