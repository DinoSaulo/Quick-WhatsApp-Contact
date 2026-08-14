import { describe, expect, it } from "vitest";
import { selectLastThreeMajors } from "./installation/chrome-version-selection.mjs";

function versionEntry(version, { platforms = ["linux64", "mac-x64", "win64"] } = {}) {
  return {
    version,
    downloads: {
      chrome: platforms.map((platform) => ({
        platform,
        url: `https://example.test/${platform}/${version}/chrome-${platform}.zip`,
      })),
    },
  };
}

describe("selectLastThreeMajors", () => {
  it("returns the newest patch of each of the 3 most recent majors, newest major first", () => {
    const versionsData = {
      versions: [
        versionEntry("139.0.7258.66"),
        versionEntry("139.0.7258.154"),
        versionEntry("140.0.7339.9"),
        // Numeric, not lexicographic: "54" must beat "9" even though "9" sorts after "5" as a
        // plain string comparison would have it.
        versionEntry("140.0.7339.54"),
        versionEntry("141.0.7390.54"),
        versionEntry("138.0.7204.100"),
      ],
    };

    expect(selectLastThreeMajors(versionsData)).toEqual([
      "141.0.7390.54",
      "140.0.7339.54",
      "139.0.7258.154",
    ]);
  });

  it("skips a major whose only patch(es) have no build for the requested platform", () => {
    const versionsData = {
      versions: [
        versionEntry("139.0.7258.154"),
        // 140's only patch has no linux64 build — 140 must be skipped entirely rather than
        // resolved to a version nothing can actually download.
        versionEntry("140.0.7339.54", { platforms: ["mac-x64", "win64"] }),
        versionEntry("141.0.7390.54"),
        versionEntry("138.0.7204.100"),
      ],
    };

    expect(selectLastThreeMajors(versionsData)).toEqual([
      "141.0.7390.54",
      "139.0.7258.154",
      "138.0.7204.100",
    ]);
  });

  it("respects a custom platform and count", () => {
    const versionsData = {
      versions: [
        versionEntry("139.0.7258.154", { platforms: ["win64"] }),
        versionEntry("140.0.7339.54", { platforms: ["win64"] }),
      ],
    };

    expect(selectLastThreeMajors(versionsData, { platform: "win64", count: 2 })).toEqual([
      "140.0.7339.54",
      "139.0.7258.154",
    ]);
  });
});
