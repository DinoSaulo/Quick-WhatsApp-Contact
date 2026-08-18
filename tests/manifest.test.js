import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));

describe("Chrome Web Store manifest readiness", () => {
  it("uses Manifest V3 with a module service worker", () => {
    expect(manifest.manifest_version).toBe(3);
    // `scripts` is Firefox's key (it never reads service_worker — see the Firefox readiness block
    // below); Chrome (127+, per minimum_chrome_version below) ignores the extra key.
    expect(manifest.background).toEqual({
      service_worker: "src/background.js",
      scripts: ["src/background.js"],
      type: "module"
    });
  });

  it("points homepage_url at the public source repository", () => {
    expect(manifest.homepage_url).toBe("https://github.com/DinoSaulo/Quick-WhatsApp-Contact");
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

  it("sets the minimum Chrome version required by action.openPopup", () => {
    expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(127);
  });

  it("prevents extension pages from being embedded or changing their base URL", () => {
    const csp = manifest.content_security_policy.extension_pages;

    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("limits web-accessible resources to HTTP and HTTPS origins", () => {
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ["icons/icon16.png"],
        matches: ["http://*/*", "https://*/*"],
        use_dynamic_url: true
      }
    ]);
  });

  // Without use_dynamic_url, the resource URL is fixed and guessable — a known cross-site
  // fingerprinting technique. Chrome 106+ can rotate it per-session instead; safe since nothing in src/ hardcodes chrome-extension://... URLs.
  it("rotates the web-accessible resource URL instead of exposing a fixed, fingerprintable one", () => {
    expect(manifest.web_accessible_resources[0].use_dynamic_url).toBe(true);
  });

  // Sem externally_connectable, o listener chrome.runtime.onMessage em background.js só é
  // alcançável pelos próprios contextos da extensão — este teste é o guard-rail contra reabri-lo à web pública sem revisão deliberada.
  it("does not declare externally_connectable, keeping runtime.onMessage internal-only", () => {
    expect(manifest.externally_connectable).toBeUndefined();
  });

  // `permissions`/`optional_host_permissions` above are pinned exactly, but `optional_permissions`
  // (non-host APIs like tabs, debugger, identity) has no such guard — this makes declaring it for the first time a deliberate, reviewed choice.
  it("does not declare optional_permissions, keeping every requestable API on the reviewed allowlist", () => {
    expect(manifest.optional_permissions).toBeUndefined();
  });
});

describe("Firefox readiness", () => {
  // Firefox needs gecko.id to identify "same extension across updates" — without it, a
  // self-distributed install is rejected. The email-shaped format is MDN's documented convention for extensions without a dedicated domain.
  it("declares a gecko id in the documented email-like format", () => {
    expect(manifest.browser_specific_settings.gecko.id).toMatch(
      /^[a-zA-Z0-9-._]{1,80}@[a-zA-Z0-9-._]+$/,
    );
  });

  // 140.0 is the real floor now: data_collection_permissions below needs Firefox 140+ to be
  // recognized (per `web-ext lint`/AMO validation) — higher than the 128 optional_host_permissions alone would require.
  it("sets strict_min_version to cover both optional_host_permissions and data_collection_permissions", () => {
    expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe("140.0");
  });

  it("declares no data collection, matching the no-backend/no-telemetry reality (docs/THREAT_MODEL.md)", () => {
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions).toEqual({
      required: ["none"],
    });
  });

  // gecko_android's own strict_min_version is a separate track from gecko's — Firefox for Android
  // only recognized data_collection_permissions from 142, one release after desktop's 140.
  it("sets gecko_android's own, higher floor for data_collection_permissions support", () => {
    expect(manifest.browser_specific_settings.gecko_android.strict_min_version).toBe("142.0");
  });
});
