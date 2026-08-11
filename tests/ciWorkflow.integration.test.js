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
    expect(workflow.match(/actions\/setup-node@v6/g)).toHaveLength(5);
    expect(workflow.match(/node-version: \$\{\{ env\.NODE_VERSION \}\}/g)).toHaveLength(5);
    expect(workflow.match(/name: Verificar versao do Node\.js/g)).toHaveLength(5);
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
    const integration = jobSource("integration-tests", "installation-test");
    const installation = jobSource("installation-test", "validate-extension");

    for (const source of [unit, integration, installation]) {
      expect(source).toMatch(
        /dnf install -y --setopt=install_weak_deps=False git curl nodejs npm/,
      );
    }
  });

  it("installs and verifies Fedora Chromium only where the browser is required", () => {
    const unit = jobSource("unit-tests", "integration-tests");
    const integration = jobSource("integration-tests", "installation-test");
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
});
