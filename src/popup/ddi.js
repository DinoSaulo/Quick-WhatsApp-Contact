import {
  DEFAULT_COUNTRY_CODE,
  getCountryByCode,
  getDefaultCountryCodeForLanguage,
  getLocalizedCountries,
  getLocalizedCountryName,
  renderCountryFlagHtml
} from "../utils/countries.js";
import { getMessages, t } from "../utils/i18n.js";
import { detectCountryCodeFromBrowserLocation } from "../utils/location.js";
import {
  applyPhoneMask,
  buildWhatsAppUrl,
  getExpectedFormatsForDdi,
  getPhoneMaskPlaceholder,
  isLocalNumberValidForDdi,
  isValidPhoneForSend,
  joinCountryCodeAndNumber,
  normalizeSelectedNumber
} from "../utils/phone.js";
import { getLastCountry, getSettings, saveLastCountry } from "../utils/storage.js";

class CountryDdiScreen extends HTMLElement {
  async connectedCallback() {
    const settings = await getSettings();
    this.language = settings.language;
    this.messages = getMessages(this.language);
    document.documentElement.setAttribute("lang", this.language);
    document.documentElement.dataset.theme = settings.darkModeEnabled ? "dark" : "light";

    this.initialNumber = this.getNumberFromQuery();
    this.selectedCountryCode = await this.resolveInitialCountry();
    this.render();
    this.bindEvents();
    this.updatePreview();
  }

  getNumberFromQuery() {
    const url = new URL(window.location.href);
    return normalizeSelectedNumber(url.searchParams.get("number") ?? "");
  }

  async resolveInitialCountry() {
    const storedCountryCode = await getLastCountry();
    const settings = await getSettings();
    const defaultCountry = settings.defaultCountry;
    const languageDefaultCountry = getDefaultCountryCodeForLanguage(this.language);
    const detectedCountryCode = detectCountryCodeFromBrowserLocation({
      languages: navigator.languages,
      language: navigator.language
    });
    return defaultCountry || storedCountryCode || languageDefaultCountry || detectedCountryCode || DEFAULT_COUNTRY_CODE;
  }

  render() {
    // initialNumber runs through normalizeSelectedNumber() first; buildCountryPickerMarkup() derives attributes only from the resolved country object.
    // eslint-disable-next-line no-unsanitized/property
    this.innerHTML = `
      <main class="panel">
        <section class="card">
          <div class="card__content">
            <div class="eyebrow">${this.messages.ddiEyebrow}</div>
            <h1 class="title">${this.messages.ddiTitle}</h1>
            <p class="description">${this.messages.ddiDescription}</p>
            <form id="ddi-form">
              <div class="field">
                <label for="country-hidden">${this.messages.labelCountry}</label>
                ${this.buildCountryPickerMarkup(this.selectedCountryCode)}
              </div>
              <div class="field">
                <label for="local-number">${this.messages.labelPhone}</label>
                <input id="local-number" name="local-number" type="text" value="${this.initialNumber}" required />
              </div>
              <div class="actions">
                <button class="button button--primary" type="submit">${this.messages.buttonSend}</button>
                <button class="button button--secondary" type="button" id="cancel">${this.messages.buttonCancel}</button>
              </div>
            </form>
          </div>
          <div class="preview" id="preview"></div>
        </section>
      </main>
    `;
  }

  buildCountryPickerMarkup(selectedCode) {
    const selectedCountry = getCountryByCode(selectedCode);
    const items = getLocalizedCountries(this.language).map((country) => {
      const searchKey = `${country.name.toLowerCase()} ${country.defaultName.toLowerCase()} ${country.code.toLowerCase()} ${country.dialCode} +${country.dialCode} ${country.flag}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
          <span class="country-picker__name">${getLocalizedCountryName(selectedCountry, this.language)}</span>
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
    const hiddenInput = this.querySelector("#country-hidden");
    return getCountryByCode(hiddenInput?.value ?? DEFAULT_COUNTRY_CODE);
  }

  applyMaskToInput(input, mask) {
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, start).replace(/\D/g, "").length;
    input.value = applyPhoneMask(input.value, mask);
    input.placeholder = getPhoneMaskPlaceholder(mask);
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

  bindCountryPickerEvents() {
    const picker = this.querySelector("#country-picker");
    const trigger = this.querySelector("#country-trigger");
    const menu = this.querySelector("#country-menu");
    const hiddenInput = this.querySelector("#country-hidden");
    const numberInput = this.querySelector("#local-number");
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
          // selectedCountry comes from getCountryByCode(code) on a data-country-code attribute this render pass generated from static COUNTRIES — never raw user input.
          // eslint-disable-next-line no-unsanitized/property
          trigger.innerHTML = `
            <span class="country-picker__flag">${renderCountryFlagHtml(selectedCountry)}</span>
            <span class="country-picker__name">${getLocalizedCountryName(selectedCountry, this.language)}</span>
            <span class="country-picker__ddi">+${selectedCountry.dialCode}</span>
          `;
        }
        this.applyMaskToInput(numberInput, selectedCountry.phoneMask);
        closeMenu();
        this.updatePreview();
      });
    });

    if (numberInput) {
      const initialCountry = getCountryByCode(this.selectedCountryCode);
      numberInput.placeholder = getPhoneMaskPlaceholder(initialCountry.phoneMask);
      numberInput.value = applyPhoneMask(numberInput.value, initialCountry.phoneMask);

      numberInput.addEventListener("input", () => {
        const country = this.getSelectedCountry();
        this.applyMaskToInput(numberInput, country.phoneMask);
        this.updatePreview();
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

    const numberInput = this.querySelector("#local-number");
    const form = this.querySelector("#ddi-form");
    const cancelButton = this.querySelector("#cancel");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const country = this.getSelectedCountry();
      const localNumber = numberInput?.value ?? "";
      numberInput?.setCustomValidity("");

      if (!isLocalNumberValidForDdi(localNumber, country.dialCode)) {
        const formats = getExpectedFormatsForDdi(country.dialCode).join(" / ");
        numberInput?.setCustomValidity(
          t(this.messages, "validationInvalidFormat", {
            ddi: country.dialCode,
            formats
          })
        );
        numberInput?.reportValidity();
        numberInput?.focus();
        return;
      }

      const phone = joinCountryCodeAndNumber(country.dialCode, localNumber);
      if (!isValidPhoneForSend(phone)) {
        numberInput?.focus();
        return;
      }

      const whatsappUrl = buildWhatsAppUrl(phone);
      if (!whatsappUrl) {
        numberInput?.focus();
        return;
      }

      await saveLastCountry(country.code);
      await chrome.tabs.create({ url: whatsappUrl, active: true });
      window.close();
    });

    cancelButton?.addEventListener("click", () => window.close());
  }

  updatePreview() {
    const numberInput = this.querySelector("#local-number");
    const preview = this.querySelector("#preview");
    const country = this.getSelectedCountry();
    const fullNumber = joinCountryCodeAndNumber(country.dialCode, numberInput?.value ?? "");

    if (preview) {
      preview.textContent = isValidPhoneForSend(fullNumber)
        ? t(this.messages, "previewFinalNumber", { number: fullNumber })
        : this.messages.previewInvalidNumber;
    }
  }
}

customElements.define("country-ddi-screen", CountryDdiScreen);
