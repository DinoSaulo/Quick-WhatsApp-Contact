/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStorage = vi.hoisted(() => ({
  getSettings: vi.fn()
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

  it("advances to the auto-highlight step, showing its screenshot and a Finish button", async () => {
    const page = await renderTutorialPage();

    page.querySelector("#tutorial-next").click();

    expect(page.querySelector(".title").textContent).toBe("Start a chat from any phone number");
    const image = page.querySelector(".tutorial-step__image");
    expect(image.getAttribute("src")).toBe(
      "chrome-extension://onboarding-id/assets/onboarding/auto-highlight-example.png"
    );
    expect(page.querySelector("#tutorial-back")).not.toBeNull();
    expect(page.querySelector("#tutorial-next")).toBeNull();
    expect(page.querySelector("#tutorial-finish")).not.toBeNull();
    expect(page.querySelector("#tutorial-skip")).toBeNull();
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

    page.querySelector("#tutorial-next").click();
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
