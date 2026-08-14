// Picks the 3 most recent Firefox *major* versions (N, N-1, N-2) from Mozilla's own release
// history, so scripts/resolve-firefox-versions.mjs can feed
// installation-test-firefox-pinned's matrix — same role as
// tests/installation/chrome-version-selection.mjs plays for Chrome, but against a differently
// shaped source: https://product-details.mozilla.org/1.0/firefox_history_major_releases.json is
// a flat { "121.0": "2023-12-19", ... } map (one entry per major already, confirmed by
// inspection — no per-major "pick the newest patch" step is strictly needed), and unlike Chrome
// for Testing there's no per-version platform-availability metadata to filter on: Mozilla's
// archive (archive.mozilla.org/pub/firefox/releases/<version>/linux-x86_64/en-US/) predictably
// hosts a linux64 build for every stable release this history file lists.

export function selectLastThreeFirefoxMajors(releaseHistory, { count = 3 } = {}) {
  const newestVersionByMajor = new Map();

  for (const version of Object.keys(releaseHistory)) {
    const major = Number(version.split(".")[0]);
    if (!Number.isInteger(major)) continue;

    const currentBest = newestVersionByMajor.get(major);
    if (!currentBest || compareVersions(version, currentBest) > 0) {
      newestVersionByMajor.set(major, version);
    }
  }

  return [...newestVersionByMajor.keys()]
    .sort((a, b) => b - a)
    .slice(0, count)
    .map((major) => newestVersionByMajor.get(major));
}

// Same numeric, segment-by-segment comparison as chrome-version-selection.mjs's compareVersions
// (kept as a separate copy rather than a shared import — these two modules only exist to be
// independently swappable per browser, and the comparison itself is a few lines either way).
function compareVersions(versionA, versionB) {
  const segmentsA = versionA.split(".").map(Number);
  const segmentsB = versionB.split(".").map(Number);

  for (let i = 0; i < Math.max(segmentsA.length, segmentsB.length); i++) {
    const diff = (segmentsA[i] ?? 0) - (segmentsB[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}
