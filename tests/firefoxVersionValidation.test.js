import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidFirefoxVersion } from "./installation/firefox-version-validation.mjs";

const installerSource = readFileSync(
  new URL("../scripts/install-firefox-version.mjs", import.meta.url),
  "utf8",
);

describe("Firefox installer command security", () => {
  it("uses the fixed Ubuntu tar path instead of resolving it through PATH", () => {
    expect(installerSource).toContain('const TAR_EXECUTABLE = "/usr/bin/tar"');
    expect(installerSource).not.toMatch(/execFileSync\(\s*["']tar["']/);
    expect(installerSource).toMatch(/execFileSync\(TAR_EXECUTABLE,/);
  });

  it("gives tar a PATH containing only protected system directories", () => {
    expect(installerSource).toContain('PATH: "/usr/bin:/bin:/usr/sbin:/sbin"');
    expect(installerSource).toMatch(/\{ env:\s*TRUSTED_ENV \}/);
  });
});

describe("isValidFirefoxVersion", () => {
  it("accepts a rapid-release MAJOR.MINOR version", () => {
    expect(isValidFirefoxVersion("152.0")).toBe(true);
  });

  it("accepts a rapid-release MAJOR.MINOR.PATCH version", () => {
    expect(isValidFirefoxVersion("128.0.1")).toBe(true);
  });

  it("accepts an ESR version", () => {
    expect(isValidFirefoxVersion("115.0esr")).toBe(true);
  });

  it("rejects a version with a non-numeric segment", () => {
    expect(isValidFirefoxVersion("128.0.1rc1")).toBe(false);
  });

  // The exact CLI-injection concern install-firefox-version.mjs's validation guards against.
  it("rejects a path-traversal payload disguised as a version", () => {
    expect(isValidFirefoxVersion("../../../../etc/cron.d/evil")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidFirefoxVersion("")).toBe(false);
  });
});
