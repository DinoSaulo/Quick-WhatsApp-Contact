/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStorage = vi.hoisted(() => ({
  getLastCountry: vi.fn(),
  getSettings: vi.fn(),
  saveLastCountry: vi.fn()
}));

const mockLocation = vi.hoisted(() => ({
  detectCountryCodeFromBrowserLocation: vi.fn()
}));

vi.mock("../src/utils/storage.js", () => mockStorage);
vi.mock("../src/utils/location.js", () => mockLocation);

async function renderDdiScreen() {
  if (!customElements.get("country-ddi-screen")) {
    await import("../src/popup/ddi.js");
  }

  document.body.innerHTML = "<country-ddi-screen></country-ddi-screen>";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.querySelector("country-ddi-screen");
}

describe("country DDI screen mask integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      defaultCountry: "PT"
    });
    mockStorage.getLastCountry.mockResolvedValue("");
    mockStorage.saveLastCountry.mockResolvedValue();
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("US");
    global.chrome = { tabs: { create: vi.fn().mockResolvedValue({}) } };
    window.close = vi.fn();
  });

  it("uses the selected country's placeholder on first render", async () => {
    const screen = await renderDdiScreen();

    expect(screen.querySelector("#country-hidden").value).toBe("PT");
    expect(screen.querySelector("#local-number").placeholder).toBe("___ ___ ___");
  });

  it("applies the selected country mask while typing", async () => {
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");

    input.value = "912345678";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(input.value).toBe("912 345 678");
  });

  it("strips punctuation before applying the mask", async () => {
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");

    input.value = "(912)-345.678";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(input.value).toBe("912 345 678");
  });

  it("truncates input to the number of positions in the mask", async () => {
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");

    input.value = "912345678999";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(input.value).toBe("912 345 678");
  });

  it("reformats the current value and placeholder after changing country", async () => {
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");
    input.value = "912345678";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    screen.querySelector('[data-country-code="US"]').click();

    expect(screen.querySelector("#country-hidden").value).toBe("US");
    expect(input.value).toBe("912 345 678");
    expect(input.placeholder).toBe("___ ___ ____");
    expect(screen.querySelector("#country-trigger").textContent).toContain("+1");
  });

  it("recomputes the preview after masking typed input", async () => {
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");

    input.value = "912345678";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(screen.querySelector("#preview").textContent).toContain("351912345678");
  });

  it("recomputes the preview with the new DDI after changing country", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      defaultCountry: "BR"
    });
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");
    input.value = "4155552671";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    screen.querySelector('[data-country-code="US"]').click();

    expect(input.value).toBe("415 555 2671");
    expect(screen.querySelector("#preview").textContent).toContain("14155552671");
  });

  it("submits a masked local number as digits with the selected DDI", async () => {
    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");
    input.value = "912345678";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    screen.querySelector("#ddi-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStorage.saveLastCountry).toHaveBeenCalledWith("PT");
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://wa.me/351912345678",
      active: true
    });
  });

  it("filters country options in ddi screen by search query", async () => {
    const screen = await renderDdiScreen();
    const trigger = screen.querySelector("#country-trigger");
    const searchInput = screen.querySelector("#country-search");
    const noResults = screen.querySelector("#country-no-results");
    const options = screen.querySelectorAll(".country-picker__option");

    trigger.click();
    expect(searchInput.placeholder).toBe("Search country...");

    searchInput.value = "Alemanha";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    const visibleOptions = Array.from(options).filter((option) => !option.hidden);
    expect(visibleOptions.length).toBe(1);
    expect(visibleOptions[0].getAttribute("data-country-code")).toBe("DE");
    expect(noResults.hidden).toBe(true);
  });
});
