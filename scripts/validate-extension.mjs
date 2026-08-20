import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const FORBIDDEN_PATTERNS = [
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /\bnew\s+Function\s*\(/, label: "new Function" },
  { pattern: /<script[^>]+src=["']https?:\/\//i, label: "remote script" },
  { pattern: /\bimport\s*\(\s*["']https?:\/\//, label: "remote dynamic import" },
];
const ALL_PAGES_PATTERN_SUFFIX = "://*/*";
const REQUIRED_OPTIONAL_HOST_PERMISSIONS = new Set(
  ["http", "https"].map((protocol) => `${protocol}${ALL_PAGES_PATTERN_SUFFIX}`),
);

export function hasExpectedOptionalHostPermissions(permissions) {
  if (!Array.isArray(permissions)) return false;

  const uniquePermissions = new Set(permissions);
  return (
    permissions.length === REQUIRED_OPTIONAL_HOST_PERMISSIONS.size &&
    uniquePermissions.size === REQUIRED_OPTIONAL_HOST_PERMISSIONS.size &&
    permissions.every((permission) => REQUIRED_OPTIONAL_HOST_PERMISSIONS.has(permission))
  );
}

export function collectRuntimeFiles(directory, readDirectory = readdirSync) {
  return readDirectory(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? collectRuntimeFiles(entryPath, readDirectory) : [entryPath];
  });
}

export function validateExtension({
  root = projectRoot,
  exists = existsSync,
  readFile = readFileSync,
  readDirectory = readdirSync,
} = {}) {
  const manifest = JSON.parse(readFile(resolve(root, "manifest.json"), "utf8"));
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(message);
  };

  assert(manifest.manifest_version === 3, "manifest_version must be 3");
  assert(manifest.background?.service_worker, "A service worker is required");
  assert(!manifest.permissions?.includes("tabs"), "The broad tabs permission is not allowed");
  assert(!manifest.content_scripts, "Page helpers must use optional host access");
  assert(
    hasExpectedOptionalHostPermissions(manifest.optional_host_permissions),
    "Optional host permissions must be limited to HTTP and HTTPS pages",
  );
  assert(
    manifest.content_security_policy?.extension_pages?.includes("script-src 'self'"),
    "Extension pages must restrict scripts to self",
  );
  assert(
    !manifest.content_security_policy?.extension_pages?.includes("unsafe-eval"),
    "unsafe-eval is forbidden",
  );
  assert(
    manifest.externally_connectable === undefined,
    "externally_connectable would let arbitrary websites message the background service worker",
  );
  assert(
    manifest.optional_permissions === undefined,
    "optional_permissions must be deliberately reviewed before being requested at runtime",
  );

  const referencedPaths = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
  ].filter(Boolean);
  for (const filePath of referencedPaths) {
    assert(exists(resolve(root, filePath)), `Manifest path does not exist: ${filePath}`);
  }

  const exposedResources = (manifest.web_accessible_resources || []).flatMap(
    (entry) => entry.resources || [],
  );
  assert(
    !exposedResources.some((resource) => /\.(?:js|mjs|html)$/i.test(resource)),
    "Executable resources must not be web accessible",
  );

  const runtimeFiles = collectRuntimeFiles(resolve(root, "src"), readDirectory).filter((file) =>
    [".js", ".html"].includes(extname(file)),
  );
  for (const file of runtimeFiles) {
    const source = readFile(file, "utf8");
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      assert(!pattern.test(source), `${label} found in ${relative(root, file)}`);
    }
  }

  const packageJson = JSON.parse(readFile(resolve(root, "package.json"), "utf8"));
  assert(
    !packageJson.dependencies || Object.keys(packageJson.dependencies).length === 0,
    "Runtime npm dependencies must be reviewed and bundled before release",
  );

  return { errors, runtimeFiles };
}

export function reportExtensionValidation(
  { errors, runtimeFiles },
  { logger = console, runtime = process } = {},
) {
  if (errors.length) {
    logger.error(`Extension validation failed:\n- ${errors.join("\n- ")}`);
    runtime.exitCode = 1;
    return false;
  }
  logger.log(`Extension validation passed (${runtimeFiles.length} runtime files inspected).`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportExtensionValidation(validateExtension());
}
