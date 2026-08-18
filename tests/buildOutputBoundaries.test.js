import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "dist", "extension");

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(file) : [file];
  });
}

describe("built extension boundaries", () => {
  it("contains a built manifest and no development-only directories", () => {
    expect(existsSync(resolve(outputRoot, "manifest.json"))).toBe(true);
    for (const forbidden of ["tests", "docs", "store-assets", ".git"]) {
      expect(existsSync(resolve(outputRoot, forbidden)), forbidden).toBe(false);
    }
  });

  it("does not ship source maps, test files, or remote executable imports", () => {
    const offenders = [];
    for (const file of collectFiles(outputRoot)) {
      const relativeFile = relative(outputRoot, file);
      if (/\.(?:map|test|spec)\.[cm]?js$/i.test(relativeFile)) offenders.push(relativeFile);
      if (!/\.(?:js|html)$/i.test(file)) continue;
      const source = readFileSync(file, "utf8");
      if (/import\s*(?:\(|[^;]*from\s*)["']https?:\/\//.test(source)) {
        offenders.push(`${relativeFile}: remote import`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
