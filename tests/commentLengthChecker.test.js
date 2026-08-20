import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectFiles, findOverlongCommentBlocks } from "./comment-length-checker.mjs";

const js = (lines) => findOverlongCommentBlocks(lines, { isYaml: false, maxLines: 2 });
const yaml = (lines) => findOverlongCommentBlocks(lines, { isYaml: true, maxLines: 2 });

describe("findOverlongCommentBlocks", () => {
  it("allows a line-comment run at or under the limit", () => {
    expect(js(["// one", "// two", "const x = 1;"])).toEqual([]);
  });

  it("flags a line-comment run over the limit, with 1-indexed start/end", () => {
    expect(js(["// one", "// two", "// three", "const x = 1;"])).toEqual([
      { startLine: 1, endLine: 3, lineCount: 3 },
    ]);
  });

  it("allows a block comment at or under the limit", () => {
    expect(js(["/* one", "two */", "const x = 1;"])).toEqual([]);
  });

  it("flags a block comment over the limit", () => {
    expect(js(["/* one", "two", "three */", "const x = 1;"])).toEqual([
      { startLine: 1, endLine: 3, lineCount: 3 },
    ]);
  });

  it("does not flag a single-line /* ... */ comment", () => {
    expect(js(["/* one line */", "const x = 1;"])).toEqual([]);
  });

  it("treats YAML comments as # lines, not // or /* */", () => {
    expect(yaml(["# one", "# two", "# three", "key: value"])).toEqual([
      { startLine: 1, endLine: 3, lineCount: 3 },
    ]);
  });

  it("does not treat a /* run as a block comment in YAML mode", () => {
    expect(yaml(["/* one", "two", "three", "key: value"])).toEqual([]);
  });

  it("separates two consecutive over-limit runs interrupted by code", () => {
    expect(
      js(["// a", "// b", "// c", "const x = 1;", "// d", "// e", "// f", "const y = 2;"]),
    ).toEqual([
      { startLine: 1, endLine: 3, lineCount: 3 },
      { startLine: 5, endLine: 7, lineCount: 3 },
    ]);
  });

  it("flags a run that is still open at end of file", () => {
    expect(js(["const x = 1;", "// a", "// b", "// c"])).toEqual([
      { startLine: 2, endLine: 4, lineCount: 3 },
    ]);
  });

  it("flags an unterminated block comment at end of file", () => {
    expect(js(["/* a", "b", "c"])).toEqual([{ startLine: 1, endLine: 3, lineCount: 3 }]);
  });

  it("returns nothing for a file with no comments", () => {
    expect(js(["const x = 1;", "const y = 2;"])).toEqual([]);
  });
});

describe("collectFiles", () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "collect-files-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("finds files matching the given extensions at the top level", () => {
    writeFileSync(join(dir, "a.js"), "");
    writeFileSync(join(dir, "b.txt"), "");

    expect(collectFiles(dir, [".js"])).toEqual([join(dir, "a.js")]);
  });

  it("recurses into subdirectories", () => {
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "nested", "c.mjs"), "");

    expect(collectFiles(dir, [".mjs"])).toEqual([join(dir, "nested", "c.mjs")]);
  });

  it("skips node_modules entirely", () => {
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "d.js"), "");
    writeFileSync(join(dir, "e.js"), "");

    expect(collectFiles(dir, [".js"])).toEqual([join(dir, "e.js")]);
  });

  it("matches any of several extensions", () => {
    writeFileSync(join(dir, "f.yml"), "");
    writeFileSync(join(dir, "g.yaml"), "");
    writeFileSync(join(dir, "h.txt"), "");

    expect(collectFiles(dir, [".yml", ".yaml"]).sort()).toEqual(
      [join(dir, "f.yml"), join(dir, "g.yaml")].sort(),
    );
  });

  it("returns an empty array for a directory with no matching files", () => {
    writeFileSync(join(dir, "i.txt"), "");

    expect(collectFiles(dir, [".js"])).toEqual([]);
  });
});
