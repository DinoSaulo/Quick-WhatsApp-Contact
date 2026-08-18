// Resolves the 3 most recent Chrome for Testing majors (N, N-1, N-2) so ci.yml's installation-test-pinned
// matrix can pin to each deliberately. Selection logic lives in chrome-version-selection.mjs (unit-testable).
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
