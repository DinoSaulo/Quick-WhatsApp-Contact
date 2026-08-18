// Picks the Chrome for Testing build ci.yml's installation-test-pinned matrix pins to (last 3
// majors, not whatever the OS package manager ships). Pure/testable; scripts/resolve-chrome-versions.mjs wraps the real network I/O.

export function selectLastThreeMajors(versionsData, { platform = "linux64", count = 3 } = {}) {
  const newestPatchByMajor = new Map();

  for (const entry of versionsData.versions) {
    const hasPlatformBuild = entry.downloads?.chrome?.some(
      (download) => download.platform === platform,
    );
    if (!hasPlatformBuild) continue;

    const major = Number(entry.version.split(".")[0]);
    const currentBest = newestPatchByMajor.get(major);

    if (!currentBest || compareVersions(entry.version, currentBest) > 0) {
      newestPatchByMajor.set(major, entry.version);
    }
  }

  return [...newestPatchByMajor.keys()]
    .sort((a, b) => b - a)
    .slice(0, count)
    .map((major) => newestPatchByMajor.get(major));
}

// Compares two "a.b.c.d" version strings numerically, segment by segment — a plain string sort
// would get "9" > "54" wrong. See tests/chromeVersionSelection.test.js.
function compareVersions(versionA, versionB) {
  const segmentsA = versionA.split(".").map(Number);
  const segmentsB = versionB.split(".").map(Number);

  for (let i = 0; i < Math.max(segmentsA.length, segmentsB.length); i++) {
    const diff = (segmentsA[i] ?? 0) - (segmentsB[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}
