/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const optionsStyles = readFileSync(
  resolve(import.meta.dirname, "../src/options/options.css"),
  "utf8"
);

const mockStorage = vi.hoisted(() => ({
  consumePendingDonationOpen: vi.fn(),
  getSettings: vi.fn()
}));

vi.mock("../src/utils/storage.js", () => mockStorage);

// jsdom (as of 29.x) does not implement HTMLDialogElement.showModal()/close() yet —
// Chrome (minimum_chrome_version 127 in manifest.json) fully supports both natively,
// this polyfill only exists so the component's real, un-mocked code is testable here.
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

// O clique no gatilho agora relê o idioma do storage (async) antes de abrir o dialog
// (ver loadAndRender em donationModal.js), e isso substitui todo o innerHTML — então
// qualquer referência a #donation-dialog capturada ANTES do clique fica obsoleta.
// Este helper espera a re-renderização e devolve o <dialog> atual.
async function openDonationDialog(modal) {
  modal.querySelector("#donation-trigger").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return modal.querySelector("#donation-dialog");
}

describe("donation modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    polyfillDialog();

    mockStorage.getSettings.mockResolvedValue({ language: "en-US" });
    mockStorage.consumePendingDonationOpen.mockResolvedValue(false);
    global.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://options-id/${path}`)
      }
    };
    global.navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
  });

  it("shows the Buy me a coffee trigger button", async () => {
    const modal = await renderDonationModal();
    const trigger = modal.querySelector("#donation-trigger");

    expect(trigger?.textContent).toContain("Buy me a coffee");
  });

  it("stays closed on mount by default (consumePendingDonationOpen resolves false)", async () => {
    const modal = await renderDonationModal();

    expect(modal.querySelector("#donation-dialog").open).toBe(false);
    expect(mockStorage.consumePendingDonationOpen).toHaveBeenCalled();
  });

  // Regressão: clicar em "Buy me a coffee" no popup (popup.js) chama setPendingDonationOpen()
  // e depois abre options.html — este componente precisa ler e consumir essa flag sozinho
  // assim que montado, já que popup.js não tem como chamar nada diretamente nele.
  it("auto-opens the dialog on mount when a donation open was flagged pending (opened from the popup)", async () => {
    mockStorage.consumePendingDonationOpen.mockResolvedValue(true);
    const modal = await renderDonationModal();

    expect(modal.querySelector("#donation-dialog").open).toBe(true);
  });

  it("opens the dialog with PIX, MB WAY and PayPal tabs, PIX active by default", async () => {
    const modal = await renderDonationModal();
    const dialog = await openDonationDialog(modal);

    expect(dialog.open).toBe(true);
    const tabs = modal.querySelectorAll(".donation-tabs__tab");
    expect(Array.from(tabs).map((tab) => tab.textContent.trim())).toEqual(["PIX", "MB WAY", "PayPal"]);
    expect(modal.querySelector("#donation-tab-pix").getAttribute("aria-selected")).toBe("true");
    expect(modal.querySelector('[data-method-panel="pix"]').hidden).toBe(false);
    expect(modal.querySelector('[data-method-panel="mbway"]').hidden).toBe(true);
  });

  it("renders the PIX QR code, copy button and Nubank link using the real payload", async () => {
    const modal = await renderDonationModal();
    const pixPanel = modal.querySelector('[data-method-panel="pix"]');

    const qrImg = pixPanel.querySelector(".donation-panel__qr");
    expect(qrImg.getAttribute("src")).toBe("chrome-extension://options-id/assets/donation-qrcodes/pix.svg");

    const value = pixPanel.querySelector(".donation-panel__value");
    expect(value.tagName).toBe("INPUT");
    expect(value.readOnly).toBe(true);
    expect(value.value).toContain("BR.GOV.BCB.PIX");

    const link = pixPanel.querySelector(".donation-panel__link");
    expect(link.getAttribute("href")).toBe("https://nubank.com.br/cobrar/525f3/6a7c8dcb-ae41-452d-919c-418fbe5e3bcb");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders the official MB WAY/Revolut QR image, the link as copyable text, and an Open button", async () => {
    const modal = await renderDonationModal();
    const mbwayPanel = modal.querySelector('[data-method-panel="mbway"]');

    const qrImg = mbwayPanel.querySelector(".donation-panel__qr");
    expect(qrImg.getAttribute("src")).toBe("chrome-extension://options-id/assets/donation-qrcodes/mbway.png");

    const value = mbwayPanel.querySelector(".donation-panel__value");
    expect(value.readOnly).toBe(true);
    expect(value.value).toBe("https://revolut.me/saulo_barros?currency=EUR&amount=100");

    const link = mbwayPanel.querySelector(".donation-panel__link");
    expect(link.getAttribute("href")).toBe("https://revolut.me/saulo_barros?currency=EUR&amount=100");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(mbwayPanel.querySelector(".donation-panel__unavailable")).toBeNull();
  });

  // Regressão: display:flex em .donation-panel tem a mesma especificidade que o
  // [hidden] do stylesheet do navegador — sem esta regra explícita, alternar `hidden`
  // via JS não escondia visualmente o painel (as 3 seções ficavam empilhadas e
  // visíveis ao mesmo tempo, ainda que os testes de `panel.hidden` acima passassem,
  // já que jsdom não aplica cascata de CSS/layout).
  it("keeps [hidden] panels actually hidden despite the flex display rule", () => {
    expect(optionsStyles).toMatch(
      /\.donation-panel\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s
    );
  });

  it("renders the official PayPal QR image, the e-mail as copyable text, and no link button", async () => {
    const modal = await renderDonationModal();
    const paypalPanel = modal.querySelector('[data-method-panel="paypal"]');

    const qrImg = paypalPanel.querySelector(".donation-panel__qr");
    expect(qrImg.getAttribute("src")).toBe("chrome-extension://options-id/assets/donation-qrcodes/paypal.png");

    const value = paypalPanel.querySelector(".donation-panel__value");
    expect(value.readOnly).toBe(true);
    expect(value.value).toBe("saulbpt@gmail.com");

    // Sem `link` definido (PayPal usa só o QR oficial + e-mail), não deve haver botão "Abrir".
    expect(paypalPanel.querySelector(".donation-panel__link")).toBeNull();
    expect(paypalPanel.querySelector(".donation-panel__unavailable")).toBeNull();
  });

  it("selects the whole value on click, for manual copy as a fallback to the Copy button", async () => {
    const modal = await renderDonationModal();
    const input = modal.querySelector('[data-value-input="pix"]');

    input.click();

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("switches the active tab and panel on click", async () => {
    const modal = await renderDonationModal();

    modal.querySelector("#donation-tab-paypal").click();

    expect(modal.querySelector("#donation-tab-pix").getAttribute("aria-selected")).toBe("false");
    expect(modal.querySelector("#donation-tab-paypal").getAttribute("aria-selected")).toBe("true");
    expect(modal.querySelector('[data-method-panel="pix"]').hidden).toBe(true);
    expect(modal.querySelector('[data-method-panel="paypal"]').hidden).toBe(false);
  });

  it("copies the PIX payload to the clipboard and shows feedback", async () => {
    const modal = await renderDonationModal();
    const copyButton = modal.querySelector('[data-copy-method="pix"]');

    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("BR.GOV.BCB.PIX")
    );
    const feedback = modal.querySelector('[data-copy-feedback="pix"]');
    expect(feedback.textContent).toBe("Copied!");
  });

  it("copies the PayPal e-mail to the clipboard and shows feedback", async () => {
    const modal = await renderDonationModal();
    const copyButton = modal.querySelector('[data-copy-method="paypal"]');

    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("saulbpt@gmail.com");
    const feedback = modal.querySelector('[data-copy-feedback="paypal"]');
    expect(feedback.textContent).toBe("Copied!");
  });

  it("shows an error message when the clipboard write fails", async () => {
    global.navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const modal = await renderDonationModal();
    const copyButton = modal.querySelector('[data-copy-method="pix"]');

    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const feedback = modal.querySelector('[data-copy-feedback="pix"]');
    expect(feedback.textContent).toBe("Could not copy automatically. Select the text and copy it manually.");
  });

  it("closes the dialog via the close button", async () => {
    const modal = await renderDonationModal();
    const dialog = await openDonationDialog(modal);
    expect(dialog.open).toBe(true);

    modal.querySelector("#donation-close").click();
    expect(dialog.open).toBe(false);
  });

  it("closes the dialog when the click target is the dialog itself (backdrop area)", async () => {
    const modal = await renderDonationModal();
    const dialog = await openDonationDialog(modal);
    expect(dialog.open).toBe(true);

    // Clicar em qualquer conteúdo interno (ex.: o título) NÃO deve fechar o modal —
    // só um clique cujo alvo é o próprio <dialog> (a área do backdrop) fecha.
    modal.querySelector(".donation-dialog__title").click();
    expect(dialog.open).toBe(true);

    dialog.click();
    expect(dialog.open).toBe(false);
  });

  it("shows the modal instructions in Portuguese after switching language to pt-BR, but keeps the trigger label in English", async () => {
    const modal = await renderDonationModal();

    // extension-settings-page (fora deste componente) muda o idioma no storage quando
    // o <select> é alterado; este componente não é avisado — só relê no próximo clique.
    mockStorage.getSettings.mockResolvedValue({ language: "pt-BR" });
    const dialog = await openDonationDialog(modal);

    expect(dialog.querySelector(".donation-dialog__title").textContent).toBe("Apoie este projeto");
    expect(dialog.querySelector("#donation-close").getAttribute("aria-label")).toBe("Fechar");
    expect(modal.querySelector('[data-copy-method="pix"]').textContent.trim()).toBe("Copiar");
    expect(modal.querySelector(".donation-panel__unavailable")).toBeNull();

    // O botão que abre o modal é tratado como nome de marca — não traduz.
    const trigger = modal.querySelector("#donation-trigger");
    expect(trigger.textContent).toContain("Buy me a coffee");
    expect(trigger.textContent).not.toContain("Café");
  });
});
