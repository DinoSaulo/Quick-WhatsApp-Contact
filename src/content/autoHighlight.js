(function () {
  const PROCESS_SELECTION_MESSAGE = "quick-whatsapp-contact.process-selection";
  const AUTO_HIGHLIGHT_ENABLED_KEY = "quick-whatsapp-contact.auto-highlight-enabled";
  const LANGUAGE_KEY = "quick-whatsapp-contact.language";
  const ACTION_CLASS = "qwc-tel-action";
  const ACTION_BUTTON_CLASS = "qwc-tel-action-button";

  const TEXTS = {
    "en-US": { actionWhatsapp: "Open in WhatsApp" },
    "pt-BR": { actionWhatsapp: "Abrir no WhatsApp" }
  };

  let isEnabled = true;
  let language = "en-US";
  let observer = null;
  let mutationTimer = null;

  injectStyles();
  initialize();

  async function initialize() {
    const stored = await chrome.storage.sync.get([AUTO_HIGHLIGHT_ENABLED_KEY, LANGUAGE_KEY]);
    isEnabled =
      typeof stored[AUTO_HIGHLIGHT_ENABLED_KEY] === "boolean"
        ? stored[AUTO_HIGHLIGHT_ENABLED_KEY]
        : true;
    language = normalizeLanguage(stored[LANGUAGE_KEY]);

    if (isEnabled) {
      scanTelLinks();
      attachObserver();
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      if (changes[LANGUAGE_KEY]) {
        language = normalizeLanguage(changes[LANGUAGE_KEY].newValue);
        refreshButtonLabels();
      }

      if (changes[AUTO_HIGHLIGHT_ENABLED_KEY]) {
        isEnabled = Boolean(changes[AUTO_HIGHLIGHT_ENABLED_KEY].newValue);
        if (isEnabled) {
          scanTelLinks();
          attachObserver();
        } else {
          detachObserver();
          clearActions();
        }
      }
    });
  }

  function normalizeLanguage(value) {
    return String(value || "").toLowerCase() === "pt-br" ? "pt-BR" : "en-US";
  }

  function getText(key) {
    return (TEXTS[language] || TEXTS["en-US"])[key];
  }

  function injectStyles() {
    if (document.getElementById("qwc-highlight-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "qwc-highlight-style";
    style.textContent = `
      .${ACTION_CLASS} {
        display: inline-flex;
        margin-left: 4px;
        vertical-align: middle;
      }

      .${ACTION_BUTTON_CLASS} {
        width: 16px;
        height: 16px;
        border: none;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
      }

      .${ACTION_BUTTON_CLASS} img {
        display: block;
        width: 16px;
        height: 16px;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function attachObserver() {
    if (observer) {
      return;
    }

    observer = new MutationObserver((mutations) => {
      if (mutationTimer) {
        clearTimeout(mutationTimer);
      }

      mutationTimer = window.setTimeout(() => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes") {
            processNode(mutation.target);
          } else {
            mutation.addedNodes.forEach((addedNode) => processNode(addedNode));
          }
        }
      }, 120);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"]
    });
  }

  function detachObserver() {
    if (!observer) {
      return;
    }
    observer.disconnect();
    observer = null;
  }

  function clearActions() {
    document.querySelectorAll(`.${ACTION_CLASS}`).forEach((element) => element.remove());
  }

  function scanTelLinks() {
    processNode(document.body || document.documentElement);
  }

  function processNode(node) {
    if (!isEnabled || !node || !(node instanceof Element)) {
      return;
    }

    if (node.matches?.('a[href^="tel:"]')) {
      ensureActionForLink(node);
    }

    node.querySelectorAll?.('a[href^="tel:"]').forEach((link) => {
      ensureActionForLink(link);
    });
  }

  function ensureActionForLink(linkElement) {
    if (!(linkElement instanceof HTMLAnchorElement)) {
      return;
    }

    const hrefValue = (linkElement.getAttribute("href") || "").trim();
    if (!hrefValue.toLowerCase().startsWith("tel:")) {
      const next = linkElement.nextElementSibling;
      if (next && next.classList.contains(ACTION_CLASS)) {
        next.remove();
      }
      return;
    }

    const next = linkElement.nextElementSibling;
    if (next && next.classList.contains(ACTION_CLASS)) {
      return;
    }

    const telValue = hrefValue.slice(4).trim();
    if (!telValue) {
      return;
    }

    const actionRoot = document.createElement("span");
    actionRoot.className = ACTION_CLASS;

    const button = document.createElement("button");
    button.type = "button";
    button.className = ACTION_BUTTON_CLASS;
    button.title = getText("actionWhatsapp");
    button.setAttribute("aria-label", getText("actionWhatsapp"));

    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("icons/icon16.png");
    icon.alt = "WhatsApp";

    button.appendChild(icon);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({
        type: PROCESS_SELECTION_MESSAGE,
        selectionText: telValue
      });
    });

    actionRoot.appendChild(button);
    linkElement.insertAdjacentElement("afterend", actionRoot);
  }

  function refreshButtonLabels() {
    const label = getText("actionWhatsapp");
    document.querySelectorAll(`.${ACTION_BUTTON_CLASS}`).forEach((button) => {
      button.title = label;
      button.setAttribute("aria-label", label);
    });
  }
})();
