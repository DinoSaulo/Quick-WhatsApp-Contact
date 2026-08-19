(function () {
  const BUTTON_ID = "quick-whatsapp-contact-selection-button";
  const PROCESS_SELECTION_MESSAGE = "quick-whatsapp-contact.process-selection";
  const LANGUAGE_KEY = "quick-whatsapp-contact.language";

  const TEXTS = {
    "en-US": { actionWhatsapp: "Open in WhatsApp" },
    "pt-BR": { actionWhatsapp: "Abrir no WhatsApp" },
    "es-ES": { actionWhatsapp: "Abrir en WhatsApp" }
  };

  let selectedText = "";
  let buttonElement = null;
  let language = "en-US";

  initialize();

  async function initialize() {
    const result = await chrome.storage.sync.get(LANGUAGE_KEY);
    language = normalizeLanguage(result[LANGUAGE_KEY]);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[LANGUAGE_KEY]) {
        return;
      }
      language = normalizeLanguage(changes[LANGUAGE_KEY].newValue);
      updateButtonText();
    });

    bindSelectionListeners();
  }

  function normalizeLanguage(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "pt-br") return "pt-BR";
    if (normalized === "es-es") return "es-ES";
    return "en-US";
  }

  function getText(key) {
    return (TEXTS[language] || TEXTS["en-US"])[key];
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.style.position = "fixed";
    button.style.zIndex = "2147483647";
    button.style.width = "32px";
    button.style.height = "32px";
    button.style.border = "1px solid rgba(0,0,0,0.18)";
    button.style.borderRadius = "8px";
    button.style.background = "#ffffff";
    button.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.2)";
    button.style.cursor = "pointer";
    button.style.padding = "0";
    button.style.display = "none";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.transition = "transform 120ms ease";

    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("icons/icon16.png");
    icon.alt = "WhatsApp";
    icon.width = 16;
    icon.height = 16;
    icon.style.pointerEvents = "none";

    button.appendChild(icon);
    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-1px)";
    });
    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0)";
    });
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!selectedText) {
        hideButton();
        return;
      }

      try {
        await chrome.runtime.sendMessage({
          type: PROCESS_SELECTION_MESSAGE,
          selectionText: selectedText
        });
      } finally {
        hideButton();
      }
    });

    document.documentElement.appendChild(button);
    return button;
  }

  function updateButtonText() {
    if (!buttonElement) {
      return;
    }
    const label = getText("actionWhatsapp");
    buttonElement.title = label;
    buttonElement.setAttribute("aria-label", label);
  }

  function getButton() {
    if (!buttonElement) {
      buttonElement = createButton();
      updateButtonText();
    }
    return buttonElement;
  }

  function hideButton() {
    const button = getButton();
    button.style.display = "none";
    selectedText = "";
  }

  function isLikelyPhoneSelection(text) {
    if (!text) {
      return false;
    }

    const raw = String(text).trim();
    if (raw.length < 7) {
      return false;
    }

    if (!/^[+\d\s().-]+$/.test(raw)) {
      return false;
    }

    const digits = raw.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }

  function showButtonNearSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      hideButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideButton();
      return;
    }

    const text = selection.toString().trim();
    if (!isLikelyPhoneSelection(text)) {
      hideButton();
      return;
    }

    selectedText = text;
    const button = getButton();
    const left = Math.min(window.innerWidth - 40, Math.max(8, rect.right + 8));
    const top = Math.min(window.innerHeight - 40, Math.max(8, rect.bottom + 8));
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    button.style.display = "flex";
  }

  function bindSelectionListeners() {
    document.addEventListener("mouseup", () => {
      window.setTimeout(showButtonNearSelection, 20);
    });

    document.addEventListener("keyup", () => {
      window.setTimeout(showButtonNearSelection, 20);
    });

    document.addEventListener("mousedown", (event) => {
      const button = getButton();
      if (event.target !== button && !button.contains(event.target)) {
        hideButton();
      }
    });

    document.addEventListener("scroll", hideButton, true);
    window.addEventListener("blur", hideButton);
  }
})();
