import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidChromeVersion } from "./installation/chrome-version-validation.mjs";

const installerSource = readFileSync(
  new URL("../scripts/install-chrome-version.mjs", import.meta.url),
  "utf8",
);

describe("Chrome installer command security", () => {
  it("uses the fixed Ubuntu unzip path instead of resolving it through PATH", () => {
    expect(installerSource).toContain('const UNZIP_EXECUTABLE = "/usr/bin/unzip"');
    expect(installerSource).not.toMatch(/execFileSync\(\s*["']unzip["']/);
    expect(installerSource).toMatch(/execFileSync\(UNZIP_EXECUTABLE,/);
  });

  it("gives unzip a PATH containing only protected system directories", () => {
    expect(installerSource).toContain('PATH: "/usr/bin:/bin:/usr/sbin:/sbin"');
    expect(installerSource).toMatch(/\{ env:\s*TRUSTED_ENV \}/);
  });
});

describe("isValidChromeVersion", () => {
  it("accepts a real MAJOR.MINOR.BUILD.PATCH version", () => {
    expect(isValidChromeVersion("131.0.6778.85")).toBe(true);
  });

  it("rejects a version with too few segments", () => {
    expect(isValidChromeVersion("131.0.6778")).toBe(false);
  });

  it("rejects a version with a non-numeric segment", () => {
    expect(isValidChromeVersion("131.0.6778.85rc1")).toBe(false);
  });

  // The exact CLI-injection concern install-chrome-version.mjs's validation guards against.
  it("rejects a path-traversal payload disguised as a version", () => {
    expect(isValidChromeVersion("../../../../etc/cron.d/evil")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidChromeVersion("")).toBe(false);
  });
});
