import { describe, expect, it, vi } from "vitest";
import {
  FIREFOX_RELEASE_HISTORY_URL,
  formatFirefoxVersionsOutput,
  resolveFirefoxVersions,
  runFirefoxVersionResolver,
} from "../scripts/resolve-firefox-versions.mjs";

const releaseHistory = {
  "145.0": "2026-05-01",
  "146.0": "2026-06-01",
  "147.0": "2026-07-01",
  "148.0": "2026-08-01",
};

function successfulRequest(history = releaseHistory) {
  return vi.fn(async () => ({ ok: true, json: async () => history }));
}

describe("resolveFirefoxVersions", () => {
  it("fetches Mozilla's release history and returns the latest three majors", async () => {
    const request = successfulRequest();

    await expect(resolveFirefoxVersions({ request })).resolves.toEqual([
      "148.0",
      "147.0",
      "146.0",
    ]);
    expect(request).toHaveBeenCalledWith(FIREFOX_RELEASE_HISTORY_URL);
  });

  it("trims and appends an extra exact version", async () => {
    await expect(
      resolveFirefoxVersions({ extraVersion: " 140.0.1 ", request: successfulRequest() }),
    ).resolves.toEqual(["148.0", "147.0", "146.0", "140.0.1"]);
  });

  it.each(["", "   ", "148.0"])("does not append a blank or duplicate version: %j", async (extraVersion) => {
    await expect(
      resolveFirefoxVersions({ extraVersion, request: successfulRequest() }),
    ).resolves.toEqual(["148.0", "147.0", "146.0"]);
  });

  it("reports an unsuccessful Mozilla response", async () => {
    const request = vi.fn(async () => ({ ok: false, status: 503 }));

    await expect(resolveFirefoxVersions({ request })).rejects.toThrow(
      `Falha ao consultar ${FIREFOX_RELEASE_HISTORY_URL}: HTTP 503`,
    );
  });

  it("rejects a release history with fewer than three majors", async () => {
    const request = successfulRequest({ "147.0": "2026-07-01", "148.0": "2026-08-01" });

    await expect(resolveFirefoxVersions({ request })).rejects.toThrow(
      "Esperava 3 versoes major do Firefox, encontrei 2",
    );
  });
});

describe("Firefox version resolver output", () => {
  it("formats the GitHub Actions output", () => {
    expect(formatFirefoxVersionsOutput(["148.0", "147.0", "146.0"])).toBe(
      'versions=["148.0","147.0","146.0"]',
    );
  });

  it("logs and returns the resolved versions", async () => {
    const logger = { log: vi.fn() };

    await expect(
      runFirefoxVersionResolver({ request: successfulRequest(), logger }),
    ).resolves.toEqual(["148.0", "147.0", "146.0"]);
    expect(logger.log).toHaveBeenCalledWith('versions=["148.0","147.0","146.0"]');
  });
});
