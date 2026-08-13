/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

// DONATION_METHODS is a hardcoded, developer-authored list today (see src/utils/donation.js) —
// nothing in it is currently attacker-reachable. This suite exists anyway, as a regression
// guard on donationModal.js's own escapeHtml() convention: every interpolated method field is
// supposed to go through escapeHtml() before landing in the template (see render() there), and
// a value this trusted is exactly the kind of thing a future refactor stops escaping "because
// it's safe anyway" — right up until the data source changes. Mocking a hostile
// DONATION_METHODS here proves the rendering function itself is safe independent of how much
// today's data source can be trusted.
const mockDonation = vi.hoisted(() => ({
  DONATION_METHODS: [
    {
      id: '"><img src=x onerror=alert(1)>',
      name: '<script>window.qwcPwned="name"</script>',
      copyText: '"><svg onload=alert(1)>',
      link: 'javascript:alert(document.cookie)',
      qrAsset: "assets/donation-qrcodes/pix.svg"
    }
  ]
}));

const mockStorage = vi.hoisted(() => ({
  consumePendingDonationOpen: vi.fn(),
  getSettings: vi.fn()
}));

vi.mock("../src/utils/donation.js", () => mockDonation);
vi.mock("../src/utils/storage.js", () => mockStorage);

function polyfillDialog() {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.open = false;
    };
  }
}

async function renderDonationModal() {
  if (!customElements.get("donation-modal")) {
    await import("../src/options/donationModal.js");
  }

  document.body.innerHTML = "<donation-modal></donation-modal>";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.querySelector("donation-modal");
}

describe("donation modal escaping (hostile DONATION_METHODS)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    polyfillDialog();
    // Reset in case a previous test mutated the shared mock (see the https:// link test below).
    mockDonation.DONATION_METHODS[0].link = "javascript:alert(document.cookie)";
    mockStorage.getSettings.mockResolvedValue({ language: "en-US" });
    mockStorage.consumePendingDonationOpen.mockResolvedValue(false);
    global.chrome = {
      runtime: { getURL: vi.fn((path) => `chrome-extension://options-id/${path}`) }
    };
  });

  it("never lets a hostile method.name/id/copyText break out of the tab and panel markup", async () => {
    const modal = await renderDonationModal();
    modal.querySelector("#donation-trigger").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // A successful attribute/tag breakout would parse these as real elements.
    expect(document.querySelector("img[onerror]")).toBeNull();
    expect(document.querySelector("svg[onload]")).toBeNull();
    expect(document.querySelector("script:not([type='module']):not([src])")).toBeNull();

    // The payload should still be visible, but only as inert text/attribute content.
    const tab = modal.querySelector(".donation-tabs__tab");
    expect(tab.textContent).toContain('<script>window.qwcPwned="name"</script>');
    expect(tab.innerHTML).not.toContain("<script>window.qwcPwned");
  });

  it("escapes a hostile method.id even though it drives id/data-* attribute values", async () => {
    const modal = await renderDonationModal();

    // getAttribute() returns the decoded value regardless of how it was escaped in markup —
    // what matters is that the parser never saw an unescaped '>' or '"' and split the tag.
    const tab = modal.querySelector(".donation-tabs__tab");
    expect(tab.getAttribute("data-method-id")).toBe('"><img src=x onerror=alert(1)>');
    expect(modal.querySelectorAll(".donation-tabs__tab").length).toBe(1);
    expect(modal.querySelectorAll(".donation-panel").length).toBe(1);
  });

  it("suppresses the Open button entirely instead of building a javascript: hyperlink", async () => {
    const modal = await renderDonationModal();
    modal.querySelector("#donation-trigger").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // render()'s hasSafeLink check only allows https:// links through — a "javascript:"
    // method.link renders no link at all rather than a live, clickable one.
    expect(modal.querySelector(".donation-panel__link")).toBeNull();
  });

  it("still renders an https:// method.link as a real Open link", async () => {
    mockDonation.DONATION_METHODS[0].link = "https://example.com/donate";
    const modal = await renderDonationModal();
    modal.querySelector("#donation-trigger").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const link = modal.querySelector(".donation-panel__link");
    expect(link.getAttribute("href")).toBe("https://example.com/donate");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
