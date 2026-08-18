// Copy for the uninstall farewell page (docs/farewell.html) — hosted outside the packed extension
// (GitHub Pages, see background.js's FAREWELL_PAGE_URL), so it can't import src/utils/i18n.js.
const EMOJI = "😊";

const MESSAGES = {
  "en-US": {
    eyebrow: "Quick WhatsApp Contact",
    title: "Thanks for using Quick WhatsApp Contact!",
    message:
      "We hope it helped you start WhatsApp conversations faster. If you'd like to tell us why " +
      "you uninstalled it, or suggest something, feel free to open an issue on GitHub."
  },
  "pt-BR": {
    eyebrow: "Quick WhatsApp Contact",
    title: "Obrigado por usar o Quick WhatsApp Contact!",
    message:
      "Esperamos ter ajudado você a conversar mais rápido no WhatsApp. Se quiser nos contar o " +
      "motivo da desinstalação ou sugerir algo, sinta-se à vontade para abrir uma issue no GitHub."
  }
};

// Mirrors normalizeLanguage() in src/utils/i18n.js: only "pt-br" is recognized (case-insensitive);
// anything else — missing, garbled, or unrecognized — falls back to en-US.
export function normalizeFarewellLanguage(rawLanguage) {
  return String(rawLanguage || "").toLowerCase() === "pt-br" ? "pt-BR" : "en-US";
}

export function pickFarewellCopy(search = "") {
  const params = new URLSearchParams(search);
  const language = normalizeFarewellLanguage(params.get("lang"));
  return { emoji: EMOJI, language, ...MESSAGES[language] };
}

// DOM side effect, kept separate from pickFarewellCopy() so the copy-selection logic above stays
// testable without a document. Called explicitly from farewell.html's own inline bootstrap script.
export function renderFarewellPage(search = window.location.search, doc = document) {
  const { emoji, language, eyebrow, title, message } = pickFarewellCopy(search);

  doc.documentElement.lang = language;
  doc.getElementById("farewell-emoji").textContent = emoji;
  doc.getElementById("farewell-eyebrow").textContent = eyebrow;
  doc.getElementById("farewell-title").textContent = title;
  doc.getElementById("farewell-message").textContent = message;
}
