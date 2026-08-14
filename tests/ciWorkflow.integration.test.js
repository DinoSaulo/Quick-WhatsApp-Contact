import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const workflow = readFileSync(
  resolve(projectRoot, ".github", "workflows", "ci.yml"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);

function jobSource(jobName, nextJobName) {
  const start = workflow.indexOf(`  ${jobName}:`);
  const end = nextJobName ? workflow.indexOf(`  ${nextJobName}:`, start) : workflow.length;

  expect(start, `${jobName} should exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${nextJobName ?? "workflow end"} should follow ${jobName}`).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe("GitHub Actions cross-platform runtime integration", () => {
  it("pins the same exact Node.js version in every job", () => {
    expect(workflow).toContain('NODE_VERSION: "22.23.2"');
    expect(workflow.match(/actions\/setup-node@v6/g)).toHaveLength(8);
    expect(workflow.match(/node-version: \$\{\{ env\.NODE_VERSION \}\}/g)).toHaveLength(8);
    expect(workflow.match(/name: Verificar versao do Node\.js/g)).toHaveLength(8);
  });

  it("uses Node 24 runtime releases for every official JavaScript action", () => {
    expect(workflow).not.toMatch(
      /actions\/(?:checkout|setup-node|upload-artifact|download-artifact)@v4/,
    );
    expect(workflow).toContain("actions/checkout@v6");
    expect(workflow).toContain("actions/upload-artifact@v6");
    expect(workflow).toContain("actions/download-artifact@v7");
  });

  it("bootstraps Node and npm in every Fedora matrix job", () => {
    const unit = jobSource("unit-tests", "integration-tests");
    const integration = jobSource("integration-tests", "security-tests");
    const installation = jobSource("installation-test", "resolve-chrome-versions");

    for (const source of [unit, integration, installation]) {
      expect(source).toMatch(
        /dnf install -y --setopt=install_weak_deps=False git curl nodejs npm/,
      );
    }
  });

  it("installs and verifies Fedora Chromium only where the browser is required", () => {
    const unit = jobSource("unit-tests", "integration-tests");
    const integration = jobSource("integration-tests", "security-tests");
    const installation = jobSource("installation-test", "resolve-chrome-versions");

    expect(unit).not.toContain(" chromium");
    expect(integration).not.toContain(" chromium");
    expect(installation).toContain("nodejs npm chromium");
    expect(installation).toContain("run: chromium-browser --version");
  });

  it("connects the workflow step to the real browser lifecycle runner", () => {
    const installation = jobSource("installation-test", "resolve-chrome-versions");

    expect(installation).toContain("run: npm run test:install");
    expect(packageJson.scripts["test:install"]).toBe(
      "npm run build && node tests/installation/extension-install.mjs",
    );
    expect(packageJson.devDependencies["puppeteer-core"]).toBe("24.8.1");
  });

  it("resolves and pins installation-test-pinned's matrix to the last 3 Chrome majors dynamically", () => {
    const resolveJob = jobSource("resolve-chrome-versions", "installation-test-pinned");
    const pinnedJob = jobSource("installation-test-pinned", "validate-extension");

    expect(resolveJob).toContain("needs: security-tests");
    expect(resolveJob).toContain("outputs:");
    expect(resolveJob).toContain("versions: ${{ steps.resolve.outputs.versions }}");
    expect(resolveJob).toContain('run: node scripts/resolve-chrome-versions.mjs >> "$GITHUB_OUTPUT"');

    expect(pinnedJob).toContain("needs: [security-tests, resolve-chrome-versions]");
    expect(pinnedJob).toContain("fromJson(needs.resolve-chrome-versions.outputs.versions)");
    expect(pinnedJob).toContain("run: npm run test:install");
    expect(pinnedJob).toContain("scripts/install-chrome-version.mjs");
    expect(pinnedJob).toContain("scripts/verify-chrome-version.mjs");
    // This job is deliberately Ubuntu-only (precise version coverage, not OS diversity — see the
    // comment above it in ci.yml), unlike installation-test's cross-platform matrix.
    expect(pinnedJob).not.toContain("windows-latest");
    expect(pinnedJob).not.toContain("macos-latest");
  });

  it("gates validate-extension on both the distro-diversity and exact-version installation jobs", () => {
    const validate = jobSource("validate-extension", "release");

    expect(workflow).toContain("needs: [installation-test, installation-test-pinned]");
    expect(validate).toContain("run: npm run validate:extension");
  });

  it("runs the security job on Linux only, between integration and installation", () => {
    const security = jobSource("security-tests", "installation-test");

    expect(security).toContain("needs: integration-tests");
    expect(security).toContain("runs-on: ubuntu-latest");
    // A dedicated Linux-only job: no build matrix (unlike unit/integration/installation,
    // which run across Ubuntu/Fedora/macOS/Windows), same shape as validate-extension/release.
    expect(security).not.toContain("strategy:");
    expect(security).not.toContain("matrix:");
    expect(security).not.toContain("windows-latest");
    expect(security).not.toContain("macos-latest");

    expect(security).toContain("run: npm run lint:sast");
    expect(security).toContain("npm run test:security --");
    expect(packageJson.scripts["lint:sast"]).toBe("eslint .");
    expect(packageJson.scripts["test:security"]).toContain("tests/security.test.js");
  });

  // Production dependencies are, and must stay, empty (see validate-extension.mjs), so this
  // step passes trivially today — its value is as a regression guard: the moment a real
  // runtime dependency is ever added, a known vulnerability in it fails the pipeline instead
  // of only being caught by someone running `npm audit` by hand (see docs/THREAT_MODEL.md §6).
  it("audits production dependencies for known vulnerabilities in the security job", () => {
    const security = jobSource("security-tests", "installation-test");

    expect(security).toContain("run: npm audit --omit=dev");
  });

  it("orders the pipeline as Unit -> Integration -> Security -> Installation (distro + pinned) -> Validate -> Release", () => {
    const jobIds = [
      "unit-tests",
      "integration-tests",
      "security-tests",
      "installation-test",
      "resolve-chrome-versions",
      "installation-test-pinned",
      "validate-extension",
      "release",
    ];
    const positions = jobIds.map((jobId) => workflow.indexOf(`  ${jobId}:`));

    for (const position of positions) {
      expect(position).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});

describe("Dependabot configuration", () => {
  const dependabot = readFileSync(
    resolve(projectRoot, ".github", "dependabot.yml"),
    "utf8",
  );

  it("keeps npm devDependencies and GitHub Actions pins on a weekly update schedule", () => {
    expect(dependabot).toContain('package-ecosystem: "npm"');
    expect(dependabot).toContain('package-ecosystem: "github-actions"');
    expect(dependabot.match(/interval: "weekly"/g)).toHaveLength(2);
  });
});
