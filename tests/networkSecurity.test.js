import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function collectFiles(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(entryPath, extensions);
    }
    return extensions.includes(extname(entry.name)) ? [entryPath] : [];
  });
}

const sourceFiles = collectFiles(resolve(projectRoot, "src"), [".html", ".js"]);

// This extension has exactly one legitimate reason to leave the browser: opening
// https://wa.me/<number> (buildWhatsAppUrl). Asserts no fetch/XHR and no non-TLS network destination exists (XML namespace URIs are excluded below, not network requests).
describe("network egress allow-list", () => {
  it("never calls fetch() or XMLHttpRequest anywhere in the shipped extension code", () => {
    const offenders = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      if (/\bfetch\s*\(/.test(source) || /\bnew\s+XMLHttpRequest\b/.test(source)) {
        offenders.push(relative(projectRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("only ever builds outbound URLs on the https scheme", () => {
    const offenders = [];
    // Allowed "http://" text that isn't a network request: XML/SVG namespace declarations, and
    // "http://*/*" match patterns (PAGE_ORIGINS) — a host-permission string, not a fetched URL.
    const allowedHttpPatterns = [/http:\/\/www\.w3\.org\//, /^http:\/\/\*\/\*$/];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      const httpMatches = source.match(/http:\/\/[^\s"'`)]+/g) ?? [];

      for (const match of httpMatches) {
        if (!allowedHttpPatterns.some((pattern) => pattern.test(match))) {
          offenders.push(`${relative(projectRoot, file)}: ${match}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the WhatsApp handoff pinned to the official https wa.me host", () => {
    const phoneUtilSource = readFileSync(resolve(projectRoot, "src/utils/phone.js"), "utf8");

    expect(phoneUtilSource).toContain("https://wa.me/");
    expect(phoneUtilSource).not.toMatch(/http:\/\/wa\.me/);
  });
});
