import { describe, expect, it, vi } from "vitest";
import {
  readFirefoxVersion,
  reportFirefoxVersion,
  verifyFirefoxVersion,
} from "../scripts/verify-firefox-version.mjs";

describe("readFirefoxVersion", () => {
  it("reads the version directly from an absolute browser path on Unix", () => {
    const execute = vi.fn(() => "Mozilla Firefox 148.0\n");

    expect(readFirefoxVersion("/usr/bin/firefox", { platform: "linux", execute })).toBe(
      "Mozilla Firefox 148.0",
    );
    expect(execute).toHaveBeenCalledWith("/usr/bin/firefox", ["--version"], {
      encoding: "utf8",
    });
  });

  it("uses a fixed PowerShell path and a trusted PATH on Windows", () => {
    const execute = vi.fn(() => "148.0.1.0\r\n");
    const firefoxPath = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";

    expect(readFirefoxVersion(firefoxPath, { platform: "win32", execute })).toBe("148.0.1.0");
    const [powershellPath, args, options] = execute.mock.calls[0];
    expect(powershellPath).toBe(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    );
    expect(args).toHaveLength(4);
    expect(args[3]).toContain(`'${firefoxPath}'`);
    expect(options.env.PATH).toBe(
      "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem;" +
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0",
    );
  });

  it("escapes a single quote in the executable path", () => {
    const execute = vi.fn(() => "148.0.1.0\r\n");

    readFirefoxVersion("C:\\Users\\o'brien\\firefox.exe", { platform: "win32", execute });

    const [, args] = execute.mock.calls[0];
    expect(args[3]).toContain("o''brien");
  });

  it("rejects relative executable paths", () => {
    expect(() => readFirefoxVersion("firefox", { platform: "linux" })).toThrow(
      "Firefox executable path must be absolute",
    );
  });
});

describe("verifyFirefoxVersion", () => {
  it.each([undefined, "", "148beta"])("rejects an invalid expected major: %s", (expectedMajor) => {
    const result = verifyFirefoxVersion({ expectedMajor });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Usage:");
  });

  it("reports when Firefox cannot be found", () => {
    const result = verifyFirefoxVersion({ expectedMajor: "148", findExecutable: () => undefined });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Nenhum executavel");
  });

  it("rejects a relative path returned by browser discovery", () => {
    const result = verifyFirefoxVersion({
      expectedMajor: "148",
      platform: "linux",
      findExecutable: () => "firefox",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("deve ser absoluto");
  });

  it("accepts the expected major and returns a summary", () => {
    const result = verifyFirefoxVersion({
      expectedMajor: "148",
      platform: "linux",
      findExecutable: () => "/usr/bin/firefox",
      execute: () => "Mozilla Firefox 148.0",
    });

    expect(result).toMatchObject({ ok: true, actualMajor: "148" });
    expect(result.summary).toContain("major 148, esperado 148");
  });

  it("reports a different installed major", () => {
    const result = verifyFirefoxVersion({
      expectedMajor: "148",
      platform: "linux",
      findExecutable: () => "/usr/bin/firefox",
      execute: () => "Mozilla Firefox 147.0",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("esperado 148, encontrado 147");
  });

  it("reports version output without a major number", () => {
    const result = verifyFirefoxVersion({
      expectedMajor: "148",
      platform: "linux",
      findExecutable: () => "/usr/bin/firefox",
      execute: () => "unknown",
    });

    expect(result.actualMajor).toBe("");
    expect(result.summary).toContain("major desconhecido");
    expect(result.error).toContain("encontrado nenhum");
  });
});

describe("reportFirefoxVersion", () => {
  it("logs successful summaries without changing the exit code", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(reportFirefoxVersion({ ok: true, summary: "installed" }, { logger, runtime })).toBe(true);
    expect(logger.log).toHaveBeenCalledWith("installed");
    expect(runtime.exitCode).toBeUndefined();
  });

  it("logs failures and sets a failing exit code", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(
      reportFirefoxVersion(
        { ok: false, summary: "installed", error: "mismatch" },
        { logger, runtime },
      ),
    ).toBe(false);
    expect(logger.error).toHaveBeenCalledWith("mismatch");
    expect(runtime.exitCode).toBe(1);
  });
});
