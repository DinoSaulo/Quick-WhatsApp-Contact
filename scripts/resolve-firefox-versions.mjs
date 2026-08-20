// Resolves the 3 most recent Firefox majors from Mozilla's release-history API.
// Selection logic lives in firefox-version-selection.mjs so it can evolve independently.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectLastThreeFirefoxMajors } from "../tests/installation/firefox-version-selection.mjs";

export const FIREFOX_RELEASE_HISTORY_URL =
  "https://product-details.mozilla.org/1.0/firefox_history_major_releases.json";

export async function resolveFirefoxVersions({ extraVersion, request = fetch } = {}) {
  const response = await request(FIREFOX_RELEASE_HISTORY_URL);
  if (!response.ok) {
    throw new Error(
      `Falha ao consultar ${FIREFOX_RELEASE_HISTORY_URL}: HTTP ${response.status}`,
    );
  }

  const releaseHistory = await response.json();
  const versions = selectLastThreeFirefoxMajors(releaseHistory);
  if (versions.length !== 3) {
    throw new Error(
      `Esperava 3 versoes major do Firefox, encontrei ${versions.length}: ${JSON.stringify(versions)}`,
    );
  }

  const normalizedExtraVersion = extraVersion?.trim();
  if (normalizedExtraVersion && !versions.includes(normalizedExtraVersion)) {
    versions.push(normalizedExtraVersion);
  }
  return versions;
}

export function formatFirefoxVersionsOutput(versions) {
  return `versions=${JSON.stringify(versions)}`;
}

export async function runFirefoxVersionResolver({
  extraVersion = process.argv[2],
  request = fetch,
  logger = console,
} = {}) {
  const versions = await resolveFirefoxVersions({ extraVersion, request });
  logger.log(formatFirefoxVersionsOutput(versions));
  return versions;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runFirefoxVersionResolver();
}
