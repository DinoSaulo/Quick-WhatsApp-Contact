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
    expect(workflow.match(/actions\/setup-node@v6/g)).toHaveLength(6);
    expect(workflow.match(/node-version: \$\{\{ env\.NODE_VERSION \}\}/g)).toHaveLength(6);
    expect(workflow.match(/name: Verificar versao do Node\.js/g)).toHaveLength(6);
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
    const installation = jobSource("installation-test", "validate-extension");

    for (const source of [unit, integration, installation]) {
      expect(source).toMatch(
        /dnf install -y --setopt=install_weak_deps=False git curl nodejs npm/,
      );
    }
  });

  it("installs and verifies Fedora Chromium only where the browser is required", () => {
    const unit = jobSource("unit-tests", "integration-tests");
    const integration = jobSource("integration-tests", "security-tests");
    const installation = jobSource("installation-test", "validate-extension");

    expect(unit).not.toContain(" chromium");
    expect(integration).not.toContain(" chromium");
    expect(installation).toContain("nodejs npm chromium");
    expect(installation).toContain("run: chromium-browser --version");
  });

  it("connects the workflow step to the real browser lifecycle runner", () => {
    const installation = jobSource("installation-test", "validate-extension");

    expect(installation).toContain("run: npm run test:install");
    expect(packageJson.scripts["test:install"]).toBe(
      "npm run build && node tests/installation/extension-install.mjs",
    );
    expect(packageJson.devDependencies["puppeteer-core"]).toBe("24.8.1");
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

  it("orders the pipeline as Unit -> Integration -> Security -> Installation -> Validate -> Release", () => {
    const jobIds = [
      "unit-tests",
      "integration-tests",
      "security-tests",
      "installation-test",
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
