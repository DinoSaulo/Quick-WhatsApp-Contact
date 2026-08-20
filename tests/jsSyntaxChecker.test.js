import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkSyntax, collectJavaScript } from "./js-syntax-checker.mjs";

describe("collectJavaScript", () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "collect-js-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("finds .js and .mjs files but not other extensions", () => {
    writeFileSync(join(dir, "a.js"), "");
    writeFileSync(join(dir, "b.mjs"), "");
    writeFileSync(join(dir, "c.txt"), "");

    expect(collectJavaScript(dir).sort()).toEqual([join(dir, "a.js"), join(dir, "b.mjs")].sort());
  });

  it("recurses into subdirectories, including node_modules", () => {
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "d.js"), "");
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "nested", "e.js"), "");

    expect(collectJavaScript(dir).sort()).toEqual(
      [join(dir, "node_modules", "d.js"), join(dir, "nested", "e.js")].sort(),
    );
  });

  it("returns an empty array for a directory with no JavaScript files", () => {
    writeFileSync(join(dir, "f.txt"), "");
    expect(collectJavaScript(dir)).toEqual([]);
  });
});

describe("checkSyntax", () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "check-syntax-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes a syntactically valid file", () => {
    const file = join(dir, "valid.js");
    writeFileSync(file, "const x = 1;\nexport default x;\n");

    expect(checkSyntax(file)).toEqual({ ok: true, message: null });
  });

  it("fails a file with a real syntax error, reporting the file path in the message", () => {
    const file = join(dir, "invalid.js");
    writeFileSync(file, "const x = ;\n");

    const result = checkSyntax(file);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(file);
  });

  it("fails with a startup message when the file does not exist", () => {
    const file = join(dir, "missing.js");

    const result = checkSyntax(file);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(file);
  });
});
