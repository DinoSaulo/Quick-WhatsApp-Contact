// Caminho da página de tutorial, usado pelo service worker (install limpo) e pelas
// opções (botão "Ver tutorial") — fonte única para não duplicar o literal.
export const ONBOARDING_PAGE_PATH = "src/onboarding/onboarding.html";

// Passos do tutorial exibido logo após a instalação (onInstalled reason "install", background.js).
// Cada passo aponta para chaves de i18n.js, não texto literal. `image` é opcional (assets/onboarding/).
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
