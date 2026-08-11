import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  getCountryByCode,
  getDefaultCountryCodeForLanguage,
  renderCountryFlagHtml
} from "../utils/countries.js";
import { getMessages, t } from "../utils/i18n.js";
import { detectCountryCodeFromBrowserLocation } from "../utils/location.js";
import {
  applyPhoneMask,
  buildWhatsAppUrl,
  getExpectedFormatsForDdi,
  getPhoneMaskPlaceholder,
  hasCountryCode,
  isLocalNumberValidForDdi,
  isLikelyPhoneText,
  isValidPhoneForSend,
  joinCountryCodeAndNumber,
  normalizeSelectedNumber
} from "../utils/phone.js";
import { consumePendingContextCountry, consumePendingContextNumber, getLastCountry, getSettings, saveLastCountry } from "../utils/storage.js";

class WhatsAppMessagePopup extends HTMLElement {
  async connectedCallback() {
    const settings = await getSettings();
    this.language = settings.language;
    this.messages = getMessages(this.language);
    document.documentElement.setAttribute("lang", this.language);
    document.documentElement.dataset.theme = settings.darkModeEnabled ? "dark" : "light";

    this.pendingContextNumber = normalizeSelectedNumber(await consumePendingContextNumber());
    this.requiresCountrySelection = Boolean(this.pendingContextNumber);
    const contextCountry = await consumePendingContextCountry();
    const storedCountry = await getLastCountry();
    const defaultCountry = settings.defaultCountry;
    const languageDefaultCountry = getDefaultCountryCodeForLanguage(this.language);
    const detectedCountry = detectCountryCodeFromBrowserLocation({
      languages: navigator.languages,
      language: navigator.language
    });
    this.selectedCountryCode = this.requiresCountrySelection
      ? contextCountry || defaultCountry || storedCountry || languageDefaultCountry || detectedCountry || DEFAULT_COUNTRY_CODE
      : defaultCountry || storedCountry || languageDefaultCountry || detectedCountry || DEFAULT_COUNTRY_CODE;

    this.render();
    this.bindEvents();
  }

  render() {
    const initialNumber = this.pendingContextNumber || "";
    const description = this.requiresCountrySelection
      ? this.messages.popupDescriptionNeedsCountry
      : this.messages.popupDescriptionDefault;

    this.innerHTML = `
      <main class="panel">
        <section class="card">
          <div class="card__content">
            <div class="eyebrow">${this.messages.popupEyebrow}</div>
            <div class="title-row">
              <h1 class="title">${this.messages.popupTitle}</h1>
              <button class="button button--secondary button--small icon-only" type="button" id="open-settings" title="${this.messages.actionOpenSettings}" aria-label="${this.messages.actionOpenSettings}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
            <p class="description">${description}</p>
            <form id="message-form">
              <div class="field">
                <label for="country-hidden">${this.messages.labelCountry}</label>
                ${this.buildCountryPickerMarkup(this.selectedCountryCode)}
              </div>
              <div class="field">
                <label for="phone">${this.messages.labelPhone}</label>
                <input id="phone" name="phone" type="text" value="${initialNumber}" placeholder="+5511999999999" required />
              </div>
              <div class="field">
                <label for="message">${this.messages.labelMessage}</label>
                <textarea id="message" name="message" placeholder="${this.messages.labelMessage}"></textarea>
              </div>
              <div class="actions">
                <button class="button button--primary" type="submit">${this.messages.buttonSend}</button>
              </div>
            </form>
          </div>
          <div class="preview">${this.messages.previewTab}</div>
        </section>
      </main>
    `;
  }

  buildCountryPickerMarkup(selectedCode) {
    const selectedCountry = getCountryByCode(selectedCode);
    const items = COUNTRIES.map((country) => {
      const searchKey = `${country.name.toLowerCase()} ${country.code.toLowerCase()} ${country.dialCode} +${country.dialCode} ${country.flag}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return `
        <button class="country-picker__option" type="button" data-country-code="${country.code}" data-search="${searchKey}">
          <span class="country-picker__flag">${renderCountryFlagHtml(country)}</span>
          <span class="country-picker__name">${country.name}</span>
          <span class="country-picker__ddi">+${country.dialCode}</span>
        </button>
      `;
    }).join("");

    return `
      <div class="country-picker" id="country-picker">
        <input id="country-hidden" name="country" type="hidden" value="${selectedCountry.code}" />
        <button class="country-picker__trigger" id="country-trigger" type="button" aria-expanded="false">
          <span class="country-picker__flag">${renderCountryFlagHtml(selectedCountry)}</span>
          <span class="country-picker__name">${selectedCountry.name}</span>
          <span class="country-picker__ddi">+${selectedCountry.dialCode}</span>
        </button>
        <div class="country-picker__menu" id="country-menu" hidden>
          <div class="country-picker__search">
            <input id="country-search" class="country-picker__search-input" type="text" placeholder="${this.messages.searchCountryPlaceholder}" autocomplete="off" />
          </div>
          <div class="country-picker__options" id="country-options">
            ${items}
          </div>
          <div class="country-picker__no-results" id="country-no-results" hidden>${this.messages.searchCountryNoResults}</div>
        </div>
      </div>
    `;
  }

  getSelectedCountry() {
    const countryHidden = this.querySelector("#country-hidden");
    return getCountryByCode(countryHidden?.value ?? DEFAULT_COUNTRY_CODE);
  }

  applyMaskToPhoneInput(input, mask) {
    if (!input || input.value.startsWith("+")) return;
    const start = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, start).replace(/\D/g, "").length;
    input.value = applyPhoneMask(input.value, mask);
    let newCursor = 0;
    let counted = 0;
    for (let i = 0; i < input.value.length; i++) {
      if (/\d/.test(input.value[i])) {
        counted++;
        if (counted === digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }
    }
    if (counted < digitsBeforeCursor) newCursor = input.value.length;
    input.setSelectionRange(newCursor, newCursor);
  }

  updatePhonePlaceholder(input, country) {
    if (!input) return;
    const isInternational = input.value.startsWith("+");
    input.placeholder = isInternational ? `+${country.dialCode}...` : getPhoneMaskPlaceholder(country.phoneMask);
  }

  bindCountryPickerEvents() {
    const picker = this.querySelector("#country-picker");
    const trigger = this.querySelector("#country-trigger");
    const menu = this.querySelector("#country-menu");
    const hiddenInput = this.querySelector("#country-hidden");
    const phoneInput = this.querySelector("#phone");
    const searchInput = this.querySelector("#country-search");
    const noResults = this.querySelector("#country-no-results");
    const optionButtons = this.querySelectorAll(".country-picker__option");

    const filterCountries = (queryText) => {
      const query = String(queryText || "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      let visibleCount = 0;
      optionButtons.forEach((button) => {
        const searchData = button.getAttribute("data-search") || "";
        const matches = !query || searchData.includes(query);
        button.hidden = !matches;
        if (matches) {
          visibleCount++;
        }
      });
      if (noResults) {
        noResults.hidden = visibleCount > 0;
      }
    };

    const resetSearch = () => {
      if (searchInput) {
        searchInput.value = "";
      }
      filterCountries("");
    };

    const closeMenu = () => {
      if (!menu || !trigger) {
        return;
      }
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      resetSearch();
    };

    trigger?.addEventListener("click", () => {
      if (!menu) {
        return;
      }
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        resetSearch();
        searchInput?.focus();
      }
    });

    searchInput?.addEventListener("input", (event) => {
      filterCountries(event.target.value);
    });

    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        trigger?.focus();
      }
    });

    optionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const code = button.getAttribute("data-country-code") ?? DEFAULT_COUNTRY_CODE;
        const selectedCountry = getCountryByCode(code);
        if (hiddenInput) {
          hiddenInput.value = selectedCountry.code;
        }
        if (trigger) {
          trigger.innerHTML = `
            <span class="country-picker__flag">${renderCountryFlagHtml(selectedCountry)}</span>
            <span class="country-picker__name">${selectedCountry.name}</span>
            <span class="country-picker__ddi">+${selectedCountry.dialCode}</span>
          `;
        }
        this.applyMaskToPhoneInput(phoneInput, selectedCountry.phoneMask);
        this.updatePhonePlaceholder(phoneInput, selectedCountry);
        closeMenu();
      });
    });

    if (phoneInput) {
      const initialCountry = getCountryByCode(this.selectedCountryCode);
      this.updatePhonePlaceholder(phoneInput, initialCountry);
      if (phoneInput.value && !phoneInput.value.startsWith("+")) {
        phoneInput.value = applyPhoneMask(phoneInput.value, initialCountry.phoneMask);
      }

      phoneInput.addEventListener("input", () => {
        const country = this.getSelectedCountry();
        this.applyMaskToPhoneInput(phoneInput, country.phoneMask);
        this.updatePhonePlaceholder(phoneInput, country);
      });
    }

    document.addEventListener("click", (event) => {
      if (!picker || !menu || menu.hidden) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !picker.contains(target)) {
        closeMenu();
      }
    });
  }

  bindEvents() {
    this.bindCountryPickerEvents();

    const openSettingsButton = this.querySelector("#open-settings");
    openSettingsButton?.addEventListener("click", async () => {
      await chrome.runtime.openOptionsPage();
      window.close();
    });

    const form = this.querySelector("#message-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const phoneInput = this.querySelector("#phone");
      const messageInput = this.querySelector("#message");

      const rawPhone = phoneInput?.value ?? "";
      let phone = normalizeSelectedNumber(rawPhone);
      const message = messageInput?.value ?? "";
      phoneInput?.setCustomValidity("");

      if (!isLikelyPhoneText(rawPhone)) {
        phoneInput?.setCustomValidity(this.messages.validationInvalidPhone);
        phoneInput?.reportValidity();
        phoneInput?.focus();
        return;
      }

      if (!hasCountryCode(phone)) {
        const selectedCountry = this.getSelectedCountry();
        const expectedFormats = getExpectedFormatsForDdi(selectedCountry.dialCode);
        const localNumberIsValid = isLocalNumberValidForDdi(phone, selectedCountry.dialCode);
        if (!localNumberIsValid) {
          const formatsLabel = expectedFormats.join(" / ");
          phoneInput?.setCustomValidity(
            t(this.messages, "validationInvalidFormat", {
              ddi: selectedCountry.dialCode,
              formats: formatsLabel
            })
          );
          phoneInput?.reportValidity();
          phoneInput?.focus();
          return;
        }

        phone = joinCountryCodeAndNumber(selectedCountry.dialCode, phone);
        await saveLastCountry(selectedCountry.code);
      }

      if (!isValidPhoneForSend(phone)) {
        phoneInput?.focus();
        return;
      }

      const whatsappUrl = buildWhatsAppUrl(phone, message);
      if (!whatsappUrl) {
        phoneInput?.focus();
        return;
      }

      await chrome.tabs.create({
        url: whatsappUrl,
        active: true
      });

      window.close();
    });
  }
}

customElements.define("whatsapp-message-popup", WhatsAppMessagePopup);
