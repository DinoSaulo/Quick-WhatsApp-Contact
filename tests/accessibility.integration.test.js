/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  consumePendingContextCountry: vi.fn(),
  consumePendingContextNumber: vi.fn(),
  getLastCountry: vi.fn(),
  getSettings: vi.fn(),
  saveLastCountry: vi.fn(),
  setPendingDonationOpen: vi.fn()
}));
const location = vi.hoisted(() => ({ detectCountryCodeFromBrowserLocation: vi.fn() }));

vi.mock("../src/utils/storage.js", () => storage);
vi.mock("../src/utils/location.js", () => location);

async function renderPopup() {
  if (!customElements.get("whatsapp-message-popup")) {
    await import("../src/popup/popup.js");
  }
  document.body.innerHTML = "<whatsapp-message-popup></whatsapp-message-popup>";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.querySelector("whatsapp-message-popup");
}

describe("popup accessibility boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getSettings.mockResolvedValue({ language: "en-US", darkModeEnabled: false, defaultCountry: "" });
    storage.consumePendingContextCountry.mockResolvedValue("");
    storage.consumePendingContextNumber.mockResolvedValue("");
    storage.getLastCountry.mockResolvedValue("US");
    storage.saveLastCountry.mockResolvedValue();
    storage.setPendingDonationOpen.mockResolvedValue();
    location.detectCountryCodeFromBrowserLocation.mockReturnValue("US");
    global.chrome = {
      runtime: { getURL: (path) => `chrome-extension://test/${path}`, openOptionsPage: vi.fn() },
      tabs: { create: vi.fn() }
    };
  });

  it("gives every rendered button an accessible name", async () => {
    const popup = await renderPopup();
    const unnamed = [...popup.querySelectorAll("button")].filter((button) => {
      const name = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent;
      return !name?.trim();
    });

    expect(unnamed).toEqual([]);
  });

  it("associates labels with the phone and message controls", async () => {
    const popup = await renderPopup();

    for (const id of ["phone", "message", "country-hidden"]) {
      expect(popup.querySelector(`label[for="${id}"]`), `Missing label for ${id}`).not.toBeNull();
    }
    expect(popup.querySelector("#country-trigger").getAttribute("aria-expanded")).toBe("false");
  });
});
