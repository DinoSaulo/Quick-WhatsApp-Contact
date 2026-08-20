import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveWithinDir } from "./installation/resolve-within-dir.mjs";

describe("resolveWithinDir", () => {
  let baseDir;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "resolve-within-dir-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("resolves a plain segment inside baseDir", () => {
    expect(resolveWithinDir(baseDir, "128.0")).toBe(resolve(baseDir, "128.0"));
  });

  it("resolves nested segments inside baseDir", () => {
    expect(resolveWithinDir(baseDir, "128.0", "firefox", "firefox")).toBe(
      resolve(baseDir, "128.0", "firefox", "firefox"),
    );
  });

  it("returns baseDir itself when called with no segments", () => {
    expect(resolveWithinDir(baseDir)).toBe(resolve(baseDir));
  });

  // The exact payload isValidFirefoxVersion()/isValidChromeVersion() are meant to reject upstream —
  // this proves the containment check would still catch it even if that first gate had a bug.
  it("rejects a path-traversal payload that escapes baseDir", () => {
    expect(() => resolveWithinDir(baseDir, "../../../../etc/cron.d/evil")).toThrow(
      /Refusing to use path outside/,
    );
  });

  // Regression guard: a naive `target.startsWith(base)` check (no separator) would wrongly let
  // this through, since ".../resolve-within-dir-abc-evil" also starts with ".../resolve-within-dir-abc".
  it("rejects a sibling directory whose name is prefixed by baseDir's name", () => {
    const evilSibling = `${baseDir}-evil`;
    expect(() => resolveWithinDir(baseDir, `..${sep}${evilSibling.split(sep).pop()}`)).toThrow(
      /Refusing to use path outside/,
    );
  });

  it("never creates anything on disk by itself", () => {
    resolveWithinDir(baseDir, "128.0", "firefox");
    expect(existsSync(resolve(baseDir, "128.0"))).toBe(false);
  });
});
