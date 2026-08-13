/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const onboardingHtml = readFileSync(
  resolve(import.meta.dirname, "../src/onboarding/onboarding.html"),
  "utf8"
);
const onboardingStyles = readFileSync(
  resolve(import.meta.dirname, "../src/onboarding/onboarding.css"),
  "utf8"
);

const mockStorage = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setLanguage: vi.fn()
}));

vi.mock("../src/utils/storage.js", () => mockStorage);

async function renderTutorialPage() {
  if (!customElements.get("tutorial-page")) {
    await import("../src/onboarding/onboarding.js");
  }

  document.body.innerHTML = "<tutorial-page></tutorial-page>";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.querySelector("tutorial-page");
}

describe("onboarding tutorial page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getSettings.mockResolvedValue({ language: "en-US", darkModeEnabled: false });
    mockStorage.setLanguage.mockResolvedValue();
    global.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://onboarding-id/${path}`)
      }
    };
    window.close = vi.fn();
  });

  it("starts on the welcome step, with no Back button and no image", async () => {
    const page = await renderTutorialPage();

    expect(page.querySelector(".title").textContent).toBe("Welcome to Quick WhatsApp Contact!");
    expect(page.querySelector("#tutorial-back")).toBeNull();
    expect(page.querySelector("#tutorial-next")).not.toBeNull();
    expect(page.querySelector("#tutorial-finish")).toBeNull();
    expect(page.querySelector(".tutorial-step__image")).toBeNull();
    expect(page.querySelectorAll(".tutorial-dots__dot")[0].getAttribute("aria-current")).toBe("true");
  });

  it("mounts the donation modal component inside its own footer, outside the tutorial card", () => {
    document.body.innerHTML = onboardingHtml;
    const footer = document.querySelector(".onboarding-footer");

    expect(footer).not.toBeNull();
    expect(footer.querySelector("donation-modal")).not.toBeNull();
    expect(document.querySelector("tutorial-page").contains(footer)).toBe(false);
    expect(onboardingHtml).toContain('<script type="module" src="../options/donationModal.js"></script>');
  });

  it("loads options.css so the donation modal's dialog/tabs/panel rules are styled, not just its trigger button", () => {
    // The .donation-trigger button rule lives in popup/styles.css (already linked), but the
    // dialog/tabs/panel rules the modal switches to once opened live only in options.css —
    // see that file's own top-of-file comment. Without this link the button rendered fine
    // but the opened modal looked unstyled, which is the regression this guards against.
    expect(onboardingHtml).toContain('<link rel="stylesheet" href="../options/options.css" />');
  });

  it("anchors the donation button as a floating control in the bottom-right corner, matching options.html", () => {
    expect(onboardingStyles).toMatch(
      /\.onboarding-footer donation-modal\s*\{[^}]*position:\s*fixed;[^}]*right:[^}]*bottom:[^}]*\}/s
    );
  });

  it("advances to the auto-highlight step, showing its screenshot and still offering Next/Skip", async () => {
    const page = await renderTutorialPage();

    page.querySelector("#tutorial-next").click();

    expect(page.querySelector(".title").textContent).toBe("Start a chat from any phone number");
    const image = page.querySelector(".tutorial-step__image");
    expect(image.getAttribute("src")).toBe(
      "chrome-extension://onboarding-id/assets/onboarding/auto-highlight-example.png"
    );
    expect(page.querySelector("#tutorial-back")).not.toBeNull();
    expect(page.querySelector("#tutorial-next")).not.toBeNull();
    expect(page.querySelector("#tutorial-finish")).toBeNull();
    expect(page.querySelector("#tutorial-skip")).not.toBeNull();
  });

  it("walks through the toolbar popup steps with their own screenshots", async () => {
    const page = await renderTutorialPage();
    const imageFor = () => page.querySelector(".tutorial-step__image").getAttribute("src");

    page.querySelector("#tutorial-next").click();
    page.querySelector("#tutorial-next").click();
    expect(page.querySelector(".title").textContent).toBe("Or open it from the toolbar");
    expect(imageFor()).toBe("chrome-extension://onboarding-id/assets/onboarding/toolbar-icon-example.png");

    page.querySelector("#tutorial-next").click();
    expect(page.querySelector(".title").textContent).toBe("Fill in the number and message");
    expect(imageFor()).toBe("chrome-extension://onboarding-id/assets/onboarding/popup-form-example.png");

    page.querySelector("#tutorial-next").click();
    expect(page.querySelector(".title").textContent).toBe("Choose how to open WhatsApp");
    expect(imageFor()).toBe("chrome-extension://onboarding-id/assets/onboarding/whatsapp-redirect-example.png");

    page.querySelector("#tutorial-next").click();
    expect(page.querySelector(".title").textContent).toBe("Send your message");
    expect(imageFor()).toBe("chrome-extension://onboarding-id/assets/onboarding/whatsapp-message-example.png");
    expect(page.querySelector("#tutorial-next")).toBeNull();
    expect(page.querySelector("#tutorial-finish")).not.toBeNull();
    expect(page.querySelector("#tutorial-skip")).toBeNull();
  });

  it("sets a descriptive alt text on each new step's screenshot", async () => {
    const page = await renderTutorialPage();
    const altFor = () => page.querySelector(".tutorial-step__image").getAttribute("alt");

    page.querySelector("#tutorial-next").click();
    page.querySelector("#tutorial-next").click();
    expect(altFor()).toBe("The extension icon highlighted in the browser toolbar");

    page.querySelector("#tutorial-next").click();
    expect(altFor()).toBe("The popup form with country, phone number and message filled in");

    page.querySelector("#tutorial-next").click();
    expect(altFor()).toBe("WhatsApp's page asking to open the desktop app or continue on WhatsApp Web");

    page.querySelector("#tutorial-next").click();
    expect(altFor()).toBe("A WhatsApp chat with the message ready to be sent");
  });

  it("keeps offering Skip on a middle step, not just the first one", async () => {
    const page = await renderTutorialPage();

    page.querySelector("#tutorial-next").click();
    page.querySelector("#tutorial-next").click();

    expect(page.querySelector(".title").textContent).toBe("Or open it from the toolbar");
    expect(page.querySelector("#tutorial-skip")).not.toBeNull();

    page.querySelector("#tutorial-skip").click();
    expect(window.close).toHaveBeenCalledOnce();
  });

  it("updates the step indicator to reflect all 6 steps, in the active language", async () => {
    const page = await renderTutorialPage();
    const firstDotLabel = () => page.querySelector(".tutorial-dots__dot").getAttribute("aria-label");

    expect(page.querySelectorAll(".tutorial-dots__dot")).toHaveLength(6);
    expect(firstDotLabel()).toBe("Step 1 of 6");

    page.querySelector("#tutorial-language").value = "pt-BR";
    page.querySelector("#tutorial-language").dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(firstDotLabel()).toBe("Passo 1 de 6");
  });

  it("keeps the language chosen on the welcome step after navigating to later steps", async () => {
    const page = await renderTutorialPage();
    const languageSelect = page.querySelector("#tutorial-language");

    languageSelect.value = "pt-BR";
    languageSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    page.querySelector("#tutorial-next").click();
    page.querySelector("#tutorial-next").click();

    expect(page.querySelector(".title").textContent).toBe("Ou abra pela barra de ferramentas");
    expect(page.querySelector("#tutorial-back").textContent.trim()).toBe("Voltar");
  });

  it("shows the language select only on the welcome step", async () => {
    const page = await renderTutorialPage();

    expect(page.querySelector("#tutorial-language")).not.toBeNull();

    page.querySelector("#tutorial-next").click();
    expect(page.querySelector("#tutorial-language")).toBeNull();
  });

  it("switches the tutorial language live and persists it when the select changes", async () => {
    const page = await renderTutorialPage();
    const languageSelect = page.querySelector("#tutorial-language");
    expect(languageSelect.value).toBe("en-US");

    languageSelect.value = "pt-BR";
    languageSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStorage.setLanguage).toHaveBeenCalledWith("pt-BR");
    expect(page.querySelector(".title").textContent).toBe("Bem-vindo ao Quick WhatsApp Contact!");
    expect(document.documentElement.getAttribute("lang")).toBe("pt-BR");
    expect(page.querySelector("#tutorial-language").value).toBe("pt-BR");
  });

  it("goes back to the welcome step from the last step", async () => {
    const page = await renderTutorialPage();

    page.querySelector("#tutorial-next").click();
    page.querySelector("#tutorial-back").click();

    expect(page.querySelector(".title").textContent).toBe("Welcome to Quick WhatsApp Contact!");
  });

  it("jumps directly to a step when its dot is clicked", async () => {
    const page = await renderTutorialPage();

    page.querySelectorAll(".tutorial-dots__dot")[1].click();

    expect(page.querySelector(".title").textContent).toBe("Start a chat from any phone number");
  });

  it("closes the tab when Skip is clicked on the first step", async () => {
    const page = await renderTutorialPage();

    page.querySelector("#tutorial-skip").click();

    expect(window.close).toHaveBeenCalledOnce();
  });

  it("closes the tab when Finish is clicked on the last step", async () => {
    const page = await renderTutorialPage();

    for (let step = 0; step < 5; step += 1) {
      page.querySelector("#tutorial-next").click();
    }
    page.querySelector("#tutorial-finish").click();

    expect(window.close).toHaveBeenCalledOnce();
  });

  it("shows the tutorial in Portuguese when that is the saved language", async () => {
    mockStorage.getSettings.mockResolvedValue({ language: "pt-BR", darkModeEnabled: false });
    const page = await renderTutorialPage();

    expect(page.querySelector(".title").textContent).toBe("Bem-vindo ao Quick WhatsApp Contact!");
    expect(page.querySelector("#tutorial-next").textContent.trim()).toBe("Próximo");
    expect(document.documentElement.getAttribute("lang")).toBe("pt-BR");
  });
});
