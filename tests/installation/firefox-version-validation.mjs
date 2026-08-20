// Guards against a crafted CLI argument (e.g. "../../etc") reaching resolve()/execFileSync() in
// scripts/install-firefox-version.mjs. Pure/testable; see tests/firefoxVersionValidation.test.js.

const FIREFOX_VERSION_PATTERN = /^\d+\.\d+(\.\d+)?(esr)?$/;

// Real Firefox release versions look like "128.0"/"128.0.1" (rapid release) or "115.0esr" (ESR —
// see resolve-firefox-versions.mjs's extra_firefox_version input, which can target either train).
export function isValidFirefoxVersion(version) {
  return FIREFOX_VERSION_PATTERN.test(version);
}
