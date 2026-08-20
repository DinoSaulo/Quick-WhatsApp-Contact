import { describe, expect, it, vi } from "vitest";
import {
  CHROME_KNOWN_GOOD_VERSIONS_URL,
  formatChromeVersionsOutput,
  resolveChromeVersions,
  runChromeVersionResolver,
} from "../scripts/resolve-chrome-versions.mjs";

function versionEntry(version, platforms = ["linux64"]) {
  return {
    version,
    downloads: {
      chrome: platforms.map((platform) => ({ platform, url: `https://example.test/${version}` })),
    },
  };
}

const versionsData = {
  versions: [
    versionEntry("148.0.1.0"),
    versionEntry("149.0.1.0"),
    versionEntry("150.0.1.0"),
    versionEntry("151.0.1.0"),
  ],
};

function successfulRequest(data = versionsData) {
  return vi.fn(async () => ({ ok: true, json: async () => data }));
}

describe("resolveChromeVersions", () => {
  it("fetches the known-good catalog and returns the latest three majors", async () => {
    const request = successfulRequest();

    await expect(resolveChromeVersions({ request })).resolves.toEqual([
      "151.0.1.0",
      "150.0.1.0",
      "149.0.1.0",
    ]);
    expect(request).toHaveBeenCalledWith(CHROME_KNOWN_GOOD_VERSIONS_URL);
  });

  it("trims and appends an extra exact version", async () => {
    await expect(
      resolveChromeVersions({ extraVersion: " 140.0.1.2 ", request: successfulRequest() }),
    ).resolves.toEqual(["151.0.1.0", "150.0.1.0", "149.0.1.0", "140.0.1.2"]);
  });

  it.each(["", "   ", "151.0.1.0"])(
    "does not append a blank or duplicate version: %j",
    async (extraVersion) => {
      await expect(
        resolveChromeVersions({ extraVersion, request: successfulRequest() }),
      ).resolves.toEqual(["151.0.1.0", "150.0.1.0", "149.0.1.0"]);
    },
  );

  it("reports an unsuccessful catalog response", async () => {
    const request = vi.fn(async () => ({ ok: false, status: 503 }));

    await expect(resolveChromeVersions({ request })).rejects.toThrow(
      `Falha ao consultar ${CHROME_KNOWN_GOOD_VERSIONS_URL}: HTTP 503`,
    );
  });

  it("rejects a catalog with fewer than three supported majors", async () => {
    const request = successfulRequest({
      versions: [versionEntry("150.0.1.0"), versionEntry("151.0.1.0")],
    });

    await expect(resolveChromeVersions({ request })).rejects.toThrow(
      "Esperava 3 versoes major do Chrome, encontrei 2",
    );
  });
});

describe("Chrome version resolver output", () => {
  it("formats the GitHub Actions output", () => {
    expect(formatChromeVersionsOutput(["151.0.1.0", "150.0.1.0", "149.0.1.0"])).toBe(
      'versions=["151.0.1.0","150.0.1.0","149.0.1.0"]',
    );
  });

  it("logs and returns the resolved versions", async () => {
    const logger = { log: vi.fn() };

    await expect(
      runChromeVersionResolver({ request: successfulRequest(), logger }),
    ).resolves.toEqual(["151.0.1.0", "150.0.1.0", "149.0.1.0"]);
    expect(logger.log).toHaveBeenCalledWith(
      'versions=["151.0.1.0","150.0.1.0","149.0.1.0"]',
    );
  });
});
