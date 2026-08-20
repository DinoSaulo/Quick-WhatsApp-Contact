import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectRuntimeFiles,
  hasExpectedOptionalHostPermissions,
  reportExtensionValidation,
  validateExtension,
} from "../scripts/validate-extension.mjs";

function validManifest() {
  return {
    manifest_version: 3,
    background: { service_worker: "src/background.js" },
    permissions: ["contextMenus"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
    action: {
      default_popup: "src/popup.html",
      default_icon: { 16: "icons/icon16.png" },
    },
    options_ui: { page: "src/options.html" },
    icons: { 128: "icons/icon128.png" },
    web_accessible_resources: [{ resources: ["assets/*.svg"] }, {}],
  };
}

describe("validateExtension", () => {
  it("validates the exact optional host permission set regardless of order", () => {
    expect(hasExpectedOptionalHostPermissions(["http://*/*", "https://*/*"])).toBe(true);
    expect(hasExpectedOptionalHostPermissions(["https://*/*", "http://*/*"])).toBe(true);
  });

  it("rejects incomplete, duplicated, extra, or malformed host permissions", () => {
    expect(hasExpectedOptionalHostPermissions(["https://*/*"])).toBe(false);
    expect(hasExpectedOptionalHostPermissions(["http://*/*", "http://*/*"])).toBe(false);
    expect(
      hasExpectedOptionalHostPermissions(["http://*/*", "https://*/*", "<all_urls>"]),
    ).toBe(false);
    expect(hasExpectedOptionalHostPermissions(undefined)).toBe(false);
  });

  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "validate-extension-"));
    mkdirSync(join(root, "src", "nested"), { recursive: true });
    mkdirSync(join(root, "icons"));
    writeFileSync(join(root, "manifest.json"), JSON.stringify(validManifest()));
    writeFileSync(join(root, "package.json"), JSON.stringify({ devDependencies: {} }));
    writeFileSync(join(root, "src", "background.js"), "export const ready = true;");
    writeFileSync(join(root, "src", "popup.html"), "<main>Safe</main>");
    writeFileSync(join(root, "src", "options.html"), "<main>Safe</main>");
    writeFileSync(join(root, "src", "nested", "helper.js"), "export const helper = true;");
    writeFileSync(join(root, "src", "nested", "ignored.txt"), "ignored");
    writeFileSync(join(root, "icons", "icon16.png"), "icon");
    writeFileSync(join(root, "icons", "icon128.png"), "icon");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("accepts a valid extension and recursively lists only runtime files", () => {
    const result = validateExtension({ root });

    expect(result.errors).toEqual([]);
    expect(result.runtimeFiles).toHaveLength(4);
    expect(result.runtimeFiles.every((file) => !file.endsWith(".txt"))).toBe(true);
    expect(collectRuntimeFiles(join(root, "src"))).toHaveLength(5);
  });

  it("reports manifest, filesystem, source and dependency violations together", () => {
    const manifest = {
      manifest_version: 2,
      background: {},
      permissions: ["tabs"],
      content_scripts: [{}],
      optional_host_permissions: ["*://*/*"],
      content_security_policy: { extension_pages: "script-src 'unsafe-eval'" },
      externally_connectable: {},
      optional_permissions: [],
      action: { default_popup: "src/missing.html" },
      web_accessible_resources: [{ resources: ["public.js"] }],
    };
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { lodash: "1.0.0" } }));
    writeFileSync(
      join(root, "src", "background.js"),
      'eval("x"); new Function("return 1"); import("https://example.com/module.js");',
    );
    writeFileSync(join(root, "src", "popup.html"), '<script src="https://example.com/app.js"></script>');

    const { errors } = validateExtension({ root });

    expect(errors).toEqual(
      expect.arrayContaining([
        "manifest_version must be 3",
        "A service worker is required",
        "The broad tabs permission is not allowed",
        "Page helpers must use optional host access",
        "Optional host permissions must be limited to HTTP and HTTPS pages",
        "Extension pages must restrict scripts to self",
        "unsafe-eval is forbidden",
        "externally_connectable would let arbitrary websites message the background service worker",
        "optional_permissions must be deliberately reviewed before being requested at runtime",
        "Manifest path does not exist: src/missing.html",
        "Executable resources must not be web accessible",
        "Runtime npm dependencies must be reviewed and bundled before release",
      ]),
    );
    expect(errors.some((error) => error.startsWith("eval found in"))).toBe(true);
    expect(errors.some((error) => error.startsWith("new Function found in"))).toBe(true);
    expect(errors.some((error) => error.startsWith("remote script found in"))).toBe(true);
    expect(errors.some((error) => error.startsWith("remote dynamic import found in"))).toBe(true);
  });

  it("reports successful and failing CLI outcomes", () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const runtime = {};

    expect(
      reportExtensionValidation({ errors: [], runtimeFiles: ["a.js"] }, { logger, runtime }),
    ).toBe(true);
    expect(
      reportExtensionValidation({ errors: ["invalid"], runtimeFiles: [] }, { logger, runtime }),
    ).toBe(false);
    expect(logger.log).toHaveBeenCalledWith("Extension validation passed (1 runtime files inspected).");
    expect(logger.error).toHaveBeenCalledWith("Extension validation failed:\n- invalid");
    expect(runtime.exitCode).toBe(1);
  });
});
