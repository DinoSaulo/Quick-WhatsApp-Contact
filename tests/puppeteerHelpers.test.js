import { describe, expect, it, vi } from "vitest";
import {
  captureBrowserDiagnostics,
  isTransientFrameError,
  launchBrowserWithStabilityFlags,
  retryAsync,
  safeBrowserClose,
  safeEvaluate,
  safePageClose
} from "./installation/puppeteer-helpers.mjs";

describe("Puppeteer stability helpers", () => {
  it("classifies transient browser failures without retrying permanent errors", () => {
    expect(isTransientFrameError(new Error("no such frame"))).toBe(true);
    expect(isTransientFrameError(new Error("Browsing Context was destroyed"))).toBe(true);
    expect(isTransientFrameError(new Error("Permission denied"))).toBe(false);
    expect(isTransientFrameError(new Error("selector not found"))).toBe(false);
  });

  it("retries transient failures and returns the eventual result", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("no such frame"))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    await expect(
      retryAsync(operation, {
        maxAttempts: 3,
        initialDelayMs: 0,
        shouldRetry: isTransientFrameError,
        onRetry
      })
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 3);
  });

  it("does not retry permanent failures", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Permission denied"));

    await expect(
      retryAsync(operation, {
        maxAttempts: 3,
        initialDelayMs: 0,
        shouldRetry: isTransientFrameError
      })
    ).rejects.toThrow("Permission denied");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries safeEvaluate after a transient frame failure", async () => {
    const page = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error("no such frame"))
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce("value")
    };

    await expect(safeEvaluate(page, () => "value")).resolves.toBe("value");
    expect(page.evaluate).toHaveBeenCalledTimes(4);
  });

  it("adds stability defaults, preserves caller options, and deduplicates args", () => {
    const result = launchBrowserWithStabilityFlags({
      headless: true,
      args: ["--disable-gpu", "--custom-flag"]
    });

    expect(result.headless).toBe(true);
    expect(result.timeout).toBe(60_000);
    expect(result.args).toContain("--disable-dev-shm-usage");
    expect(result.args).toContain("--custom-flag");
    expect(result.args.filter((arg) => arg === "--disable-gpu")).toHaveLength(1);
    expect(result.args).not.toContain("--disable-extensions");
  });

  it("cleans up browser resources without masking close errors", async () => {
    // safeBrowserClose/safePageClose log-and-swallow close errors on purpose (best-effort
    // cleanup) — spying keeps that real console.error out of stderr while still asserting it fired.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const browser = { close: vi.fn().mockRejectedValue(new Error("already closed")) };
    const page = { close: vi.fn().mockRejectedValue(new Error("already closed")) };

    await expect(safeBrowserClose(browser)).resolves.toBeUndefined();
    await expect(safePageClose(page)).resolves.toBeUndefined();
    expect(browser.close).toHaveBeenCalledOnce();
    expect(page.close).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Error closing browser: already closed");
    expect(consoleError).toHaveBeenCalledWith("Error closing page: already closed");

    consoleError.mockRestore();
  });

  it("captures useful diagnostics and returns an error object when inspection fails", async () => {
    const browser = {
      targets: () => [{ type: () => "page" }, { type: () => "service_worker" }],
      pages: async () => [
        { url: () => "chrome-extension://test/popup.html", title: () => "Popup" }
      ]
    };

    await expect(captureBrowserDiagnostics(browser)).resolves.toMatchObject({
      totalTargets: 2,
      totalPages: 1,
      targetTypes: { page: 1, service_worker: 1 },
      pageUrls: [{ url: "chrome-extension://test/popup.html", title: "Popup" }]
    });

    await expect(captureBrowserDiagnostics({ targets: () => { throw new Error("closed"); } }))
      .resolves.toMatchObject({ error: expect.stringContaining("closed") });
  });
});
