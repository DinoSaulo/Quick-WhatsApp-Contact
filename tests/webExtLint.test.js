import { resolve } from "node:path";
import webExt from "web-ext";
import { beforeAll, describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

// Regression guard, not a rubber stamp: every entry is a warning already reviewed (see below).
// A NEW code/file pair — same sweep-plus-allow-list shape as tests/security.test.js — should fail.
const ACCEPTED_WARNINGS = new Set([
  // Firefox ignores service_worker and reads .scripts instead; both keys are declared on
  // purpose — see the Chrome MV3 test above this block in manifest.test.js.
  "BACKGROUND_SERVICE_WORKER_IGNORED|manifest.json",
  // Web Component render() pattern (CLAUDE.md): innerHTML comes from a template literal, and
  // donationModalEscaping.test.js verifies the one user-controlled template is HTML-escaped.
  "UNSAFE_VAR_ASSIGNMENT|src/onboarding/onboarding.js",
  "UNSAFE_VAR_ASSIGNMENT|src/options/donationModal.js",
  "UNSAFE_VAR_ASSIGNMENT|src/options/options.js",
  "UNSAFE_VAR_ASSIGNMENT|src/popup/ddi.js",
  "UNSAFE_VAR_ASSIGNMENT|src/popup/popup.js"
]);

let report;

beforeAll(async () => {
  report = await webExt.cmd.lint(
    { sourceDir: resolve(projectRoot, "dist/extension"), output: "none" },
    { shouldExitProgram: false }
  );
}, 60_000);

// Mirrors the AMO/addons.mozilla.org validator report categories (Security, Extension,
// Localization, Compatibility Tests) — addons-linter is that validator's modern engine.
describe("Firefox AMO validator (web-ext lint)", () => {
  it("raises no errors against the built extension", () => {
    expect(report.summary.errors).toBe(0);
  });

  it("raises no warnings beyond the reviewed allow-list above", () => {
    const unexpected = report.warnings
      .map((warning) => `${warning.code}|${warning.file}`)
      .filter((key) => !ACCEPTED_WARNINGS.has(key));

    expect([...new Set(unexpected)]).toEqual([]);
  });

  it("raises no notices", () => {
    expect(report.summary.notices).toBe(0);
  });
});
