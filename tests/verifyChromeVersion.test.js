import { describe, expect, it, vi } from "vitest";
import {
  readChromeVersion,
  reportChromeVersion,
  verifyChromeVersion,
} from "../scripts/verify-chrome-version.mjs";

describe("readChromeVersion", () => {
  it("reads the version directly from an absolute browser path on Unix", () => {
    const execute = vi.fn(() => "Google Chrome 151.0.1\n");

    expect(readChromeVersion("/usr/bin/google-chrome", { platform: "linux", execute })).toBe(
      "Google Chrome 151.0.1",
    );
    expect(execute).toHaveBeenCalledWith(
      "/usr/bin/google-chrome",
      ["--version"],
      { encoding: "utf8" },
    );
  });

  it("uses a fixed PowerShell path and passes the browser path as a separate argument", () => {
    const execute = vi.fn(() => "151.0.1.0\r\n");
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

    expect(readChromeVersion(chromePath, { platform: "win32", execute })).toBe("151.0.1.0");
    const [powershellPath, args, options] = execute.mock.calls[0];
    expect(powershellPath).toBe(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    );
    expect(args.at(-1)).toBe(chromePath);
    expect(args[3]).not.toContain(chromePath);
    expect(options.env.PATH).toBe(
      "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem;" +
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0",
    );
  });

  it("rejects relative executable paths", () => {
    expect(() => readChromeVersion("google-chrome", { platform: "linux" })).toThrow(
      "Chrome executable path must be absolute",
    );
  });
});

describe("verifyChromeVersion", () => {
  it.each([undefined, "", "151beta"])("rejects an invalid expected major: %s", (expectedMajor) => {
    const result = verifyChromeVersion({ expectedMajor });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Usage:");
  });

  it("reports when no supported browser can be found", () => {
    const result = verifyChromeVersion({ expectedMajor: "151", findExecutable: () => undefined });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Nenhum executavel");
  });

  it("rejects a relative path returned by browser discovery", () => {
    const result = verifyChromeVersion({
      expectedMajor: "151",
      platform: "linux",
      findExecutable: () => "google-chrome",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("deve ser absoluto");
  });

  it("accepts the expected major and returns a human-readable summary", () => {
    const result = verifyChromeVersion({
      expectedMajor: "151",
      platform: "linux",
      findExecutable: () => "/usr/bin/google-chrome",
      execute: () => "Google Chrome 151.0.1234.0",
    });

    expect(result).toMatchObject({ ok: true, actualMajor: "151" });
    expect(result.summary).toContain("major 151, esperado 151");
  });

  it("reports a different installed major", () => {
    const result = verifyChromeVersion({
      expectedMajor: "151",
      platform: "linux",
      findExecutable: () => "/usr/bin/google-chrome",
      execute: () => "Google Chrome 150.0.0.0",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("esperado 151, encontrado 150");
  });

  it("reports version output that contains no major number", () => {
    const result = verifyChromeVersion({
      expectedMajor: "151",
      platform: "linux",
      findExecutable: () => "/usr/bin/google-chrome",
      execute: () => "unknown",
    });

    expect(result.actualMajor).toBe("");
    expect(result.summary).toContain("major desconhecido");
    expect(result.error).toContain("encontrado nenhum");
  });
});

describe("reportChromeVersion", () => {
  it("logs successful summaries without changing the exit code", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(reportChromeVersion({ ok: true, summary: "installed" }, { logger, runtime })).toBe(true);
    expect(logger.log).toHaveBeenCalledWith("installed");
    expect(runtime.exitCode).toBeUndefined();
  });

  it("logs failures and sets a failing exit code", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(
      reportChromeVersion(
        { ok: false, summary: "installed", error: "mismatch" },
        { logger, runtime },
      ),
    ).toBe(false);
    expect(logger.error).toHaveBeenCalledWith("mismatch");
    expect(runtime.exitCode).toBe(1);
  });
});
