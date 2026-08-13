import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getMessages } from "../src/utils/i18n.js";
import { TUTORIAL_STEPS } from "../src/utils/tutorial.js";

const projectRoot = resolve(import.meta.dirname, "..");

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
