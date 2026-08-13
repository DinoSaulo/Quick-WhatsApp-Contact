import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getMessages } from "../src/utils/i18n.js";
import { ONBOARDING_PAGE_PATH, TUTORIAL_STEPS } from "../src/utils/tutorial.js";

const projectRoot = resolve(import.meta.dirname, "..");
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const stepsWithImage = TUTORIAL_STEPS.filter((step) => step.image);

describe("onboarding page path", () => {
  it("points at a real file inside the packaged extension", () => {
    expect(ONBOARDING_PAGE_PATH).toBe("src/onboarding/onboarding.html");
    expect(existsSync(resolve(projectRoot, ONBOARDING_PAGE_PATH))).toBe(true);
  });
});

describe("tutorial steps config", () => {
  it("starts with a welcome step with no image", () => {
    expect(TUTORIAL_STEPS[0].id).toBe("welcome");
    expect(TUTORIAL_STEPS[0].image).toBeNull();
  });

  it("has an auto-highlight step pointing at a real screenshot asset", () => {
    const step = TUTORIAL_STEPS.find((candidate) => candidate.id === "auto-highlight");
    expect(step).toBeDefined();
    expect(existsSync(resolve(projectRoot, step.image))).toBe(true);
  });

  it("keeps the expected step order and unique ids (background.js/onboarding.js rely on first/last step)", () => {
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "auto-highlight",
      "toolbar-icon",
      "popup-form",
      "whatsapp-redirect",
      "whatsapp-message"
    ]);
    expect(new Set(TUTORIAL_STEPS.map((step) => step.id)).size).toBe(TUTORIAL_STEPS.length);
  });

  it("only the welcome step has no image; every other step points at a real, non-empty PNG", () => {
    expect(TUTORIAL_STEPS.filter((step) => step.image === null)).toEqual([TUTORIAL_STEPS[0]]);
    expect(stepsWithImage.length).toBe(TUTORIAL_STEPS.length - 1);
  });

  it.each(stepsWithImage.map((step) => [step.id, step.image]))(
    "screenshot asset for %s at %s is a real PNG file",
    (_id, image) => {
      const buffer = readFileSync(resolve(projectRoot, image));
      expect(buffer.length, image).toBeGreaterThan(0);
      expect(buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES), image).toBe(true);
    }
  );

  it.each(["en-US", "pt-BR"])(
    "resolves a real title and description for every step in %s",
    (language) => {
      const messages = getMessages(language);
      for (const step of TUTORIAL_STEPS) {
        expect(messages[step.titleKey], step.titleKey).toBeTruthy();
        expect(messages[step.descriptionKey], step.descriptionKey).toBeTruthy();
        if (step.imageAltKey) {
          expect(messages[step.imageAltKey], step.imageAltKey).toBeTruthy();
        }
      }
    }
  );
});
