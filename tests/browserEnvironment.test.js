import { describe, expect, it, vi } from "vitest";
import {
  browserExecutableCandidates,
  createBrowserArgs,
  findBrowserExecutable,
} from "./installation/browser-environment.mjs";

describe("installation browser environment", () => {
  it("prioritizes explicitly configured browser paths", () => {
    const candidates = browserExecutableCandidates({
      platform: "linux",
      env: {
        CHROME_PATH: "/custom/chrome",
        CHROMIUM_PATH: "/custom/chromium",
        PUPPETEER_EXECUTABLE_PATH: "/custom/puppeteer-browser",
      },
    });

    expect(candidates.slice(0, 3)).toEqual([
      "/custom/chrome",
      "/custom/chromium",
      "/custom/puppeteer-browser",
    ]);
  });

  it("finds Fedora's chromium-browser executable when earlier candidates are absent", () => {
    const exists = vi.fn((candidate) => candidate === "/usr/bin/chromium-browser");

    expect(findBrowserExecutable({ platform: "linux", env: {}, exists })).toBe(
      "/usr/bin/chromium-browser",
    );
    expect(exists).toHaveBeenCalledWith("/usr/bin/google-chrome");
    expect(exists).toHaveBeenLastCalledWith("/usr/bin/chromium-browser");
  });

  it("returns undefined when no supported browser exists", () => {
    expect(
      findBrowserExecutable({
        platform: "linux",
        env: {},
        exists: () => false,
      }),
    ).toBeUndefined();
  });

  it("adds Chromium sandbox overrides only for a root container", () => {
    expect(createBrowserArgs({ isRoot: true })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ]);
    expect(createBrowserArgs({ isRoot: false })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
    ]);
  });

  it("returns a fresh argument array for every browser launch", () => {
    const first = createBrowserArgs({ isRoot: false });
    first.push("--unexpected-shared-state");

    expect(createBrowserArgs({ isRoot: false })).not.toContain(
      "--unexpected-shared-state",
    );
  });
});
