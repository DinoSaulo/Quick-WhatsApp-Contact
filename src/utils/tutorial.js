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
  }
];
