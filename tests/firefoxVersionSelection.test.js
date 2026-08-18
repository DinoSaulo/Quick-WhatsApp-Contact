import { describe, expect, it } from "vitest";
import { selectLastThreeFirefoxMajors } from "./installation/firefox-version-selection.mjs";

describe("selectLastThreeFirefoxMajors", () => {
  it("returns the 3 most recent majors, newest first", () => {
    const releaseHistory = {
      "1.0": "2004-11-09",
      "120.0": "2023-11-21",
      "121.0": "2023-12-19",
      "122.0": "2024-01-23",
    };

    expect(selectLastThreeFirefoxMajors(releaseHistory)).toEqual(["122.0", "121.0", "120.0"]);
  });

  it("keeps the numerically newest entry when a major appears more than once", () => {
    // The picker stays defensive even though the live file has one key per major — same
    // numeric-not-lexicographic concern as chromeVersionSelection.test.js ("9" must not beat "54").
    const releaseHistory = {
      "120.0": "2023-11-21",
      "121.0": "2023-12-19",
      "121.9": "2024-01-01",
      "121.54": "2024-06-01",
    };

    expect(selectLastThreeFirefoxMajors(releaseHistory, { count: 1 })).toEqual(["121.54"]);
  });

  it("respects a custom count", () => {
    const releaseHistory = {
      "120.0": "2023-11-21",
      "121.0": "2023-12-19",
      "122.0": "2024-01-23",
    };

    expect(selectLastThreeFirefoxMajors(releaseHistory, { count: 2 })).toEqual([
      "122.0",
      "121.0",
    ]);
  });
});
