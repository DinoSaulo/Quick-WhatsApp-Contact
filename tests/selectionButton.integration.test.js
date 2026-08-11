/* @vitest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInContext } from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const scriptSource = readFileSync(
  resolve(import.meta.dirname, "../src/content/selectionButton.js"),
  "utf8"
);
const LANGUAGE_KEY = "quick-whatsapp-contact.language";

async function createPage({ text = "+351 912 345 678", rect, language = "en-US" } = {}) {
  const dom = new JSDOM("<!doctype html><html><body><p>Select a phone</p></body></html>", {
    runScripts: "outside-only",
    url: "https://example.com"
  });
  const storageListeners = [];
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });
  const selectionRect = rect || { width: 100, height: 20, right: 120, bottom: 80 };

  dom.window.chrome = {
    runtime: {
      getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
      sendMessage
    },
    storage: {
      sync: { get: vi.fn().mockResolvedValue({ [LANGUAGE_KEY]: language }) },
      onChanged: { addListener: vi.fn((listener) => storageListeners.push(listener)) }
    }
  };
  dom.window.getSelection = vi.fn(() => ({
    rangeCount: 1,
    toString: () => text,
    getRangeAt: () => ({ getBoundingClientRect: () => selectionRect })
  }));

  runInContext(scriptSource, dom.getInternalVMContext());
  await new Promise((resolvePromise) => dom.window.setTimeout(resolvePromise, 0));

  return { dom, sendMessage, storageListeners };
}

async function dispatchSelection(page) {
  page.dom.window.document.dispatchEvent(new page.dom.window.MouseEvent("mouseup", {
    bubbles: true
  }));
  await new Promise((resolvePromise) => page.dom.window.setTimeout(resolvePromise, 30));
  return page.dom.window.document.querySelector("#quick-whatsapp-contact-selection-button");
}

describe("selected phone helper integration", () => {
  it("shows an accessible button for a phone-like selection", async () => {
    const page = await createPage();
    const button = await dispatchSelection(page);

    expect(button.style.display).toBe("flex");
    expect(button.title).toBe("Open in WhatsApp");
    expect(button.getAttribute("aria-label")).toBe("Open in WhatsApp");
    expect(button.querySelector("img").src).toBe("chrome-extension://test-id/icons/icon16.png");
  });

  it("sends the selected phone and hides the button after activation", async () => {
    const page = await createPage({ text: "+55 (11) 99999-8888" });
    const button = await dispatchSelection(page);

    button.click();
    await new Promise((resolvePromise) => page.dom.window.setTimeout(resolvePromise, 0));

    expect(page.sendMessage).toHaveBeenCalledWith({
      type: "quick-whatsapp-contact.process-selection",
      selectionText: "+55 (11) 99999-8888"
    });
    expect(button.style.display).toBe("none");
  });

  it.each([
    ["call +351 912 345 678"],
    ["1234567"],
    ["1".repeat(16)],
    ["<script>351912345678</script>"]
  ])("does not expose an action for invalid selection %s", async (text) => {
    const page = await createPage({ text });
    const button = await dispatchSelection(page);

    expect(button.style.display).toBe("none");
    expect(page.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps the action within the visible viewport", async () => {
    const page = await createPage({
      rect: { width: 100, height: 20, right: 10000, bottom: 10000 }
    });
    Object.defineProperty(page.dom.window, "innerWidth", { value: 800 });
    Object.defineProperty(page.dom.window, "innerHeight", { value: 600 });

    const button = await dispatchSelection(page);

    expect(button.style.left).toBe("760px");
    expect(button.style.top).toBe("560px");
  });

  it("updates the button language only for sync storage changes", async () => {
    const page = await createPage();
    const button = await dispatchSelection(page);

    page.storageListeners[0]({ [LANGUAGE_KEY]: { newValue: "pt-BR" } }, "local");
    expect(button.title).toBe("Open in WhatsApp");

    page.storageListeners[0]({ [LANGUAGE_KEY]: { newValue: "pt-BR" } }, "sync");
    expect(button.title).toBe("Abrir no WhatsApp");
  });
});
