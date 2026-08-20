import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildExtension } from "../scripts/build-extension.mjs";
import { COUNTRIES, getTwemojiAssetName } from "../src/utils/countries.js";

// Mirrors the script's own emojiAssets Set so this stays correct if COUNTRIES ever changes,
// instead of hardcoding today's count.
const EXPECTED_EMOJI_COUNT = new Set([
  getTwemojiAssetName("🌐"),
  getTwemojiAssetName("🏳"),
  ...COUNTRIES.map((country) => getTwemojiAssetName(country.flag))
]).size;

function createBuildHarness(manifest) {
  const manifestJson = JSON.stringify(
    manifest ?? {
      version: "9.9.9",
      background: { service_worker: "src/background.js", scripts: ["src/background.js"], type: "module" }
    }
  );
  return {
    cpSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => manifestJson),
    rmSync: vi.fn(),
    writeFileSync: vi.fn()
  };
}

function writtenContentFor(fileSystem, suffix) {
  const call = fileSystem.writeFileSync.mock.calls.find(([path]) => path.endsWith(suffix));
  return call?.[1];
}

describe("buildExtension", () => {
  it("builds the Chrome target by default, keeping the service worker key", () => {
    const fileSystem = createBuildHarness();

    const result = buildExtension({ root: "/project", argv: [], fileSystem });

    expect(result).toEqual({
      outputRoot: resolve("/project", "dist", "extension"),
      manifestVersion: "9.9.9",
      emojiAssetsCount: EXPECTED_EMOJI_COUNT
    });
    expect(JSON.parse(writtenContentFor(fileSystem, "manifest.json")).background.service_worker).toBe(
      "src/background.js"
    );
  });

  it("strips background.service_worker/type for the Firefox target", () => {
    const fileSystem = createBuildHarness();

    buildExtension({ root: "/project", argv: ["--firefox"], fileSystem });

    const writtenManifest = JSON.parse(writtenContentFor(fileSystem, "manifest.json"));
    expect(writtenManifest.background.service_worker).toBeUndefined();
    expect(writtenManifest.background.type).toBeUndefined();
    expect(writtenManifest.background.scripts).toEqual(["src/background.js"]);
  });

  it("records the build target and an injected timestamp in BUILD_INFO.txt", () => {
    const fileSystem = createBuildHarness();
    const fixedDate = new Date("2026-01-01T00:00:00.000Z");

    buildExtension({ root: "/project", argv: ["--firefox"], fileSystem, now: () => fixedDate });

    expect(writtenContentFor(fileSystem, "BUILD_INFO.txt")).toBe(
      "Quick WhatsApp Contact 9.9.9\nTarget: firefox\nBuilt at 2026-01-01T00:00:00.000Z\n"
    );
  });

  it("copies every Twemoji asset used by COUNTRIES plus the globe and white-flag fallbacks", () => {
    const fileSystem = createBuildHarness();
    const twemojiSourceDir = resolve("/project", "node_modules", "@twemoji", "svg");

    buildExtension({ root: "/project", argv: [], fileSystem });

    const twemojiCopyCalls = fileSystem.cpSync.mock.calls.filter(([source]) =>
      source.startsWith(twemojiSourceDir)
    );
    expect(twemojiCopyCalls).toHaveLength(EXPECTED_EMOJI_COUNT * 2);
  });

  it("copies optional static asset directories only when they exist", () => {
    const fileSystem = createBuildHarness();
    fileSystem.existsSync.mockImplementation((path) => !path.endsWith("donation-qrcodes"));

    buildExtension({ root: "/project", argv: [], fileSystem });

    const copiedStaticDirs = fileSystem.cpSync.mock.calls
      .map(([source]) => source)
      .filter((source) => source.endsWith("donation-qrcodes") || source.endsWith("onboarding"));
    expect(copiedStaticDirs).toEqual([resolve("/project", "assets", "onboarding")]);
  });

  it("wipes and recreates dist/ before writing anything into it", () => {
    const fileSystem = createBuildHarness();

    buildExtension({ root: "/project", argv: [], fileSystem });

    expect(fileSystem.rmSync).toHaveBeenCalledWith(resolve("/project", "dist"), {
      recursive: true,
      force: true
    });
    expect(fileSystem.mkdirSync).toHaveBeenCalledWith(resolve("/project", "dist", "extension"), {
      recursive: true
    });
  });
});
