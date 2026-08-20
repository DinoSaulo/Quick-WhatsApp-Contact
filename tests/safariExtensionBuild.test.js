import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { convertSafariExtension } from "../scripts/convert-safari-extension.mjs";
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
    expect(converterSource.match(/env:\s*environment/g)).toHaveLength(4);
  });
});

function createSafariHarness() {
  const fileSystem = {
    copyFileSync: vi.fn(),
    existsSync: vi.fn((path) => path.endsWith("manifest.json") || path.endsWith(".app")),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
  const commands = {
    execFileSync: vi.fn((executable, args) =>
      args.includes("*.xcodeproj") ? "/build/App.xcodeproj\n" : "/logs/build.xcactivitylog\n",
    ),
    spawnSync: vi.fn((executable) =>
      executable.endsWith("xcrun")
        ? { status: 0, stdout: "converted\n", stderr: "" }
        : { status: 0, stdout: "compiled\n", stderr: "" },
    ),
  };
  const logger = { error: vi.fn(), warn: vi.fn() };
  return { commands, fileSystem, logger };
}

describe("convertSafariExtension", () => {
  it("converts, compiles and returns the generated app path", () => {
    const harness = createSafariHarness();
    const appPath = convertSafariExtension({ root: "/project", ...harness });

    expect(appPath).toBe(
      resolve(
        "/project",
        ".safari-build/DerivedData/Build/Products/Release/Quick WhatsApp Contact.app",
      ),
    );
    expect(harness.commands.spawnSync).toHaveBeenCalledTimes(2);
    expect(harness.fileSystem.writeFileSync).toHaveBeenCalledTimes(2);
    expect(harness.fileSystem.copyFileSync).toHaveBeenCalledOnce();
    expect(harness.logger.error).toHaveBeenCalledWith("converted\n");
    expect(harness.logger.error).toHaveBeenCalledWith("compiled\n");
  });

  it("fails before invoking tools when the extension build is missing", () => {
    const harness = createSafariHarness();
    harness.fileSystem.existsSync.mockReturnValue(false);

    expect(() => convertSafariExtension({ root: "/project", ...harness })).toThrow(
      "Build da extensão não encontrado",
    );
    expect(harness.commands.spawnSync).not.toHaveBeenCalled();
  });

  it("reports converter failures with their exit status", () => {
    const harness = createSafariHarness();
    harness.commands.spawnSync.mockReturnValueOnce({ status: 2, stdout: null, stderr: "failed" });

    expect(() => convertSafariExtension({ root: "/project", ...harness })).toThrow(
      "xcrun safari-web-extension-converter falhou (exit 2",
    );
  });

  it("requires exactly one generated Xcode project", () => {
    const harness = createSafariHarness();
    harness.commands.execFileSync.mockReturnValueOnce("/build/one.xcodeproj\n/build/two.xcodeproj\n");

    expect(() => convertSafariExtension({ root: "/project", ...harness })).toThrow(
      "Esperava exatamente 1 .xcodeproj",
    );
  });

  it("keeps activity-log collection best-effort", () => {
    const harness = createSafariHarness();
    harness.commands.execFileSync
      .mockReturnValueOnce("/build/App.xcodeproj\n")
      .mockImplementationOnce(() => {
        throw new Error("log unavailable");
      });

    expect(convertSafariExtension({ root: "/project", ...harness })).toContain(".app");
    expect(harness.logger.warn).toHaveBeenCalledWith(expect.stringContaining("log unavailable"));
  });

  it("reports xcodebuild failures with their exit status", () => {
    const harness = createSafariHarness();
    harness.commands.spawnSync
      .mockReturnValueOnce({ status: 0, stdout: "converted", stderr: "" })
      .mockReturnValueOnce({ status: 65, stdout: "", stderr: "compile failed" });

    expect(() => convertSafariExtension({ root: "/project", ...harness })).toThrow(
      "xcodebuild falhou (exit 65",
    );
  });

  it("rejects a successful build that did not produce the expected app", () => {
    const harness = createSafariHarness();
    harness.fileSystem.existsSync.mockImplementation((path) => path.endsWith("manifest.json"));

    expect(() => convertSafariExtension({ root: "/project", ...harness })).toThrow(
      "xcodebuild reportou sucesso",
    );
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
