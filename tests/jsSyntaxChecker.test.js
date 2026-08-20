import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportSourceCheck, runSourceCheck } from "../scripts/check-source.mjs";
import { checkSyntax, collectJavaScript } from "./js-syntax-checker.mjs";

describe("runSourceCheck", () => {
  it("returns every collected file when all syntax checks pass", () => {
    const result = runSourceCheck({
      root: "/project",
      collect: (directory) => [`${directory}/valid.js`],
      check: () => ({ ok: true, message: null }),
    });

    expect(result.files).toHaveLength(4);
    expect(result.failures).toEqual([]);
  });

  it("collects each syntax-check failure without stopping at the first one", () => {
    const result = runSourceCheck({
      root: "/project",
      collect: (directory) => [`${directory}/invalid.js`],
      check: (file) => ({ ok: false, message: `Invalid: ${file}` }),
    });

    expect(result.failures).toHaveLength(4);
    expect(result.failures.every((message) => message.startsWith("Invalid:"))).toBe(true);
  });

  it("reports success without changing the process exit code", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(reportSourceCheck({ failures: [], files: ["a.js"] }, { logger, runtime })).toBe(true);
    expect(logger.log).toHaveBeenCalledWith("Syntax check passed for 1 JavaScript files.");
    expect(runtime.exitCode).toBeUndefined();
  });

  it("reports failures and sets a failing process exit code", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(reportSourceCheck({ failures: ["one", "two"], files: [] }, { logger, runtime })).toBe(false);
    expect(logger.error).toHaveBeenCalledWith("one\ntwo");
    expect(runtime.exitCode).toBe(1);
  });
});

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

    const result = checkSyntax(file, {
      spawn: () => ({ error: new Error("spawn failed") }),
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(file);
    expect(result.message).toContain("spawn failed");
  });
});
