/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const popupStyles = readFileSync(
  resolve(import.meta.dirname, "../src/popup/styles.css"),
  "utf8"
);

const mockStorage = vi.hoisted(() => ({
  consumePendingContextCountry: vi.fn(),
  consumePendingContextNumber: vi.fn(),
  getLastCountry: vi.fn(),
  getSettings: vi.fn(),
  saveLastCountry: vi.fn(),
  setPendingDonationOpen: vi.fn()
}));

const mockLocation = vi.hoisted(() => ({
  detectCountryCodeFromBrowserLocation: vi.fn()
}));

vi.mock("../src/utils/storage.js", () => mockStorage);
vi.mock("../src/utils/location.js", () => mockLocation);

async function renderPopup() {
  if (!customElements.get("whatsapp-message-popup")) {
    await import("../src/popup/popup.js");
  }

  document.body.innerHTML = "<whatsapp-message-popup></whatsapp-message-popup>";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.querySelector("whatsapp-message-popup");
}

describe("popup integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: ""
    });
    mockStorage.consumePendingContextNumber.mockResolvedValue("");
    mockStorage.consumePendingContextCountry.mockResolvedValue("");
    mockStorage.getLastCountry.mockResolvedValue("US");
    mockStorage.saveLastCountry.mockResolvedValue();
    mockStorage.setPendingDonationOpen.mockResolvedValue();
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("US");

    global.chrome = {
      tabs: {
        create: vi.fn().mockResolvedValue({})
      },
      runtime: {
        openOptionsPage: vi.fn().mockResolvedValue({}),
        getURL: vi.fn((path) => `chrome-extension://popup-id/${path}`)
      }
    };

    window.close = vi.fn();
  });

  it("keeps the popup compact and prevents root scrollbars", () => {
    expect(popupStyles).toMatch(
      /body\.popup-shell\s*\{[^}]*width:\s*360px;[^}]*overflow:\s*hidden;/s
    );
    expect(popupStyles).toMatch(/\.popup-shell \.panel\s*\{[^}]*padding:\s*12px;/s);
    expect(popupStyles).toMatch(
      /\.popup-shell \.card__content\s*\{[^}]*padding:\s*16px;/s
    );
    expect(popupStyles).toMatch(
      /\.popup-shell \.field textarea\s*\{[^}]*min-height:\s*72px;[^}]*resize:\s*none;/s
    );
    expect(popupStyles).toMatch(
      /\.popup-shell \.country-picker__menu\s*\{[^}]*max-height:\s*240px;/s
    );
  });

  it("renders the selected country flag from a packaged Twemoji asset", async () => {
    mockStorage.getLastCountry.mockResolvedValue("US");

    const popup = await renderPopup();
    const flag = popup.querySelector("#country-trigger .country-picker__flag-img");

    expect(flag?.getAttribute("src")).toBe(
      "chrome-extension://popup-id/assets/twemoji/1f1fa-1f1f8.svg"
    );
    expect(flag?.getAttribute("src")).not.toContain("http");
  });

  it("updates the packaged flag when the selected country changes", async () => {
    const popup = await renderPopup();

    popup.querySelector('[data-country-code="PT"]').click();

    const flag = popup.querySelector("#country-trigger .country-picker__flag-img");
    expect(popup.querySelector("#country-hidden").value).toBe("PT");
    expect(flag?.src).toBe(
      "chrome-extension://popup-id/assets/twemoji/1f1f5-1f1f9.svg"
    );
  });

  it("renders all popup country flags without HTTP image sources", async () => {
    const popup = await renderPopup();
    const flagSources = Array.from(
      popup.querySelectorAll(".country-picker__option .country-picker__flag-img")
    ).map((image) => image.src);

    expect(flagSources.length).toBeGreaterThanOrEqual(200);
    expect(flagSources.every((source) =>
      source.startsWith("chrome-extension://popup-id/assets/twemoji/")
    )).toBe(true);
    expect(flagSources.some((source) => /^https?:/.test(source))).toBe(false);
  });

  it("falls back to a known country when synced country settings contain hostile markup", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: '\"><img src=x onerror=alert("x")>'
    });
    mockStorage.getLastCountry.mockResolvedValue("");
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("");

    const popup = await renderPopup();
    const hiddenCountry = popup.querySelector("#country-hidden");

    expect(document.querySelector("img[onerror]")).toBeNull();
    expect(hiddenCountry.value).toMatch(/^[A-Z]{2}(?:-[A-Z0-9]+)?$/);
    expect(popup.querySelectorAll(".country-picker__option").length).toBeGreaterThanOrEqual(200);
  });

  it("accepts a Brazilian mobile number with DDD and opens WhatsApp", async () => {
    mockStorage.consumePendingContextNumber.mockResolvedValue("81986006397");
    mockStorage.consumePendingContextCountry.mockResolvedValue("BR");
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("BR");

    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");
    const form = popup.querySelector("#message-form");

    phoneInput.value = "81 98600 6397";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://wa.me/5581986006397",
      active: true
    });
    expect(mockStorage.saveLastCountry).toHaveBeenCalledWith("BR");
    expect(phoneInput.validationMessage).toBe("");
  });

  // render() interpolates this.pendingContextNumber straight into value="${...}", unescaped
  // (see popup.js). In real usage it always comes from normalizeSelectedNumber() already
  // (background.js's own storage read), but this proves the render layer's OWN call to
  // normalizeSelectedNumber() — not just background.js's upstream gate, already covered in
  // background.integration.test.js — is what actually keeps the phone input's HTML safe,
  // even if a hostile value ever reached storage some other way (e.g. a future bug upstream).
  it("neutralizes an HTML/script payload in the pending context number before rendering it", async () => {
    // alert("x") deliberately has no digits (unlike alert(1)) — normalizeSelectedNumber() keeps
    // every digit it sees, including ones inside an attack payload, so a numeral there would
    // legitimately survive sanitization and throw off the expected number below on its own.
    mockStorage.consumePendingContextNumber.mockResolvedValue(
      '"><img src=x onerror=alert("x")>+351912345678'
    );

    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");

    expect(document.querySelector("img[onerror]")).toBeNull();
    expect(phoneInput.value).toBe("+351912345678");
    expect(phoneInput.value).toMatch(/^\+?\d*$/);
  });

  it("nao concatena novamente quando numero ja possui +DDI", async () => {
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");
    const form = popup.querySelector("#message-form");

    phoneInput.value = "+351912345678";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://wa.me/351912345678",
      active: true
    });
    expect(mockStorage.saveLastCountry).not.toHaveBeenCalled();
  });

  it("seleciona BR como pais default quando idioma da extensao e pt-BR", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "pt-BR",
      darkModeEnabled: false,
      autoHighlightEnabled: true
    });
    mockStorage.consumePendingContextNumber.mockResolvedValue("11912345678");
    mockStorage.consumePendingContextCountry.mockResolvedValue("");
    mockStorage.getLastCountry.mockResolvedValue("");
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("");

    const popup = await renderPopup();
    const countryHidden = popup.querySelector("#country-hidden");
    expect(countryHidden.value).toBe("BR");
  });

  it("seleciona US como pais default quando idioma da extensao e en-US", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true
    });
    mockStorage.consumePendingContextNumber.mockResolvedValue("555-1234");
    mockStorage.consumePendingContextCountry.mockResolvedValue("");
    mockStorage.getLastCountry.mockResolvedValue("");
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("");

    const popup = await renderPopup();
    const countryHidden = popup.querySelector("#country-hidden");
    expect(countryHidden.value).toBe("US");
  });

  it("uses the configured default country before the last and detected countries", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: "PT"
    });
    mockStorage.getLastCountry.mockResolvedValue("BR");
    mockLocation.detectCountryCodeFromBrowserLocation.mockReturnValue("US");

    const popup = await renderPopup();

    expect(popup.querySelector("#country-hidden").value).toBe("PT");
  });

  it("keeps the context country ahead of the configured default country", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: "PT"
    });
    mockStorage.consumePendingContextNumber.mockResolvedValue("11999999999");
    mockStorage.consumePendingContextCountry.mockResolvedValue("BR");

    const popup = await renderPopup();

    expect(popup.querySelector("#country-hidden").value).toBe("BR");
  });

  it("shows the placeholder for the initially selected country", async () => {
    mockStorage.getLastCountry.mockResolvedValue("PT");

    const popup = await renderPopup();

    expect(popup.querySelector("#phone").placeholder).toBe("___ ___ ___");
  });

  it("masks a pending local number using its context country", async () => {
    mockStorage.consumePendingContextNumber.mockResolvedValue("11999998888");
    mockStorage.consumePendingContextCountry.mockResolvedValue("BR");

    const popup = await renderPopup();

    expect(popup.querySelector("#phone").value).toBe("11 99999 8888");
    expect(popup.querySelector("#phone").placeholder).toBe("__ _____ ____");
  });

  it("masks digits as the user types for the selected country", async () => {
    mockStorage.getLastCountry.mockResolvedValue("US");
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");

    phoneInput.value = "4155552671";
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(phoneInput.value).toBe("415 555 2671");
  });

  it("reformats and truncates the local number when the selected country changes", async () => {
    mockStorage.getLastCountry.mockResolvedValue("BR");
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");
    phoneInput.value = "11999998888";
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

    popup.querySelector('[data-country-code="PT"]').click();

    expect(popup.querySelector("#country-hidden").value).toBe("PT");
    expect(phoneInput.value).toBe("119 999 988");
    expect(phoneInput.placeholder).toBe("___ ___ ___");
    expect(popup.querySelector("#country-trigger").textContent).toContain("+351");
  });

  it("does not mask a complete international number", async () => {
    mockStorage.getLastCountry.mockResolvedValue("BR");
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");

    phoneInput.value = "+351 912 345 678";
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(phoneInput.value).toBe("+351 912 345 678");
    expect(phoneInput.placeholder).toBe("+55...");
  });

  it("starts masking again after an international prefix is removed", async () => {
    mockStorage.getLastCountry.mockResolvedValue("PT");
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");

    phoneInput.value = "912345678";
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(phoneInput.value).toBe("912 345 678");
    expect(phoneInput.placeholder).toBe("___ ___ ___");
  });

  it("submits the digits from a masked local number with the selected DDI", async () => {
    mockStorage.getLastCountry.mockResolvedValue("PT");
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");
    phoneInput.value = "912345678";
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

    popup.querySelector("#message-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://wa.me/351912345678",
      active: true
    });
    expect(mockStorage.saveLastCountry).toHaveBeenCalledWith("PT");
  });

  it("sanitizes hostile pending content before inserting it into the DOM", async () => {
    mockStorage.consumePendingContextNumber.mockResolvedValue(
      '<img src=x onerror="window.hacked=true">11999998888<script>window.hacked=true</script>'
    );
    mockStorage.consumePendingContextCountry.mockResolvedValue("BR");

    const popup = await renderPopup();

    expect(popup.querySelector("#phone").value).toBe("11 99999 8888");
    expect(popup.querySelector("script")).toBeNull();
    expect(popup.querySelector('img[src="x"]')).toBeNull();
    expect(window.hacked).toBeUndefined();
  });

  it("does not render a corrupted stored country value as HTML", async () => {
    mockStorage.getSettings.mockResolvedValue({
      language: "en-US",
      darkModeEnabled: false,
      autoHighlightEnabled: true,
      defaultCountry: '<img src=x onerror="window.hacked=true">'
    });

    const popup = await renderPopup();

    expect(popup.querySelector('img[src="x"]')).toBeNull();
    expect(window.hacked).toBeUndefined();
  });

  it("encodes a hostile message into one WhatsApp text parameter", async () => {
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");
    const messageInput = popup.querySelector("#message");
    phoneInput.value = "+351912345678";
    messageInput.value = '<script>alert("x")</script>&admin=true#fragment';

    popup.querySelector("#message-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const openedUrl = chrome.tabs.create.mock.calls[0][0].url;
    const parsedUrl = new URL(openedUrl);
    expect(parsedUrl.origin).toBe("https://wa.me");
    expect(parsedUrl.searchParams.get("text")).toBe(messageInput.value);
    expect(parsedUrl.searchParams.get("admin")).toBeNull();
    expect(openedUrl).not.toContain("<script>");
  });

  it("does not open a tab or persist a country for an invalid local number", async () => {
    mockStorage.getLastCountry.mockResolvedValue("PT");
    const popup = await renderPopup();
    const phoneInput = popup.querySelector("#phone");
    phoneInput.value = "123";

    popup.querySelector("#message-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(mockStorage.saveLastCountry).not.toHaveBeenCalled();
    expect(phoneInput.validationMessage).not.toBe("");
  });

  it("rejects a scheme-like phone payload", async () => {
    const popup = await renderPopup();
    popup.querySelector("#phone").value = "javascript:+351912345678";

    popup.querySelector("#message-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(popup.querySelector("#phone").validationMessage).not.toBe("");
  });

  it("filters country dropdown options by search input query", async () => {
    const popup = await renderPopup();
    const trigger = popup.querySelector("#country-trigger");
    const searchInput = popup.querySelector("#country-search");
    const noResults = popup.querySelector("#country-no-results");
    const options = popup.querySelectorAll(".country-picker__option");

    trigger.click();
    expect(searchInput.placeholder).toBe("Search country...");

    searchInput.value = "Brasil";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    const visibleOptions = Array.from(options).filter((option) => !option.hidden);
    expect(visibleOptions.length).toBe(1);
    expect(visibleOptions[0].getAttribute("data-country-code")).toBe("BR");
    expect(visibleOptions[0].style.display).toBe("");
    expect(Array.from(options).filter((option) => option.hidden).every(
      (option) => option.style.display === "none" && option.getAttribute("aria-hidden") === "true"
    )).toBe(true);
    expect(noResults.hidden).toBe(true);

    searchInput.value = "xyz123nonexistent";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    const visibleAfterNoMatch = Array.from(options).filter((option) => !option.hidden);
    expect(visibleAfterNoMatch.length).toBe(0);
    expect(noResults.hidden).toBe(false);
  });

  it("keeps the search focused and resets filtered countries when reopened", async () => {
    const popup = await renderPopup();
    const trigger = popup.querySelector("#country-trigger");
    const searchInput = popup.querySelector("#country-search");
    const options = Array.from(popup.querySelectorAll(".country-picker__option"));

    trigger.click();
    expect(document.activeElement).toBe(searchInput);

    searchInput.value = "portugal";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(options.filter((option) => option.style.display !== "none")).toHaveLength(1);

    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(popup.querySelector("#country-menu").hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    expect(searchInput.value).toBe("");
    expect(options.every((option) => option.style.display === "")).toBe(true);
  });

  it("flags the donation modal to auto-open, then opens the options page and closes the popup when the donation button is clicked", async () => {
    if (!customElements.get("whatsapp-message-popup")) {
      await import("../src/popup/popup.js");
    }
    // O botão de doação vive no <footer> de popup.html, fora do custom element — por isso
    // os dois precisam já estar em document.body quando bindEvents() rodar (dentro do
    // connectedCallback), já que o listener é anexado com document.querySelector, não this.
    document.body.innerHTML =
      '<whatsapp-message-popup></whatsapp-message-popup>' +
      '<footer><button id="donation-button" type="button">☕ Buy me a coffee</button></footer>';
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector("#donation-button").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // setPendingDonationOpen() precisa resolver ANTES de abrirmos a página de opções,
    // senão donationModal.js pode montar e ler o storage antes da flag existir.
    expect(mockStorage.setPendingDonationOpen).toHaveBeenCalled();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    expect(window.close).toHaveBeenCalled();
    expect(mockStorage.setPendingDonationOpen.mock.invocationCallOrder[0]).toBeLessThan(
      chrome.runtime.openOptionsPage.mock.invocationCallOrder[0]
    );
  });
});
