import { COUNTRIES } from "../utils/countries.js";
import { getMessages } from "../utils/i18n.js";
import {
  getSettings,
  saveSettings,
  setAutoHighlightEnabled,
  setDefaultCountry,
  setDarkModeEnabled,
  setLanguage
} from "../utils/storage.js";

class ExtensionSettingsPage extends HTMLElement {
  async connectedCallback() {
    this.settings = await getSettings();
    this.messages = getMessages(this.settings.language);
    document.documentElement.setAttribute("lang", this.settings.language);
    this.applyTheme(this.settings.darkModeEnabled);
    this.render();
    this.bindEvents();
  }

  applyTheme(isDark) {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }

  render() {
    this.innerHTML = `
      <main class="panel options-shell">
        <section class="card">
          <div class="card__content">
            <div class="eyebrow">${this.messages.extensionName}</div>
            <h1 class="title">${this.messages.optionsTitle}</h1>
            <p class="description">${this.messages.optionsDescription}</p>

            <div class="option-row">
              <div class="option-label">${this.messages.optionAutoHighlight}</div>
              <label class="toggle option-control">
                <input id="auto-highlight" type="checkbox" ${
                  this.settings.autoHighlightEnabled ? "checked" : ""
                } />
              </label>
            </div>

            <div class="option-row">
              <div class="option-label">${this.messages.optionDarkMode}</div>
              <label class="toggle option-control">
                <input id="dark-mode" type="checkbox" ${this.settings.darkModeEnabled ? "checked" : ""} />
              </label>
            </div>

            <div class="option-row">
              <div class="option-label">${this.messages.optionLanguage}</div>
              <div class="option-control">
                <select id="language">
                  <option value="en-US" ${
                    this.settings.language === "en-US" ? "selected" : ""
                  }>${this.messages.optionLanguageEnglish}</option>
                  <option value="pt-BR" ${
                    this.settings.language === "pt-BR" ? "selected" : ""
                  }>${this.messages.optionLanguagePortuguese}</option>
                </select>
              </div>
            </div>

            <div class="option-row">
              <div class="option-label">${this.messages.optionDefaultCountry}</div>
              <div class="option-control">
                <select id="default-country">
                  <option value="" ${!this.settings.defaultCountry ? "selected" : ""}>${this.messages.optionDefaultCountryNone}</option>
                  ${COUNTRIES.map((country) => `
                    <option value="${country.code}" ${this.settings.defaultCountry === country.code ? "selected" : ""}>${country.flag} ${country.name} (+${country.dialCode})</option>
                  `).join("")}
                </select>
              </div>
            </div>

            <div class="status-text" id="saved-status"></div>
          </div>
        </section>
      </main>
    `;
  }

  bindEvents() {
    const autoHighlightInput = this.querySelector("#auto-highlight");
    const darkModeInput = this.querySelector("#dark-mode");
    const languageInput = this.querySelector("#language");
    const defaultCountryInput = this.querySelector("#default-country");

    autoHighlightInput?.addEventListener("change", async () => {
      await setAutoHighlightEnabled(Boolean(autoHighlightInput.checked));
      this.showSavedState();
    });

    darkModeInput?.addEventListener("change", async () => {
      const isDark = Boolean(darkModeInput.checked);
      await setDarkModeEnabled(isDark);
      this.applyTheme(isDark);
      this.showSavedState();
    });

    languageInput?.addEventListener("change", async () => {
      await setLanguage(languageInput.value);
      const mergedSettings = {
        ...this.settings,
        autoHighlightEnabled: Boolean(autoHighlightInput?.checked),
        darkModeEnabled: Boolean(darkModeInput?.checked),
        language: languageInput.value,
        defaultCountry: defaultCountryInput?.value ?? ""
      };
      await saveSettings(mergedSettings);
      this.settings = mergedSettings;
      this.messages = getMessages(this.settings.language);
      document.documentElement.setAttribute("lang", this.settings.language);
      this.render();
      this.bindEvents();
      this.showSavedState();
    });

    defaultCountryInput?.addEventListener("change", async () => {
      await setDefaultCountry(defaultCountryInput.value);
      this.showSavedState();
    });
  }

  showSavedState() {
    const status = this.querySelector("#saved-status");
    if (!status) {
      return;
    }
    status.textContent = this.messages.optionsSaved;
    window.setTimeout(() => {
      status.textContent = "";
    }, 1200);
  }
}

customElements.define("extension-settings-page", ExtensionSettingsPage);
