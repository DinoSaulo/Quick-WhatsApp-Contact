import { TUTORIAL_STEPS } from "../utils/tutorial.js";
import { getMessages, t } from "../utils/i18n.js";
import { getSettings, setLanguage } from "../utils/storage.js";

class TutorialPage extends HTMLElement {
  async connectedCallback() {
    this.settings = await getSettings();
    this.messages = getMessages(this.settings.language);
    document.documentElement.setAttribute("lang", this.settings.language);
    document.documentElement.dataset.theme = this.settings.darkModeEnabled ? "dark" : "light";

    this.stepIndex = 0;
    this.render();
    this.bindEvents();
  }

  goToStep(index) {
    const clampedIndex = Math.min(Math.max(index, 0), TUTORIAL_STEPS.length - 1);
    if (clampedIndex === this.stepIndex) {
      return;
    }
    this.stepIndex = clampedIndex;
    this.render();
    this.bindEvents();
  }

  render() {
    const step = TUTORIAL_STEPS[this.stepIndex];
    const isFirstStep = this.stepIndex === 0;
    const isLastStep = this.stepIndex === TUTORIAL_STEPS.length - 1;

    const imageMarkup = step.image ? `
      <img
        class="tutorial-step__image"
        src="${chrome.runtime.getURL(step.image)}"
        alt="${step.imageAltKey ? this.messages[step.imageAltKey] : ""}"
      />
    ` : "";

    const languagePickerMarkup = isFirstStep ? `
      <div class="tutorial-language">
        <label class="tutorial-language__label" for="tutorial-language">${this.messages.optionLanguage}</label>
        <select class="tutorial-language__select" id="tutorial-language">
          <option value="en-US" ${this.settings.language === "en-US" ? "selected" : ""}>${this.messages.optionLanguageEnglish}</option>
          <option value="pt-BR" ${this.settings.language === "pt-BR" ? "selected" : ""}>${this.messages.optionLanguagePortuguese}</option>
        </select>
      </div>
    ` : "";

    const dotsMarkup = TUTORIAL_STEPS.map((_, index) => `
      <button
        class="tutorial-dots__dot"
        type="button"
        aria-label="${t(this.messages, "tutorialStepIndicator", { current: index + 1, total: TUTORIAL_STEPS.length })}"
        aria-current="${index === this.stepIndex}"
        data-step-index="${index}"
      ></button>
    `).join("");

    // Every interpolated value below is developer-controlled (static i18n DICTIONARY, static TUTORIAL_STEPS) — never user input or synced storage.
    // eslint-disable-next-line no-unsanitized/property
    this.innerHTML = `
      <main class="panel tutorial-shell">
        <section class="card tutorial-card">
          <div class="card__content">
            <div class="eyebrow">${this.messages.extensionName}</div>
            ${languagePickerMarkup}
            <h1 class="title">${this.messages[step.titleKey]}</h1>
            <p class="description">${this.messages[step.descriptionKey]}</p>
            ${imageMarkup}
            <div class="tutorial-dots">${dotsMarkup}</div>
            <div class="actions tutorial-actions">
              ${isFirstStep ? "" : `
                <button class="button button--secondary" type="button" id="tutorial-back">
                  ${this.messages.tutorialBackButton}
                </button>
              `}
              ${isLastStep ? `
                <button class="button button--primary" type="button" id="tutorial-finish">
                  ${this.messages.tutorialFinishButton}
                </button>
              ` : `
                <button class="button button--primary" type="button" id="tutorial-next">
                  ${this.messages.tutorialNextButton}
                </button>
              `}
            </div>
            ${isLastStep ? "" : `
              <button class="tutorial-skip" type="button" id="tutorial-skip">
                ${this.messages.tutorialSkipButton}
              </button>
            `}
          </div>
        </section>
      </main>
    `;
  }

  bindEvents() {
    this.querySelector("#tutorial-language")?.addEventListener("change", async (event) => {
      const language = event.target.value;
      await setLanguage(language);
      this.settings.language = language;
      this.messages = getMessages(language);
      document.documentElement.setAttribute("lang", language);
      this.render();
      this.bindEvents();
    });

    this.querySelector("#tutorial-back")?.addEventListener("click", () => {
      this.goToStep(this.stepIndex - 1);
    });

    this.querySelector("#tutorial-next")?.addEventListener("click", () => {
      this.goToStep(this.stepIndex + 1);
    });

    this.querySelector("#tutorial-skip")?.addEventListener("click", () => {
      window.close();
    });

    this.querySelector("#tutorial-finish")?.addEventListener("click", () => {
      window.close();
    });

    this.querySelectorAll("[data-step-index]").forEach((dot) => {
      dot.addEventListener("click", () => {
        this.goToStep(Number(dot.getAttribute("data-step-index")));
      });
    });
  }
}

customElements.define("tutorial-page", TutorialPage);
