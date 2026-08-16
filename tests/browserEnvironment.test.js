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
    // isCI is pinned explicitly here: createBrowserArgs() defaults it from the real
    // process.env.CI/GITHUB_ACTIONS, and GitHub Actions sets those on every job. Leaving it
    // ambient made this test's outcome depend on where it ran (passing on a dev machine, failing
    // in CI) instead of on the isRoot behavior it's actually meant to verify.
    expect(createBrowserArgs({ isRoot: true, isCI: false })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ]);
    expect(createBrowserArgs({ isRoot: false, isCI: false })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ]);
  });

  it("adds CI stability flags only when running in CI", () => {
    const args = createBrowserArgs({ isRoot: false, isCI: true });

    expect(args).toEqual(
      expect.arrayContaining([
        "--disable-background-networking",
        "--enable-features=NetworkService,NetworkServiceInProcess",
      ]),
    );
    expect(createBrowserArgs({ isRoot: false, isCI: false })).not.toContain(
      "--disable-background-networking",
    );
  });

  it("never adds --disable-extensions, in CI or not", () => {
    // extension-install.mjs always launches with enableExtensions: true specifically to load and
    // test our own extension. --disable-extensions has no "re-enable" counterpart a later flag
    // can undo, so its mere presence anywhere on the command line silently defeats
    // enableExtensions — the extension "installs" (Puppeteer's CDP bookkeeping doesn't check
    // whether Chrome actually loaded it) but its service worker never starts, and
    // browser.waitForTarget() for it times out. This exact flag was accidentally reintroduced
    // once already via this file's CI_STABILITY_FLAGS after being removed from
    // puppeteer-helpers.mjs's separate copy — a real, confirmed CI regression, not a hypothetical.
    expect(createBrowserArgs({ isRoot: true, isCI: true })).not.toContain("--disable-extensions");
    expect(createBrowserArgs({ isRoot: false, isCI: true })).not.toContain("--disable-extensions");
  });

  it("returns a fresh argument array for every browser launch", () => {
    const first = createBrowserArgs({ isRoot: false, isCI: false });
    first.push("--unexpected-shared-state");

    expect(createBrowserArgs({ isRoot: false, isCI: false })).not.toContain(
      "--unexpected-shared-state",
    );
  });
});
