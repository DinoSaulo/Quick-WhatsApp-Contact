import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));

describe("Chrome Web Store manifest readiness", () => {
  it("uses Manifest V3 with a module service worker", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({
      service_worker: "src/background.js",
      type: "module"
    });
  });

  it("requests only the required API permissions", () => {
    expect(manifest.permissions).toEqual(["contextMenus", "scripting", "storage"]);
    expect(manifest.permissions).not.toContain("tabs");
  });

  it("makes broad site access optional and limited to web pages", () => {
    expect(manifest.optional_host_permissions).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.content_scripts).toBeUndefined();
  });

  it("uses a restrictive extension page CSP", () => {
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self'");
    expect(manifest.content_security_policy.extension_pages).not.toContain("unsafe-eval");
  });

  it("references files that exist in the package", () => {
    const paths = [
      manifest.background.service_worker,
      manifest.action.default_popup,
      manifest.options_ui.page,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon)
    ];
    for (const filePath of paths) {
      expect(existsSync(resolve(projectRoot, filePath)), filePath).toBe(true);
    }
  });

  it("does not expose executable extension resources to websites", () => {
    const resources = manifest.web_accessible_resources.flatMap((entry) => entry.resources);
    expect(resources).toEqual(["icons/icon16.png"]);
    expect(resources.some((resource) => /\.(?:js|html)$/i.test(resource))).toBe(false);
  });
});
