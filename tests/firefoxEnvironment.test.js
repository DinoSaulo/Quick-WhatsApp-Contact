import { describe, expect, it } from "vitest";
import {
  firefoxExecutableCandidates,
  findFirefoxExecutable,
  getAvailablePort,
} from "./installation/firefox-environment.mjs";

describe("installation Firefox environment", () => {
  it("prioritizes an explicitly configured browser path", () => {
    const candidates = firefoxExecutableCandidates({
      platform: "linux",
      env: {
        FIREFOX_PATH: "/custom/firefox",
        PUPPETEER_EXECUTABLE_PATH: "/custom/puppeteer-browser",
      },
    });

    expect(candidates.slice(0, 2)).toEqual(["/custom/firefox", "/custom/puppeteer-browser"]);
  });

  it("finds Debian/Ubuntu's firefox-esr executable when plain firefox is absent", () => {
    const exists = (candidate) => candidate === "/usr/bin/firefox-esr";

    expect(findFirefoxExecutable({ platform: "linux", env: {}, exists })).toBe(
      "/usr/bin/firefox-esr",
    );
  });

  it("returns undefined when no supported browser exists", () => {
    expect(
      findFirefoxExecutable({ platform: "linux", env: {}, exists: () => false }),
    ).toBeUndefined();
  });

  it("resolves a free, listening TCP port on localhost", async () => {
    const port = await getAvailablePort();

    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
  });

  it("resolves a different port on each call (no stale reservation)", async () => {
    const [first, second] = await Promise.all([getAvailablePort(), getAvailablePort()]);

    expect(first).not.toBe(second);
  });
});
