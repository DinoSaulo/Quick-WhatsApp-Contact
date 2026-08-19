import {
  getCountryByCode,
  getCountryByIso2,
  getLocalizedCountries,
  getLocalizedCountryName,
  renderCountryFlagHtml,
  renderEmojiHtml
} from "../utils/countries.js";
import { getMessages } from "../utils/i18n.js";
import {
  getSettings,
  saveSettings,
  setAutoHighlightEnabled,
  setDefaultCountry,
  setDarkModeEnabled,
  setLanguage
} from "../utils/storage.js";
import { ONBOARDING_PAGE_PATH } from "../utils/tutorial.js";

const PAGE_ORIGINS = ["http://*/*", "https://*/*"];

// Each language shows the flags of its two main speaking regions, packaged as Twemoji
// <img> tags — a native <option> can't render <img>, hence the custom picker below.
const LANGUAGE_OPTIONS = [
  { value: "en-US", labelKey: "optionLanguageEnglish", flagIso2Codes: ["US", "GB"] },
  { value: "pt-BR", labelKey: "optionLanguagePortuguese", flagIso2Codes: ["BR", "PT"] },
  { value: "es-ES", labelKey: "optionLanguageSpanish", flagIso2Codes: ["ES", "MX"] }
];

class ExtensionSettingsPage extends HTMLElement {
  async connectedCallback() {
    this.settings = await getSettings();
    const hasSiteAccess = await chrome.permissions.contains({ origins: PAGE_ORIGINS });
    if (this.settings.autoHighlightEnabled && !hasSiteAccess) {
      this.settings.autoHighlightEnabled = false;
      await setAutoHighlightEnabled(false);
    }
    this.messages = getMessages(this.settings.language);
    document.documentElement.setAttribute("lang", this.settings.language);
    this.applyTheme(this.settings.darkModeEnabled);
    this.render();
    this.bindEvents();
  }

  applyTheme(isDark) {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }

  buildCountryPickerMarkup(selectedCode) {
    const selectedCountry = selectedCode ? getCountryByCode(selectedCode) : null;
    const isAutomatic = !selectedCode;

    const automaticOptionMarkup = `
      <button class="country-picker__option" type="button" data-country-code="" data-search="${this.messages.optionDefaultCountryNone.toLowerCase()} automatic automatico">
        <span class="country-picker__flag">${renderEmojiHtml("🌐")}</span>
        <span class="country-picker__name">${this.messages.optionDefaultCountryNone}</span>
        <span class="country-picker__ddi"></span>
      </button>
    `;

    const items = getLocalizedCountries(this.settings.language).map((country) => {
      const searchKey = `${country.name.toLowerCase()} ${country.defaultName.toLowerCase()} ${country.code.toLowerCase()} ${country.dialCode} +${country.dialCode} ${country.flag}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return `
        <button class="country-picker__option" type="button" data-country-code="${country.code}" data-search="${searchKey}">
          <span class="country-picker__flag">${renderCountryFlagHtml(country)}</span>
          <span class="country-picker__name">${country.name}</span>
          <span class="country-picker__ddi">+${country.dialCode}</span>
        </button>
      `;
    }).join("");

    const triggerFlagMarkup = isAutomatic || !selectedCountry
      ? `<span class="country-picker__flag">${renderEmojiHtml("🌐")}</span>`
      : `<span class="country-picker__flag">${renderCountryFlagHtml(selectedCountry)}</span>`;

    const triggerNameMarkup = isAutomatic || !selectedCountry
      ? this.messages.optionDefaultCountryNone
      : getLocalizedCountryName(selectedCountry, this.settings.language);

    const triggerDdiMarkup = isAutomatic || !selectedCountry
      ? ""
      : `+${selectedCountry.dialCode}`;

    return `
      <div class="country-picker" id="country-picker">
        <input id="default-country-hidden" name="defaultCountry" type="hidden" value="${
          isAutomatic ? "" : selectedCountry.code
        }" />
        <button class="country-picker__trigger" id="country-trigger" type="button" aria-expanded="false">
          ${triggerFlagMarkup}
          <span class="country-picker__name">${triggerNameMarkup}</span>
          <span class="country-picker__ddi">${triggerDdiMarkup}</span>
        </button>
        <div class="country-picker__menu" id="country-menu" hidden>
          <div class="country-picker__search">
            <input id="country-search" class="country-picker__search-input" type="text" placeholder="${this.messages.searchCountryPlaceholder}" autocomplete="off" />
          </div>
          <div class="country-picker__options" id="country-options">
            ${automaticOptionMarkup}
            ${items}
          </div>
          <div class="country-picker__no-results" id="country-no-results" hidden>${this.messages.searchCountryNoResults}</div>
        </div>
      </div>
    `;
  }

  renderLanguageFlagsMarkup(option) {
    return option.flagIso2Codes
      .map((iso2) => renderCountryFlagHtml(getCountryByIso2(iso2)))
      .join("");
  }

  buildLanguagePickerMarkup(selectedLanguage) {
    const selectedOption =
      LANGUAGE_OPTIONS.find((option) => option.value === selectedLanguage) ?? LANGUAGE_OPTIONS[0];

    const items = LANGUAGE_OPTIONS.map((option) => `
      <button class="country-picker__option" type="button" data-language-code="${option.value}">
        <span class="country-picker__flag country-picker__flag--pair">${this.renderLanguageFlagsMarkup(option)}</span>
        <span class="country-picker__name">${this.messages[option.labelKey]}</span>
      </button>
    `).join("");

    return `
      <div class="country-picker" id="language-picker">
        <input id="language-hidden" name="language" type="hidden" value="${selectedOption.value}" />
        <button class="country-picker__trigger" id="language-trigger" type="button" aria-expanded="false">
          <span class="country-picker__flag country-picker__flag--pair">${this.renderLanguageFlagsMarkup(selectedOption)}</span>
          <span class="country-picker__name">${this.messages[selectedOption.labelKey]}</span>
        </button>
        <div class="country-picker__menu" id="language-menu" hidden>
          <div class="country-picker__options" id="language-options">
            ${items}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    // this.messages/settings are normalized; buildCountryPickerMarkup() derives attributes only from the resolved country object — see "neutralizes hostile markup..." test.
    // eslint-disable-next-line no-unsanitized/property
    this.innerHTML = `
      <main class="panel options-shell">
        <section class="card">
          <div class="card__content">
            <div class="eyebrow">${this.messages.extensionName}</div>
            <h1 class="title">${this.messages.optionsTitle}</h1>
            <p class="description">${this.messages.optionsDescription}</p>

            <div class="option-row">
              <label class="option-label" for="auto-highlight">${this.messages.optionAutoHighlight}</label>
              <label class="toggle option-control">
                <input id="auto-highlight" type="checkbox" ${
                  this.settings.autoHighlightEnabled ? "checked" : ""
                } aria-describedby="page-access-disclosure" />
                <span class="toggle__track"><span class="toggle__thumb"></span></span>
              </label>
            </div>
            <p class="privacy-note" id="page-access-disclosure">${this.messages.optionAutoHighlightDisclosure}</p>

            <div class="option-row">
              <label class="option-label" for="country-trigger">${this.messages.optionDefaultCountry}</label>
              <div class="option-control">
                ${this.buildCountryPickerMarkup(this.settings.defaultCountry)}
              </div>
            </div>

            <div class="option-row">
              <label class="option-label" for="language-trigger">${this.messages.optionLanguage}</label>
              <div class="option-control">
                ${this.buildLanguagePickerMarkup(this.settings.language)}
              </div>
            </div>

            <div class="option-row">
              <label class="option-label" for="dark-mode">${this.messages.optionDarkMode}</label>
              <label class="toggle option-control">
                <input id="dark-mode" type="checkbox" ${this.settings.darkModeEnabled ? "checked" : ""} />
                <span class="toggle__track"><span class="toggle__thumb"></span></span>
              </label>
            </div>

            <div class="option-row">
              <label class="option-label" for="tutorial-button">${this.messages.optionTutorial}</label>
              <div class="option-control">
                <button class="donation-trigger" id="tutorial-button" type="button">${this.messages.optionTutorialButton}</button>
              </div>
            </div>

            <div class="status-text" id="saved-status"></div>
          </div>
        </section>
      </main>
    `;
  }

  bindCountryPickerEvents() {
    const picker = this.querySelector("#country-picker");
    const trigger = this.querySelector("#country-trigger");
    const menu = this.querySelector("#country-menu");
    const hiddenInput = this.querySelector("#default-country-hidden");
    const searchInput = this.querySelector("#country-search");
    const noResults = this.querySelector("#country-no-results");
    // Scoped to #country-options: the language picker reuses the same .country-picker__option
    // class, and an unscoped query here would also wire up its buttons as country options.
    const optionButtons = this.querySelectorAll("#country-options .country-picker__option");

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
        button.style.display = matches ? "" : "none";
        button.setAttribute("aria-hidden", String(!matches));
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
      button.addEventListener("click", async () => {
        const code = button.getAttribute("data-country-code") ?? "";
        if (hiddenInput) {
          hiddenInput.value = code;
        }
        const isAutomatic = !code;
        const selectedCountry = isAutomatic ? null : getCountryByCode(code);
        if (trigger) {
          const flagMarkup = isAutomatic || !selectedCountry
            ? `<span class="country-picker__flag">${renderEmojiHtml("🌐")}</span>`
            : `<span class="country-picker__flag">${renderCountryFlagHtml(selectedCountry)}</span>`;
          const nameMarkup = isAutomatic || !selectedCountry
            ? this.messages.optionDefaultCountryNone
            : getLocalizedCountryName(selectedCountry, this.settings.language);
          const ddiMarkup = isAutomatic || !selectedCountry
            ? ""
            : `+${selectedCountry.dialCode}`;

          // code round-trips through getCountryByCode() back to a known static COUNTRIES entry — never raw user or storage input.
          // eslint-disable-next-line no-unsanitized/property
          trigger.innerHTML = `
            ${flagMarkup}
            <span class="country-picker__name">${nameMarkup}</span>
            <span class="country-picker__ddi">${ddiMarkup}</span>
          `;
        }
        closeMenu();
        await setDefaultCountry(code);
        this.settings.defaultCountry = code;
        this.showSavedState();
      });
    });

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

  bindLanguagePickerEvents() {
    const picker = this.querySelector("#language-picker");
    const trigger = this.querySelector("#language-trigger");
    const menu = this.querySelector("#language-menu");
    const optionButtons = this.querySelectorAll("#language-options .country-picker__option");

    const closeMenu = () => {
      if (!menu || !trigger) {
        return;
      }
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger?.addEventListener("click", () => {
      if (!menu) {
        return;
      }
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    optionButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const languageCode = button.getAttribute("data-language-code") ?? LANGUAGE_OPTIONS[0].value;
        closeMenu();
        await this.applyLanguageChange(languageCode);
      });
    });

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

  // Shared by the language picker's option click; re-renders so every control (including the
  // picker itself) reflects the newly selected language's translated labels.
  async applyLanguageChange(languageCode) {
    await setLanguage(languageCode);
    const autoHighlightInput = this.querySelector("#auto-highlight");
    const darkModeInput = this.querySelector("#dark-mode");
    const hiddenCountryInput = this.querySelector("#default-country-hidden");
    const mergedSettings = {
      ...this.settings,
      autoHighlightEnabled: Boolean(autoHighlightInput?.checked),
      darkModeEnabled: Boolean(darkModeInput?.checked),
      language: languageCode,
      defaultCountry: hiddenCountryInput?.value ?? ""
    };
    await saveSettings(mergedSettings);
    this.settings = mergedSettings;
    this.messages = getMessages(this.settings.language);
    document.documentElement.setAttribute("lang", this.settings.language);
    this.render();
    this.bindEvents();
    this.showSavedState();
  }

  bindEvents() {
    this.bindCountryPickerEvents();
    this.bindLanguagePickerEvents();

    const autoHighlightInput = this.querySelector("#auto-highlight");
    const darkModeInput = this.querySelector("#dark-mode");
    const tutorialButton = this.querySelector("#tutorial-button");

    tutorialButton?.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_PAGE_PATH) });
    });

    autoHighlightInput?.addEventListener("change", async () => {
      const wantsPageHelpers = Boolean(autoHighlightInput.checked);
      try {
        if (wantsPageHelpers) {
          const granted = await chrome.permissions.request({ origins: PAGE_ORIGINS });
          if (!granted) {
            autoHighlightInput.checked = false;
            await setAutoHighlightEnabled(false);
            this.showStatus(this.messages.permissionDenied, true);
            return;
          }
        } else {
          await chrome.permissions.remove({ origins: PAGE_ORIGINS });
        }

        await setAutoHighlightEnabled(wantsPageHelpers);
        this.settings.autoHighlightEnabled = wantsPageHelpers;
        this.showSavedState();
      } catch {
        autoHighlightInput.checked = !wantsPageHelpers;
        this.showStatus(this.messages.permissionError, true);
      }
    });

    darkModeInput?.addEventListener("change", async () => {
      const isDark = Boolean(darkModeInput.checked);
      await setDarkModeEnabled(isDark);
      this.applyTheme(isDark);
      this.showSavedState();
    });
  }

  showSavedState() {
    this.showStatus(this.messages.optionsSaved);
  }

  showStatus(message, isError = false) {
    const status = this.querySelector("#saved-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.state = isError ? "error" : "success";
    window.setTimeout(() => {
      status.textContent = "";
      delete status.dataset.state;
    }, 1200);
  }
}

customElements.define("extension-settings-page", ExtensionSettingsPage);
