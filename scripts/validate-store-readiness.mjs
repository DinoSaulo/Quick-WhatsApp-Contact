import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isAcceptedScreenshotSize,
  parsePngSize,
  PUBLICATION_PLACEHOLDER_PATTERN,
  validateManifest
} from "../tests/store-readiness-checks.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
export function validateStoreReadiness({
  root = projectRoot,
  exists = existsSync,
  readFile = readFileSync,
  readDirectory = readdirSync,
} = {}) {
  const errors = [];
  const warnings = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const readText = (path) => readFile(resolve(root, path), "utf8");
  const readPngSize = (path) => {
    const buffer = readFile(resolve(root, path));
    const { isPng, width, height } = parsePngSize(buffer);
    check(isPng, `${path} must be PNG`);
    return { width, height };
  };
  const checkPng = (path, expectedWidth, expectedHeight) => {
    const absolutePath = resolve(root, path);
    check(exists(absolutePath), `Missing required image: ${path}`);
    if (!exists(absolutePath)) return;
    const { width, height } = readPngSize(path);
    check(
      width === expectedWidth && height === expectedHeight,
      `${path} must be ${expectedWidth}x${expectedHeight}; found ${width}x${height}`,
    );
  };

  const manifest = JSON.parse(readText("manifest.json"));
  errors.push(...validateManifest(manifest));
  checkPng("icons/icon128.png", 128, 128);
  checkPng("store-assets/small-promo-440x280.png", 440, 280);

  const screenshotsDirectory = resolve(root, "store-assets", "screenshots");
  const screenshots = exists(screenshotsDirectory)
    ? readDirectory(screenshotsDirectory).filter((name) => extname(name).toLowerCase() === ".png")
    : [];
  check(screenshots.length >= 1, "Add at least one real screenshot to store-assets/screenshots/");
  check(screenshots.length <= 5, "Chrome Web Store accepts at most five screenshots");
  for (const screenshot of screenshots) {
    const path = `store-assets/screenshots/${screenshot}`;
    const size = readPngSize(path);
    check(
      isAcceptedScreenshotSize(size),
      `${path} must be 1280x800 or 640x400; found ${size.width}x${size.height}`,
    );
  }

  const policyFiles = ["PRIVACY.md", "docs/privacy.html", "docs/STORE_LISTING.md"];
  for (const path of policyFiles) {
    check(
      !PUBLICATION_PLACEHOLDER_PATTERN.test(readText(path)),
      `${path} still contains a publication placeholder`,
    );
  }
  check(
    /Uso Limitado/i.test(readText("PRIVACY.md")),
    "PRIVACY.md must affirm Limited Use compliance",
  );
  check(exists(resolve(root, "docs/.nojekyll")), "docs/.nojekyll is required for Pages from /docs");

  if (!exists(resolve(root, "store-assets/marquee-1400x560.png"))) {
    warnings.push("Optional 1400x560 marquee image is not present");
  }

  return { errors, screenshots, warnings };
}

export function reportStoreReadiness(
  { errors, screenshots, warnings },
  { logger = console, runtime = process } = {},
) {
  for (const warning of warnings) logger.warn(`Warning: ${warning}`);
  if (errors.length) {
    logger.error(`Store readiness failed:\n- ${errors.join("\n- ")}`);
    runtime.exitCode = 1;
    return false;
  }
  logger.log(`Store readiness passed with ${screenshots.length} screenshot(s).`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportStoreReadiness(validateStoreReadiness());
}
