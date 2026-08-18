// Picks the 3 most recent Firefox majors (N, N-1, N-2) from Mozilla's release-history API — the
// Firefox counterpart of chrome-version-selection.mjs, against a flat one-entry-per-major map (no platform filtering needed).

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

// Same numeric comparison as chrome-version-selection.mjs's compareVersions, kept as a separate
// copy — these two modules exist to be independently swappable per browser.
function compareVersions(versionA, versionB) {
  const segmentsA = versionA.split(".").map(Number);
  const segmentsB = versionB.split(".").map(Number);

  for (let i = 0; i < Math.max(segmentsA.length, segmentsB.length); i++) {
    const diff = (segmentsA[i] ?? 0) - (segmentsB[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}
