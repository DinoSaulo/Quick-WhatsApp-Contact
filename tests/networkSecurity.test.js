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
// https://wa.me/<number> in a new tab after the user asks to start a chat (see
// buildWhatsAppUrl in src/utils/phone.js). Everything below asserts that stays true — no
// fetch/XHR call exists to exfiltrate data to some other endpoint, and no non-TLS URL is
// ever used as a real network destination (as opposed to XML namespace URIs, which are not
// network requests and are excluded below).
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
    // Two categories of "http://" text are not network requests and are allowed:
    // - XML/SVG namespace declarations (xmlns="http://www.w3.org/2000/svg") — never dereferenced.
    // - "http://*/*" match patterns (PAGE_ORIGINS in background.js/options.js) — the wildcard
    //   host permission string content scripts register against, not a URL fetched by this
    //   extension. Plain-HTTP pages legitimately have "tel:" links too, so this pattern is
    //   intentional, not a plaintext network call.
    // Everything else starting with "http://" would be a real, MITM-able network destination.
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
