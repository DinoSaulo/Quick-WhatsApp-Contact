/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeFarewellLanguage,
  pickFarewellCopy,
  renderFarewellPage
} from "../docs/farewell.js";

const farewellHtml = readFileSync(resolve(import.meta.dirname, "../docs/farewell.html"), "utf8");

describe("normalizeFarewellLanguage", () => {
  it("recognizes pt-BR case-insensitively", () => {
    expect(normalizeFarewellLanguage("pt-BR")).toBe("pt-BR");
    expect(normalizeFarewellLanguage("pt-br")).toBe("pt-BR");
    expect(normalizeFarewellLanguage("PT-BR")).toBe("pt-BR");
  });

  it("falls back to en-US for missing, unrecognized, or hostile input", () => {
    expect(normalizeFarewellLanguage()).toBe("en-US");
    expect(normalizeFarewellLanguage("")).toBe("en-US");
    expect(normalizeFarewellLanguage("fr-FR")).toBe("en-US");
    expect(normalizeFarewellLanguage('"><script>alert(1)</script>')).toBe("en-US");
  });
});

describe("pickFarewellCopy", () => {
  it("returns the happy emoji and pt-BR copy for ?lang=pt-BR", () => {
    const copy = pickFarewellCopy("?lang=pt-BR");

    expect(copy.language).toBe("pt-BR");
    expect(copy.emoji).toBe("😊");
    expect(copy.eyebrow).toBe("Quick WhatsApp Contact");
    expect(copy.title).toContain("Obrigado");
    expect(copy.message.length).toBeGreaterThan(0);
  });

  it("returns en-US copy for ?lang=en-US", () => {
    const copy = pickFarewellCopy("?lang=en-US");

    expect(copy.language).toBe("en-US");
    expect(copy.title).toContain("Thanks");
  });

  it("defaults to en-US when the query string has no lang param", () => {
    expect(pickFarewellCopy("").language).toBe("en-US");
    expect(pickFarewellCopy("?other=1").language).toBe("en-US");
  });
});

describe("renderFarewellPage", () => {
  function buildDocument() {
    document.documentElement.lang = "";
    document.body.innerHTML = `
      <div id="farewell-emoji"></div>
      <p id="farewell-eyebrow"></p>
      <h1 id="farewell-title"></h1>
      <p id="farewell-message"></p>
    `;
    return document;
  }

  it("fills the farewell page elements from the query string's language", () => {
    const doc = buildDocument();

    renderFarewellPage("?lang=pt-BR", doc);

    expect(doc.documentElement.lang).toBe("pt-BR");
    expect(doc.getElementById("farewell-emoji").textContent).toBe("😊");
    expect(doc.getElementById("farewell-eyebrow").textContent).toBe("Quick WhatsApp Contact");
    expect(doc.getElementById("farewell-title").textContent).toContain("Obrigado");
    expect(doc.getElementById("farewell-message").textContent.length).toBeGreaterThan(0);
  });

  it("renders the English default when no language is given", () => {
    const doc = buildDocument();

    renderFarewellPage("", doc);

    expect(doc.documentElement.lang).toBe("en-US");
    expect(doc.getElementById("farewell-title").textContent).toContain("Thanks");
  });
});

// Regression guard: renderFarewellPage() and farewell.html are two separately-edited files that
// must agree on element ids — a typo in either would silently break the real, hosted page.
describe("docs/farewell.html", () => {
  it("imports farewell.js as a module and declares every id renderFarewellPage() writes to", () => {
    expect(farewellHtml).toContain('import { renderFarewellPage } from "./farewell.js"');
    for (const id of ["farewell-emoji", "farewell-eyebrow", "farewell-title", "farewell-message"]) {
      expect(farewellHtml).toContain(`id="${id}"`);
    }
  });
});
