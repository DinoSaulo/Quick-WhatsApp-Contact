import { readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { readdirSync } from "node:fs";
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

// Codebase-wide sweep, not a per-link assertion: every current target="_blank" anchor is
// already individually covered (options.integration.test.js, donationModal.integration.test.js),
// but those tests only protect the links that exist today. Tabnabbing — a target="_blank" page
// using window.opener to redirect the original tab to a phishing page — is a class of bug that
// shows up the moment someone adds a NEW external link and forgets rel="noopener", so this test
// scans every .html/.js file in src/ instead of naming files, and will catch that link too.
describe("tabnabbing protection", () => {
  it("pairs every target=\"_blank\" anchor in src/ with rel=\"noopener\"", () => {
    const offenders = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      const anchorTags = source.match(/<a\b[^>]*>/gi) ?? [];

      for (const tag of anchorTags) {
        if (!/target\s*=\s*"_blank"/i.test(tag)) {
          continue;
        }
        if (!/rel\s*=\s*"[^"]*\bnoopener\b[^"]*"/i.test(tag)) {
          offenders.push(`${relative(projectRoot, file)}: ${tag.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("has at least one target=\"_blank\" anchor to actually exercise the sweep above", () => {
    // Guards against the check above silently passing because nothing matched at all
    // (e.g. a refactor that moves every external link into a different file type).
    const totalBlankTargets = sourceFiles.reduce((count, file) => {
      const source = readFileSync(file, "utf8");
      return count + (source.match(/target\s*=\s*"_blank"/gi)?.length ?? 0);
    }, 0);

    expect(totalBlankTargets).toBeGreaterThan(0);
  });
});

describe("extension storage isolation", () => {
  it("does not expose session handoff data to untrusted content-script contexts", () => {
    const storageSource = readFileSync(resolve(projectRoot, "src/utils/storage.js"), "utf8");

    expect(storageSource).not.toMatch(/storage\.session\.setAccessLevel\s*\(/);
    expect(storageSource).not.toContain("TRUSTED_AND_UNTRUSTED_CONTEXTS");
  });
});
