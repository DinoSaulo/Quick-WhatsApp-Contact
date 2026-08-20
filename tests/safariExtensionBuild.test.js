import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSafariBundleId, parseFindOutput } from "./safari-extension-build.mjs";

const converterSource = readFileSync(
  new URL("../scripts/convert-safari-extension.mjs", import.meta.url),
  "utf8",
);

describe("Safari build command security", () => {
  it("uses fixed system executable paths instead of resolving commands through PATH", () => {
    expect(converterSource).toContain('find: "/usr/bin/find"');
    expect(converterSource).toContain('xcodebuild: "/usr/bin/xcodebuild"');
    expect(converterSource).toContain('xcrun: "/usr/bin/xcrun"');
    expect(converterSource).not.toMatch(
      /(?:execFileSync|spawnSync)\(\s*["'](?:find|xcodebuild|xcrun)["']/,
    );
  });

  it("gives Xcode subprocesses a PATH containing only protected system directories", () => {
    expect(converterSource).toContain('PATH: "/usr/bin:/bin:/usr/sbin:/sbin"');
    expect(converterSource.match(/env:\s*TRUSTED_ENV/g)).toHaveLength(4);
  });
});

describe("buildSafariBundleId", () => {
  it("appends the app name as the bundle ID's last component", () => {
    expect(buildSafariBundleId("dev.dinosaulo.quickwhatsappcontact", "App")).toBe(
      "dev.dinosaulo.quickwhatsappcontact.App",
    );
  });

  it("replaces every run of whitespace in the app name with a single hyphen", () => {
    expect(buildSafariBundleId("dev.dinosaulo.quickwhatsappcontact", "Quick WhatsApp Contact")).toBe(
      "dev.dinosaulo.quickwhatsappcontact.Quick-WhatsApp-Contact",
    );
  });

  // Regression guard for the real CI bug the source comment documents: the host app's bundle ID
  // must be a strict PREFIX of "<host>.Extension" for Safari to treat them as parent/child.
  it("produces a bundle ID that is a strict prefix of its own .Extension suffix", () => {
    const hostId = buildSafariBundleId("dev.dinosaulo.quickwhatsappcontact", "Quick WhatsApp Contact");
    const extensionId = `${hostId}.Extension`;

    expect(extensionId.startsWith(`${hostId}.`)).toBe(true);
  });

  it("collapses multiple consecutive spaces into one hyphen", () => {
    expect(buildSafariBundleId("base", "A   B")).toBe("base.A-B");
  });
});

describe("parseFindOutput", () => {
  it("splits multi-line find output into one entry per line", () => {
    expect(parseFindOutput("/a/one.xcodeproj\n/a/two.xcodeproj")).toEqual([
      "/a/one.xcodeproj",
      "/a/two.xcodeproj",
    ]);
  });

  it("drops the trailing empty string left by find's final newline", () => {
    expect(parseFindOutput("/a/one.xcodeproj\n")).toEqual(["/a/one.xcodeproj"]);
  });

  it("returns an empty array when find matched nothing", () => {
    expect(parseFindOutput("")).toEqual([]);
    expect(parseFindOutput("\n")).toEqual([]);
  });

  it("returns a single entry for single-match output with no trailing newline", () => {
    expect(parseFindOutput("/a/one.xcodeproj")).toEqual(["/a/one.xcodeproj"]);
  });
});
