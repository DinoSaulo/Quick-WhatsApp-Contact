import { DONATION_METHODS } from "../utils/donation.js";
import { getMessages, t } from "../utils/i18n.js";
import { consumePendingDonationOpen, getSettings } from "../utils/storage.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class DonationModal extends HTMLElement {
  async connectedCallback() {
    this.activeMethodId = DONATION_METHODS[0]?.id ?? "";
    await this.loadAndRender();

    // Consumido uma única vez: se o popup nos mandou aqui via setPendingDonationOpen()
    // (botão "Buy me a coffee" clicado lá, ver popup.js), abre o modal já na primeira
    // renderização em vez de deixar o usuário procurar o botão flutuante de novo.
    const shouldOpenOnLoad = await consumePendingDonationOpen();
    if (shouldOpenOnLoad) {
      this.openDialog();
    }
  }

  openDialog() {
    this.querySelector("#donation-dialog")?.showModal();
  }

  // Re-lê o idioma do storage e re-renderiza. É chamado tanto na primeira montagem
  // quanto — mais importante — toda vez antes de abrir o modal (ver bindEvents):
  // este componente vive fora de <extension-settings-page> como um custom element
  // irmão, então não é avisado quando o <select> de idioma muda lá. Reler o storage
  // no momento do clique garante que o modal sempre abre no idioma atual, sem exigir
  // recarregar a página nem acoplar os dois componentes via evento customizado.
  async loadAndRender() {
    const settings = await getSettings();
    this.messages = getMessages(settings.language);
    this.render();
    this.bindEvents();
  }

  render() {
    const tabsMarkup = DONATION_METHODS.map((method) => `
      <button
        class="donation-tabs__tab"
        type="button"
        role="tab"
        id="donation-tab-${escapeHtml(method.id)}"
        aria-controls="donation-panel-${escapeHtml(method.id)}"
        aria-selected="${method.id === this.activeMethodId}"
        data-method-id="${escapeHtml(method.id)}"
      >${escapeHtml(method.name)}</button>
    `).join("");

    const panelsMarkup = DONATION_METHODS.map((method) => {
      // escapeHtml() only neutralizes HTML syntax (<, >, ", &) — it says nothing about the
      // URL *scheme*, so an unescaped "javascript:" or "data:" value would still render as a
      // real, clickable href. method.link is developer-authored today, but buildWhatsAppUrl()
      // (src/utils/phone.js) already treats scheme validation as mandatory for any URL this
      // codebase hands to the browser, so donation links get the same https-only allow-list.
      const hasSafeLink = typeof method.link === "string" && /^https:\/\//i.test(method.link);

      return `
      <div
        class="donation-panel"
        role="tabpanel"
        id="donation-panel-${escapeHtml(method.id)}"
        aria-labelledby="donation-tab-${escapeHtml(method.id)}"
        data-method-panel="${escapeHtml(method.id)}"
        ${method.id === this.activeMethodId ? "" : "hidden"}
      >
        ${method.copyText ? `
          <img
            class="donation-panel__qr"
            src="${chrome.runtime.getURL(method.qrAsset)}"
            alt="${escapeHtml(t(this.messages, "donationQrAlt", { method: method.name }))}"
            width="180"
            height="180"
          />
          <div class="donation-panel__copy-row">
            <input
              class="donation-panel__value"
              type="text"
              value="${escapeHtml(method.copyText)}"
              readonly
              aria-label="${escapeHtml(method.name)}"
              data-value-input="${escapeHtml(method.id)}"
            />
            <button class="button button--small button--secondary" type="button" data-copy-method="${escapeHtml(method.id)}">
              ${this.messages.donationCopyButton}
            </button>
          </div>
          ${hasSafeLink ? `
            <a class="donation-panel__link" href="${escapeHtml(method.link)}" target="_blank" rel="noopener noreferrer">
              ${this.messages.donationOpenLink} ↗
            </a>
          ` : ""}
          <p class="donation-panel__feedback" data-copy-feedback="${escapeHtml(method.id)}" aria-live="polite"></p>
        ` : `
          <p class="donation-panel__unavailable">${this.messages.donationUnavailable}</p>
        `}
      </div>
    `;
    }).join("");

    this.innerHTML = `
      <button class="button button--secondary donation-trigger" id="donation-trigger" type="button">
        ☕ ${this.messages.donationButtonLabel}
      </button>
      <dialog class="donation-dialog" id="donation-dialog">
        <div class="donation-dialog__header">
          <h2 class="donation-dialog__title">${this.messages.donationModalTitle}</h2>
          <button class="donation-dialog__close" id="donation-close" type="button" aria-label="${this.messages.donationCloseButton}">✕</button>
        </div>
        <p class="donation-dialog__description">${this.messages.donationModalDescription}</p>
        <div class="donation-tabs" role="tablist">${tabsMarkup}</div>
        <div class="donation-panels">${panelsMarkup}</div>
      </dialog>
    `;
  }

  bindEvents() {
    const trigger = this.querySelector("#donation-trigger");
    const dialog = this.querySelector("#donation-dialog");
    const closeButton = this.querySelector("#donation-close");

    trigger?.addEventListener("click", async () => {
      // Atualiza os textos para o idioma atual antes de abrir — ver o comentário em
      // loadAndRender(). Isto substitui this.innerHTML, então a referência local
      // `dialog` (capturada no bindEvents anterior) fica obsoleta; buscamos a nova
      // dentro de openDialog().
      await this.loadAndRender();
      this.openDialog();
    });

    closeButton?.addEventListener("click", () => {
      dialog?.close();
    });

    // Fecha ao clicar no backdrop (o próprio <dialog> cobre a área fora do conteúdo).
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    // Campos readonly: um clique já seleciona tudo, pra quem preferir copiar manualmente
    // (Ctrl+C) em vez do botão "Copiar".
    this.querySelectorAll("[data-value-input]").forEach((input) => {
      input.addEventListener("click", () => {
        input.select();
      });
    });

    this.querySelectorAll(".donation-tabs__tab").forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        const methodId = tabButton.getAttribute("data-method-id");
        this.activeMethodId = methodId;
        this.querySelectorAll(".donation-tabs__tab").forEach((otherTab) => {
          otherTab.setAttribute("aria-selected", String(otherTab === tabButton));
        });
        this.querySelectorAll("[data-method-panel]").forEach((panel) => {
          panel.hidden = panel.getAttribute("data-method-panel") !== methodId;
        });
      });
    });

    this.querySelectorAll("[data-copy-method]").forEach((copyButton) => {
      copyButton.addEventListener("click", async () => {
        const methodId = copyButton.getAttribute("data-copy-method");
        const method = DONATION_METHODS.find((candidate) => candidate.id === methodId);
        const feedback = this.querySelector(`[data-copy-feedback="${methodId}"]`);
        if (!method || !feedback) {
          return;
        }
        try {
          await navigator.clipboard.writeText(method.copyText);
          feedback.textContent = this.messages.donationCopiedFeedback;
          feedback.dataset.state = "success";
        } catch {
          feedback.textContent = this.messages.donationCopyError;
          feedback.dataset.state = "error";
        }
        window.setTimeout(() => {
          feedback.textContent = "";
          delete feedback.dataset.state;
        }, 2000);
      });
    });
  }
}

customElements.define("donation-modal", DonationModal);
