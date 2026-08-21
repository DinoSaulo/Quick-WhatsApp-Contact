// The testable validation rules behind scripts/validate-store-readiness.mjs, pulled out from the
// fs-reading CLI wrapper so they can be unit tested with in-memory fixtures.

const PNG_SIGNATURE_HEX = "89504e470d0a1a0a";

export function parsePngSize(buffer) {
  const isPng = buffer.subarray(0, 8).toString("hex") === PNG_SIGNATURE_HEX;
  return { isPng, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function isAcceptedScreenshotSize({ width, height }) {
  return (width === 1280 && height === 800) || (width === 640 && height === 400);
}

// Chrome Web Store requires a public store description and homepage; these mirror the fields it
// actually validates on submission, so a failure here means submission would fail too.
export function validateManifest(manifest) {
  const errors = [];
  if (manifest.manifest_version !== 3) errors.push("manifest.json must use Manifest V3");
  if (!manifest.name) errors.push("manifest.json must include name");
  if (!manifest.version) errors.push("manifest.json must include version");

  const description = manifest.description;
  const hasValidDescription =
    typeof description === "string" && description.length > 0 && description.length <= 132;
  if (!hasValidDescription) errors.push("manifest description must contain 1-132 characters");

  if (!(manifest.homepage_url || "").startsWith("https://")) {
    errors.push("homepage_url must be a public HTTPS URL");
  }

  return errors;
}

// Matches the placeholder text a template/checklist leaves behind before real publication content
// replaces it — catches an accidental publish of unfinished copy.
export const PUBLICATION_PLACEHOLDER_PATTERN = /\[e-?mail[^\]]*\]|A DEFINIR|TO BE FILLED/i;
