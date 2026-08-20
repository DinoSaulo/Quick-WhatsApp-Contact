// Guards against a crafted CLI argument (e.g. "../../etc") reaching resolve()/execFileSync() in
// scripts/install-chrome-version.mjs. Pure/testable; see tests/chromeVersionValidation.test.js.

const CHROME_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

// Chrome for Testing versions are always MAJOR.MINOR.BUILD.PATCH (e.g. "131.0.6778.85").
export function isValidChromeVersion(version) {
  return CHROME_VERSION_PATTERN.test(version);
}
