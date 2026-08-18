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

  it("adds Chromium sandbox overrides for a root container", () => {
    // isCI/isLinux are pinned explicitly: leaving either ambient (defaulted from process.env/platform)
    // made this test's outcome depend on where it ran instead of the isRoot behavior it verifies.
    expect(createBrowserArgs({ isRoot: true, isLinux: false, isCI: false })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ]);
    expect(createBrowserArgs({ isRoot: false, isLinux: false, isCI: false })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ]);
  });

  it("adds Chromium sandbox overrides on Linux even without root", () => {
    // Confirmed root cause of a real installation-test-pinned failure: a non-root bare ubuntu-latest
    // runner with a manually-downloaded Chrome hits the same AppArmor restriction as the Firefox fix.
    expect(createBrowserArgs({ isRoot: false, isLinux: true, isCI: false })).toEqual([
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ]);
    expect(createBrowserArgs({ isRoot: false, isLinux: false, isCI: false })).not.toContain(
      "--no-sandbox",
    );
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
    // --disable-extensions has no "re-enable" counterpart, so its mere presence silently defeats
    // enableExtensions: true — already a real confirmed regression once (reintroduced via CI_STABILITY_FLAGS).
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
