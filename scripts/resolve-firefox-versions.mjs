// Resolves the 3 most recent Firefox majors (N, N-1, N-2) from Mozilla's release-history API — the
// Firefox counterpart of resolve-chrome-versions.mjs. Selection logic lives in firefox-version-selection.mjs.
import { selectLastThreeFirefoxMajors } from "../tests/installation/firefox-version-selection.mjs";

const RELEASE_HISTORY_URL =
  "https://product-details.mozilla.org/1.0/firefox_history_major_releases.json";

const response = await fetch(RELEASE_HISTORY_URL);
if (!response.ok) {
  throw new Error(`Falha ao consultar ${RELEASE_HISTORY_URL}: HTTP ${response.status}`);
}

const releaseHistory = await response.json();
const versions = selectLastThreeFirefoxMajors(releaseHistory);

if (versions.length !== 3) {
  throw new Error(
    `Esperava 3 versoes major do Firefox, encontrei ${versions.length}: ${JSON.stringify(versions)}`,
  );
}

// Consumed by the workflow step as `>> "$GITHUB_OUTPUT"`, then read back by
// installation-test-firefox-pinned's matrix via fromJson(needs.resolve-firefox-versions.outputs.versions).
console.log(`versions=${JSON.stringify(versions)}`);
