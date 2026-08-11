import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.background?.service_worker, "A service worker is required");
assert(!manifest.permissions?.includes("tabs"), "The broad tabs permission is not allowed");
assert(!manifest.content_scripts, "Page helpers must use optional host access");
assert(
  JSON.stringify(manifest.optional_host_permissions) === JSON.stringify(["http://*/*", "https://*/*"]),
  "Optional host permissions must be limited to HTTP and HTTPS pages"
);
assert(
  manifest.content_security_policy?.extension_pages?.includes("script-src 'self'"),
  "Extension pages must restrict scripts to self"
);
assert(
  !manifest.content_security_policy?.extension_pages?.includes("unsafe-eval"),
  "unsafe-eval is forbidden"
);

const referencedPaths = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {})
].filter(Boolean);

for (const filePath of referencedPaths) {
  assert(existsSync(resolve(projectRoot, filePath)), `Manifest path does not exist: ${filePath}`);
}

const exposedResources = (manifest.web_accessible_resources || []).flatMap(
  (entry) => entry.resources || []
);
assert(
  !exposedResources.some((resource) => /\.(?:js|mjs|html)$/i.test(resource)),
  "Executable resources must not be web accessible"
);

const runtimeFiles = collectFiles(resolve(projectRoot, "src")).filter((file) =>
  [".js", ".html"].includes(extname(file))
);
const forbiddenPatterns = [
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /\bnew\s+Function\s*\(/, label: "new Function" },
  { pattern: /<script[^>]+src=["']https?:\/\//i, label: "remote script" },
  { pattern: /\bimport\s*\(\s*["']https?:\/\//, label: "remote dynamic import" }
];

for (const file of runtimeFiles) {
  const source = readFileSync(file, "utf8");
  for (const { pattern, label } of forbiddenPatterns) {
    assert(!pattern.test(source), `${label} found in ${relative(projectRoot, file)}`);
  }
}

const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
assert(
  !packageJson.dependencies || Object.keys(packageJson.dependencies).length === 0,
  "Runtime npm dependencies must be reviewed and bundled before release"
);

if (errors.length) {
  console.error("Extension validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Extension validation passed (${runtimeFiles.length} runtime files inspected).`);
