// Caminho (relativo à raiz da extensão) da página de tutorial, usado tanto pelo
// service worker (abertura automática num install limpo, src/background.js) quanto
// pela página de configurações (botão "Ver tutorial", src/options/options.js) —
// fonte única para não duplicar o literal em dois arquivos.
export const ONBOARDING_PAGE_PATH = "src/onboarding/onboarding.html";

// Passos do tutorial exibido em src/onboarding/onboarding.html logo após a instalação
// (chrome.runtime.onInstalled com reason "install", ver src/background.js).
//
// Cada passo aponta suas strings de UI para chaves do dicionário (src/utils/i18n.js),
// não para texto literal aqui — assim o tutorial acompanha o idioma da extensão como
// qualquer outra tela. `image` é opcional; quando presente, é o caminho (relativo à
// raiz da extensão) de uma captura de tela estática em assets/onboarding/.
export const TUTORIAL_STEPS = [
  {
    id: "welcome",
    titleKey: "tutorialWelcomeTitle",
    descriptionKey: "tutorialWelcomeDescription",
    image: null
  },
  {
    id: "auto-highlight",
    titleKey: "tutorialAutoHighlightTitle",
    descriptionKey: "tutorialAutoHighlightDescription",
    image: "assets/onboarding/auto-highlight-example.png",
    imageAltKey: "tutorialAutoHighlightImageAlt"
  },
  {
    id: "toolbar-icon",
    titleKey: "tutorialToolbarIconTitle",
    descriptionKey: "tutorialToolbarIconDescription",
    image: "assets/onboarding/toolbar-icon-example.png",
    imageAltKey: "tutorialToolbarIconImageAlt"
  },
  {
    id: "popup-form",
    titleKey: "tutorialPopupFormTitle",
    descriptionKey: "tutorialPopupFormDescription",
    image: "assets/onboarding/popup-form-example.png",
    imageAltKey: "tutorialPopupFormImageAlt"
  },
  {
    id: "whatsapp-redirect",
    titleKey: "tutorialWhatsappRedirectTitle",
    descriptionKey: "tutorialWhatsappRedirectDescription",
    image: "assets/onboarding/whatsapp-redirect-example.png",
    imageAltKey: "tutorialWhatsappRedirectImageAlt"
  },
  {
    id: "whatsapp-message",
    titleKey: "tutorialWhatsappMessageTitle",
    descriptionKey: "tutorialWhatsappMessageDescription",
    image: "assets/onboarding/whatsapp-message-example.png",
    imageAltKey: "tutorialWhatsappMessageImageAlt"
  }
];
