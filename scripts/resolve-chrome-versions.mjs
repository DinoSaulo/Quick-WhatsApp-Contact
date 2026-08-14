// Resolves the three most recent Chrome *major* versions (N, N-1, N-2) that Google's Chrome for
// Testing (CfT) project has a downloadable linux64 build for, so .github/workflows/ci.yml can pin
// installation-test-pinned's matrix to each one deliberately, instead of testing whatever major an
// OS/distro package manager happens to ship that week (see the plain installation-test job).
// Source of truth: https://googlechromelabs.github.io/chrome-for-testing, the same catalog
// Google's own @puppeteer/browsers CLI reads from. Grouping/selection logic lives in
// tests/installation/chrome-version-selection.mjs so it's unit-testable against fixture data
// instead of only ever running against the live network (see tests/chromeVersionSelection.test.js).
import { selectLastThreeMajors } from "../tests/installation/chrome-version-selection.mjs";

const KNOWN_GOOD_VERSIONS_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";

const response = await fetch(KNOWN_GOOD_VERSIONS_URL);
if (!response.ok) {
  throw new Error(`Falha ao consultar ${KNOWN_GOOD_VERSIONS_URL}: HTTP ${response.status}`);
}

const versionsData = await response.json();
const versions = selectLastThreeMajors(versionsData);

if (versions.length !== 3) {
  throw new Error(
    `Esperava 3 versoes major do Chrome, encontrei ${versions.length}: ${JSON.stringify(versions)}`,
  );
}

// Consumed by the workflow step as `>> "$GITHUB_OUTPUT"`, then read back by
// installation-test-pinned's matrix via fromJson(needs.resolve-chrome-versions.outputs.versions).
console.log(`versions=${JSON.stringify(versions)}`);
