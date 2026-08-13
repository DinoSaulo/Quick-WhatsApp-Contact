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

// ddi.js is reachable with an attacker-influenced URL in a way background.js's own
// selection pipeline (see "background selection security integration" in
// background.integration.test.js) never sees: getNumberFromQuery() reads the ?number=
// query string straight from window.location, bypassing background.js's isLikelyPhoneText
// gate entirely. render() then interpolates that value, unescaped, into an HTML attribute
// (value="${this.initialNumber}") — so this suite proves the *last* line of defense,
// normalizeSelectedNumber() stripping everything but digits and "+" before render() ever
// runs, actually holds at the DOM level, not just at the sanitizer's own unit tests.
describe("country DDI screen query parameter security", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/src/popup/ddi.html");
  });

  it("strips HTML/script syntax from a hostile ?number= query parameter before rendering it", async () => {
    // alert("x") deliberately has no digits in it (unlike alert(1)) — normalizeSelectedNumber()
    // keeps every digit character it sees, including ones sitting inside an attack payload, so
    // a numeral in the payload itself would legitimately survive sanitization and throw off the
    // expected digit string below without indicating any real bug.
    const payload = '"><img src=x onerror=alert("x")>912345678';
    window.history.pushState({}, "", `/src/popup/ddi.html?number=${encodeURIComponent(payload)}`);

    const screen = await renderDdiScreen();
    const input = screen.querySelector("#local-number");

    // A successful attribute breakout would parse a real, attacker-controlled <img
    // onerror> element into the document. None of this page's legitimate markup
    // (country flag icons included) ever sets an onerror attribute, so finding one here
    // means the payload escaped the value="..." attribute instead of being neutralized.
    expect(document.querySelector("img[onerror]")).toBeNull();
    // The mask formats digits with spaces, so compare only against the digit stream, not the
    // exact display string — 912345678 is deliberately sized to fit Portugal's 9-digit local
    // mask (this suite's default country) without truncation.
    expect(input.value.replace(/\D/g, "")).toBe("912345678");
    expect(input.value).toMatch(/^[\d\s]*$/);
  });

  it("renders an empty field instead of any markup for a query parameter with no phone digits", async () => {
    window.history.pushState(
      {},
      "",
      `/src/popup/ddi.html?number=${encodeURIComponent('"><svg onload=alert("x")>')}`
    );

    const screen = await renderDdiScreen();

    expect(document.querySelectorAll("svg").length).toBe(0);
    expect(screen.querySelector("#local-number").value).toBe("");
  });
});
