/* @vitest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInContext } from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const scriptSource = readFileSync(
  resolve(import.meta.dirname, "../src/content/autoHighlight.js"),
  "utf8"
);
const AUTO_HIGHLIGHT_KEY = "quick-whatsapp-contact.auto-highlight-enabled";
const LANGUAGE_KEY = "quick-whatsapp-contact.language";

async function createPage({ html = "", enabled = true, language = "en-US" } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    runScripts: "outside-only",
    url: "https://example.com"
  });
  const storageListeners = [];
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });

  dom.window.chrome = {
    runtime: {
      getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
      sendMessage
    },
    storage: {
      sync: {
        get: vi.fn().mockResolvedValue({
          [AUTO_HIGHLIGHT_KEY]: enabled,
          [LANGUAGE_KEY]: language
        })
      },
      onChanged: {
        addListener: vi.fn((listener) => storageListeners.push(listener))
      }
    }
  };

  runInContext(scriptSource, dom.getInternalVMContext());
  await new Promise((resolvePromise) => dom.window.setTimeout(resolvePromise, 0));

  return { dom, storageListeners, sendMessage };
}

describe("automatic tel link helper integration", () => {
  it("adds one accessible, package-local action per telephone link", async () => {
    const { dom } = await createPage({
      html: '<a id="phone" href="tel:+351912345678">Call</a>'
    });

    const actions = dom.window.document.querySelectorAll(".qwc-tel-action");
    const button = dom.window.document.querySelector(".qwc-tel-action-button");
    const icon = button.querySelector("img");

    expect(actions).toHaveLength(1);
    expect(button.title).toBe("Open in WhatsApp");
    expect(button.getAttribute("aria-label")).toBe("Open in WhatsApp");
    expect(icon.src).toBe("chrome-extension://test-id/icons/icon16.png");
  });

  it("renders the tel action 20% larger with an accessible pulse animation", async () => {
    const { dom } = await createPage({
      html: '<a href="tel:+351912345678">Call</a>'
    });

    const styles = dom.window.document.getElementById("qwc-highlight-style").textContent;

    expect(styles).toMatch(/\.qwc-tel-action-button\s*\{[^}]*width:\s*19\.2px/s);
    expect(styles).toMatch(/\.qwc-tel-action-button\s+img\s*\{[^}]*width:\s*19\.2px/s);
    expect(styles).toContain("@keyframes qwc-tel-action-pulse");
    expect(styles).toContain(
      "animation: qwc-tel-action-pulse 1.6s ease-in-out infinite !important"
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none !important/
    );
  });

  it("sends only the tel value through the expected message protocol", async () => {
    const { dom, sendMessage } = await createPage({
      html: '<a href="tel: +55 (11) 99999-8888 ">Call</a>'
    });

    dom.window.document.querySelector(".qwc-tel-action-button").click();

    expect(sendMessage).toHaveBeenCalledWith({
      type: "quick-whatsapp-contact.process-selection",
      selectionText: "+55 (11) 99999-8888"
    });
  });

  it("does not inspect links until the stored opt-in is enabled", async () => {
    const { dom, storageListeners } = await createPage({
      html: '<a href="tel:+351912345678">Call</a>',
      enabled: false
    });

    expect(dom.window.document.querySelector(".qwc-tel-action")).toBeNull();

    storageListeners[0]({ [AUTO_HIGHLIGHT_KEY]: { newValue: true } }, "sync");
    expect(dom.window.document.querySelector(".qwc-tel-action")).not.toBeNull();

    storageListeners[0]({ [AUTO_HIGHLIGHT_KEY]: { newValue: false } }, "sync");
    expect(dom.window.document.querySelector(".qwc-tel-action")).toBeNull();
  });

  it("updates accessible labels when the language setting changes", async () => {
    const { dom, storageListeners } = await createPage({
      html: '<a href="tel:+351912345678">Call</a>'
    });

    storageListeners[0]({ [LANGUAGE_KEY]: { newValue: "pt-BR" } }, "sync");

    const button = dom.window.document.querySelector(".qwc-tel-action-button");
    expect(button.title).toBe("Abrir no WhatsApp");
    expect(button.getAttribute("aria-label")).toBe("Abrir no WhatsApp");
  });

  it("processes telephone links added after page load without duplicating actions", async () => {
    const { dom } = await createPage();
    const link = dom.window.document.createElement("a");
    link.href = "tel:+14155552671";
    link.textContent = "Call";
    dom.window.document.body.appendChild(link);

    await new Promise((resolvePromise) => dom.window.setTimeout(resolvePromise, 150));
    link.setAttribute("href", "tel:+14155552671");
    await new Promise((resolvePromise) => dom.window.setTimeout(resolvePromise, 150));

    expect(dom.window.document.querySelectorAll(".qwc-tel-action")).toHaveLength(1);
  });

  it("ignores empty tel links and storage changes from other areas", async () => {
    const { dom, storageListeners } = await createPage({
      html: '<a href="tel:   ">Empty</a>',
      enabled: false
    });

    storageListeners[0]({ [AUTO_HIGHLIGHT_KEY]: { newValue: true } }, "local");

    expect(dom.window.document.querySelector(".qwc-tel-action")).toBeNull();
  });
});
