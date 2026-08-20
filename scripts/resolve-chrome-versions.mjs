// Resolves the 3 most recent Chrome for Testing majors for the pinned CI matrix.
// Selection logic lives in chrome-version-selection.mjs so it can evolve independently.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectLastThreeMajors } from "../tests/installation/chrome-version-selection.mjs";

export const CHROME_KNOWN_GOOD_VERSIONS_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";

export async function resolveChromeVersions({ extraVersion, request = fetch } = {}) {
  const response = await request(CHROME_KNOWN_GOOD_VERSIONS_URL);
  if (!response.ok) {
    throw new Error(
      `Falha ao consultar ${CHROME_KNOWN_GOOD_VERSIONS_URL}: HTTP ${response.status}`,
    );
  }

  const versionsData = await response.json();
  const versions = selectLastThreeMajors(versionsData);
  if (versions.length !== 3) {
    throw new Error(
      `Esperava 3 versoes major do Chrome, encontrei ${versions.length}: ${JSON.stringify(versions)}`,
    );
  }

  const normalizedExtraVersion = extraVersion?.trim();
  if (normalizedExtraVersion && !versions.includes(normalizedExtraVersion)) {
    versions.push(normalizedExtraVersion);
  }
  return versions;
}

export function formatChromeVersionsOutput(versions) {
  return `versions=${JSON.stringify(versions)}`;
}

export async function runChromeVersionResolver({
  extraVersion = process.argv[2],
  request = fetch,
  logger = console,
} = {}) {
  const versions = await resolveChromeVersions({ extraVersion, request });
  logger.log(formatChromeVersionsOutput(versions));
  return versions;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runChromeVersionResolver();
}
