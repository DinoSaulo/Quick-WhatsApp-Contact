const DICTIONARY = {
  "en-US": {
    extensionName: "Quick WhatsApp Contact",
    contextMenuCall: "Call on WhatsApp",
    actionOpenSettings: "Settings",
    popupEyebrow: "Quick WhatsApp Contact",
    popupTitle: "Send message",
    popupDescriptionDefault:
      "Type a full number with country code or paste a contact to open WhatsApp in a new tab.",
    popupDescriptionNeedsCountry:
      "Select a country to complete the country code for the selected number and open WhatsApp.",
    labelCountry: "Country",
    labelPhone: "Phone number",
    labelMessage: "Message",
    buttonSend: "Send",
    buttonCancel: "Cancel",
    previewTab: "Every send action opens WhatsApp in a new tab.",
    previewFinalNumber: "Final number: +{number}",
    previewInvalidNumber: "Final number: enter a valid phone number",
    ddiEyebrow: "Select country code",
    ddiTitle: "Complete the number",
    ddiDescription:
      "The selected number did not include an international code. Choose a country, review the number and send.",
    validationInvalidFormat: "Invalid format for +{ddi}. Use: {formats}",
    actionWhatsapp: "Open in WhatsApp",
    optionsTitle: "Extension settings",
    optionsDescription: "Manage behavior and appearance preferences.",
    optionAutoHighlight: "Auto-highlight phone numbers on pages",
    optionDarkMode: "Dark mode",
    optionLanguage: "Language",
    optionLanguageEnglish: "English (EN-US)",
    optionLanguagePortuguese: "Portuguese (PT-BR)",
    optionDefaultCountry: "Default country",
    optionDefaultCountryNone: "— Automatic —",
    optionsSaved: "Settings saved",
    searchCountryPlaceholder: "Search country...",
    searchCountryNoResults: "No countries found"
  },
  "pt-BR": {
    extensionName: "Quick WhatsApp Contact",
    contextMenuCall: "Chamar no WhatsApp",
    actionOpenSettings: "Configurações",
    popupEyebrow: "Quick WhatsApp Contact",
    popupTitle: "Enviar mensagem",
    popupDescriptionDefault:
      "Digite o número completo com DDI ou cole um contato para abrir o WhatsApp em uma nova aba.",
    popupDescriptionNeedsCountry:
      "Selecione o país para completar o DDI do número selecionado e abrir o WhatsApp.",
    labelCountry: "País",
    labelPhone: "Número",
    labelMessage: "Mensagem",
    buttonSend: "Enviar",
    buttonCancel: "Cancelar",
    previewTab: "Toda ação de envio abre o WhatsApp em uma nova aba.",
    previewFinalNumber: "Número final: +{number}",
    previewInvalidNumber: "Número final: informe um telefone válido",
    ddiEyebrow: "Selecionar DDI",
    ddiTitle: "Complete o número",
    ddiDescription:
      "O número selecionado não tinha código internacional. Escolha o país, revise o número e envie.",
    validationInvalidFormat: "Formato inválido para +{ddi}. Use: {formats}",
    actionWhatsapp: "Abrir no WhatsApp",
    optionsTitle: "Configurações da extensão",
    optionsDescription: "Gerencie preferências de comportamento e aparência.",
    optionAutoHighlight: "Realce automático de números na página",
    optionDarkMode: "Modo escuro",
    optionLanguage: "Idioma",
    optionLanguageEnglish: "Inglês (EN-US)",
    optionLanguagePortuguese: "Português (PT-BR)",
    optionDefaultCountry: "País padrão",
    optionDefaultCountryNone: "— Automático —",
    optionsSaved: "Configurações salvas",
    searchCountryPlaceholder: "Buscar país...",
    searchCountryNoResults: "Nenhum país encontrado"
  }
};

export function getMessages(language = "en-US") {
  return DICTIONARY[language] || DICTIONARY["en-US"];
}

export function t(messages, key, params = {}) {
  const template = messages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    return params[token] ?? "";
  });
}
