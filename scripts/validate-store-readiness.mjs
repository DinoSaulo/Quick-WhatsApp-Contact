import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import {
  isAcceptedScreenshotSize,
  parsePngSize,
  PUBLICATION_PLACEHOLDER_PATTERN,
  validateManifest
} from "../tests/store-readiness-checks.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const errors = [];
const warnings = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function readText(path) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function readPngSize(path) {
  const buffer = readFileSync(resolve(projectRoot, path));
  const { isPng, width, height } = parsePngSize(buffer);
  check(isPng, `${path} must be PNG`);
  return { width, height };
}

function checkPng(path, expectedWidth, expectedHeight) {
  const absolutePath = resolve(projectRoot, path);
  check(existsSync(absolutePath), `Missing required image: ${path}`);
  if (!existsSync(absolutePath)) return;
  const { width, height } = readPngSize(path);
  check(
    width === expectedWidth && height === expectedHeight,
    `${path} must be ${expectedWidth}x${expectedHeight}; found ${width}x${height}`
  );
}

const manifest = JSON.parse(readText("manifest.json"));
errors.push(...validateManifest(manifest));

checkPng("icons/icon128.png", 128, 128);
checkPng("store-assets/small-promo-440x280.png", 440, 280);

const screenshotsDirectory = resolve(projectRoot, "store-assets", "screenshots");
const screenshots = existsSync(screenshotsDirectory)
  ? readdirSync(screenshotsDirectory).filter((name) => extname(name).toLowerCase() === ".png")
  : [];
check(screenshots.length >= 1, "Add at least one real screenshot to store-assets/screenshots/");
check(screenshots.length <= 5, "Chrome Web Store accepts at most five screenshots");
for (const screenshot of screenshots) {
  const path = `store-assets/screenshots/${screenshot}`;
  const size = readPngSize(path);
  check(
    isAcceptedScreenshotSize(size),
    `${path} must be 1280x800 or 640x400; found ${size.width}x${size.height}`
  );
}

const policyFiles = ["PRIVACY.md", "docs/privacy.html", "docs/STORE_LISTING.md"];
for (const path of policyFiles) {
  check(
    !PUBLICATION_PLACEHOLDER_PATTERN.test(readText(path)),
    `${path} still contains a publication placeholder`
  );
}
check(/Uso Limitado/i.test(readText("PRIVACY.md")), "PRIVACY.md must affirm Limited Use compliance");
check(existsSync(resolve(projectRoot, "docs/.nojekyll")), "docs/.nojekyll is required for Pages from /docs");

if (!existsSync(resolve(projectRoot, "store-assets/marquee-1400x560.png"))) {
  warnings.push("Optional 1400x560 marquee image is not present");
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);
if (errors.length) {
  console.error(`Store readiness failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Store readiness passed with ${screenshots.length} screenshot(s).`);
