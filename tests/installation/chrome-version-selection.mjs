// Picks the Chrome for Testing (CfT) build that .github/workflows/ci.yml's
// installation-test-pinned matrix pins each entry to, so the extension's install/uninstall
// lifecycle (tests/installation/extension-install.mjs) is deliberately exercised against the
// last three *major* Chrome versions (N, N-1, N-2) instead of whatever an OS package manager
// happens to ship that week (see installation-test's Fedora/Debian/Rocky/Arch entries, which
// stay focused on package-manager diversity instead). Lives next to browser-environment.mjs
// because both are pure, independently-testable helpers a thin scripts/ CLI
// (resolve-chrome-versions.mjs, install-chrome-version.mjs) wraps with the actual network/file
// I/O — see tests/chromeVersionSelection.test.js for the fixtures this is exercised against.

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

// Compares two "a.b.c.d" version strings numerically, segment by segment — a plain string/array
// sort would get this wrong (e.g. "9" > "54" lexicographically, even though 54 is the newer
// patch), see tests/chromeVersionSelection.test.js for the fixture that pins this down.
function compareVersions(versionA, versionB) {
  const segmentsA = versionA.split(".").map(Number);
  const segmentsB = versionB.split(".").map(Number);

  for (let i = 0; i < Math.max(segmentsA.length, segmentsB.length); i++) {
    const diff = (segmentsA[i] ?? 0) - (segmentsB[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}
