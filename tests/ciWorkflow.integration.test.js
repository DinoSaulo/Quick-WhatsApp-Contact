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
const setupNodeEnvAction = readFileSync(
  resolve(projectRoot, ".github", "actions", "setup-node-env", "action.yml"),
  "utf8",
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
    // setup-node/verify got extracted into a shared composite action (checkout can't move there —
    // a local action isn't resolvable until the repo is checked out). Checks both halves here.
    expect(workflow).toContain('NODE_VERSION: "22.23.2"');
    expect(setupNodeEnvAction).toContain("node-version: ${{ env.NODE_VERSION }}");
    expect(setupNodeEnvAction).toContain("name: Verificar versao do Node.js");
    expect(workflow.match(/uses: \.\/\.github\/actions\/setup-node-env/g)).toHaveLength(13);
    expect(workflow).not.toContain("actions/setup-node@v6");
  });

  it("runs lint and comment-length checks in a dedicated, sequential lint job", () => {
    const lint = jobSource("lint", "unit-tests");
    const unit = jobSource("unit-tests", "integration-tests");

    // Extracted out of unit-tests into its own job that now gates it — fail-fast on cheap lint
    // errors before spending runners on unit tests across 4 platforms.
    expect(unit).not.toContain("run: npm run lint");
    expect(unit).toContain("needs: lint");
    expect(lint).not.toContain("needs:");
    expect(lint).toMatch(/run: npm run lint(?!:)/);
    expect(lint).toContain("run: npm run lint:comments");
    expect(packageJson.scripts["lint:comments"]).toBe("node scripts/check-comment-length.mjs");
    expect(packageJson.scripts.verify).toContain("npm run lint:comments");
  });

  it("uses Node 24 runtime releases for every official JavaScript action", () => {
    expect(workflow).not.toMatch(
      /actions\/(?:checkout|setup-node|upload-artifact|download-artifact)@v4/,
    );
    expect(workflow).toContain("actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6");
    expect(workflow).toContain("actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6");
    expect(workflow).toContain("actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7");
  });

  // Supply-chain hardening: a tag can be recreated to point at a different commit, a SHA cannot —
  // every third-party `uses:` line must be a 40-char SHA with a trailing `# vX` comment.
  it("pins every third-party action to a commit SHA, not a mutable tag", () => {
    const usesLines = [
      ...workflow.matchAll(/^\s*uses:\s*(\S+)/gm),
      ...setupNodeEnvAction.matchAll(/^\s*uses:\s*(\S+)/gm),
    ].map((match) => match[1]);

    expect(usesLines.length).toBeGreaterThan(0);

    for (const reference of usesLines) {
      if (reference.startsWith("./")) continue; // local composite action, not a supply-chain risk
      expect(reference, reference).toMatch(/^[^@]+@[0-9a-f]{40}$/);
    }

    expect(workflow).toContain(
      "uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3",
    );
    expect(setupNodeEnvAction).toContain(
      "uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6",
    );
  });

  it("bootstraps Node and npm in every Fedora matrix job", () => {
    const unit = jobSource("unit-tests", "integration-tests");
    const integration = jobSource("integration-tests", "security-tests");
    const installation = jobSource("installation-test-chrome", "resolve-chrome-versions");
    const installationFirefox = jobSource("installation-test-firefox", "resolve-firefox-versions");

    for (const source of [unit, integration, installation, installationFirefox]) {
      expect(source).toMatch(
        /dnf install -y --setopt=install_weak_deps=False git curl nodejs npm/,
      );
    }
  });

  it("installs and verifies Fedora Chromium only where the browser is required", () => {
    const unit = jobSource("unit-tests", "integration-tests");
    const integration = jobSource("integration-tests", "security-tests");
    const installation = jobSource("installation-test-chrome", "resolve-chrome-versions");

    expect(unit).not.toContain(" chromium");
    expect(integration).not.toContain(" chromium");
    expect(installation).toContain("nodejs npm chromium");
    expect(installation).toContain("run: chromium-browser --version");
    // installation-test-chrome still lists integration-tests directly, even though
    // security-tests (also a dependency here) now guarantees it transitively too.
    expect(installation).toContain("needs: [integration-tests, security-tests]");
  });

  it("installs Fedora/Debian/Rocky/Arch Firefox packages with live-confirmed expected majors", () => {
    const installationFirefox = jobSource("installation-test-firefox", "resolve-firefox-versions");

    expect(installationFirefox).toContain("needs: [integration-tests, security-tests]");
    expect(installationFirefox).toContain("nodejs npm firefox");
    expect(installationFirefox).toContain("firefox-esr");
    // The rapid-release train (Fedora/Arch) and ESR train (Debian/Rocky) sit many majors apart on purpose.
    expect(installationFirefox).toContain('firefoxMajor: "153"');
    expect(installationFirefox).toContain('firefoxMajor: "140"');
    // Ubuntu/macOS/Windows rely on the runner's preinstalled Firefox and carry no firefoxMajor,
    // so the strict-assertion step must stay conditional instead of running unconditionally.
    expect(installationFirefox).toContain("if: matrix.firefoxMajor != ''");
  });

  it("connects the workflow step to the real browser lifecycle runner", () => {
    const installation = jobSource("installation-test-chrome", "resolve-chrome-versions");

    expect(installation).toContain("run: npm run test:install");
    expect(packageJson.scripts["test:install"]).toBe(
      "npm run build && node tests/installation/extension-install.mjs",
    );
    expect(packageJson.devDependencies["puppeteer-core"]).toBe("25.8.0");
  });

  it("exposes workflow_dispatch inputs for one-off Chrome/Firefox bisection versions", () => {
    const trigger = workflow.slice(workflow.indexOf("on:"), workflow.indexOf("permissions:"));

    expect(trigger).toContain("workflow_dispatch:");
    expect(trigger).toContain("extra_chrome_version:");
    expect(trigger).toContain("extra_firefox_version:");
  });

  it("resolves and pins installation-test-pinned's matrix to the last 3 Chrome majors dynamically", () => {
    const resolveJob = jobSource("resolve-chrome-versions", "installation-test-pinned");
    const pinnedJob = jobSource("installation-test-pinned", "installation-test-firefox");

    // needs: [integration-tests, security-tests] — uniform Level 4 convention (see ci.yml comment).
    expect(resolveJob).toContain("needs: [integration-tests, security-tests]");
    expect(resolveJob).toContain("outputs:");
    expect(resolveJob).toContain("versions: ${{ steps.resolve.outputs.versions }}");
    expect(resolveJob).toContain("node scripts/resolve-chrome-versions.mjs");
    expect(resolveJob).toContain('"${{ inputs.extra_chrome_version }}"');
    expect(resolveJob).toContain('>> "$GITHUB_OUTPUT"');

    expect(pinnedJob).toContain("needs: [security-tests, resolve-chrome-versions, installation-test-chrome]");
    expect(pinnedJob).toContain("fromJson(needs.resolve-chrome-versions.outputs.versions)");
    // The old hardcoded "151.0.7922.71" bisection entry is gone — one-off versions now flow
    // through extra_chrome_version (workflow_dispatch input) into the resolve script itself.
    expect(pinnedJob).not.toContain("include:");
    expect(pinnedJob).not.toContain("TEMPORARY");
    // Unlike installation-test-chrome's plain "run: npm run test:install", this job wraps it in a
    // retry loop (a rare native Chrome crash, see ci.yml) — must still invoke the real script and fail loudly once exhausted.
    expect(pinnedJob).toContain("run: |");
    expect(pinnedJob).toContain("npm run test:install");
    expect(pinnedJob).toMatch(/for attempt in .+; do/);
    expect(pinnedJob).toContain("exit 1");
    expect(pinnedJob).toContain("scripts/install-chrome-version.mjs");
    expect(pinnedJob).toContain("scripts/verify-chrome-version.mjs");
    // Cached by exact version — install-chrome-version.mjs itself skips the download on a hit.
    expect(pinnedJob).toContain("path: .chrome-for-testing/${{ matrix.chromeVersion }}");
    expect(pinnedJob).toContain("key: chrome-for-testing-${{ matrix.chromeVersion }}");
    // This job is deliberately Ubuntu-only (precise version coverage, not OS diversity — see the
    // comment above it in ci.yml), unlike installation-test-chrome's cross-platform matrix.
    expect(pinnedJob).not.toContain("windows-latest");
    expect(pinnedJob).not.toContain("macos-latest");
  });

  it("resolves and pins installation-test-firefox-pinned's matrix to the last 3 Firefox majors dynamically", () => {
    const resolveJob = jobSource("resolve-firefox-versions", "installation-test-firefox-pinned");
    const pinnedJob = jobSource("installation-test-firefox-pinned", "installation-test-safari");

    // Same reasoning as resolve-chrome-versions above.
    expect(resolveJob).toContain("needs: [integration-tests, security-tests]");
    expect(resolveJob).toContain("outputs:");
    expect(resolveJob).toContain("versions: ${{ steps.resolve.outputs.versions }}");
    expect(resolveJob).toContain("node scripts/resolve-firefox-versions.mjs");
    expect(resolveJob).toContain('"${{ inputs.extra_firefox_version }}"');
    expect(resolveJob).toContain('>> "$GITHUB_OUTPUT"');

    expect(pinnedJob).toContain("needs: [security-tests, resolve-firefox-versions, installation-test-firefox]");
    expect(pinnedJob).toContain("fromJson(needs.resolve-firefox-versions.outputs.versions)");
    expect(pinnedJob).toContain("run: npm run test:install:firefox");
    expect(pinnedJob).toContain("scripts/install-firefox-version.mjs");
    expect(pinnedJob).toContain("scripts/verify-firefox-version.mjs");
    expect(pinnedJob).toContain("path: .firefox-releases/${{ matrix.firefoxVersion }}");
    expect(pinnedJob).toContain("key: firefox-releases-${{ matrix.firefoxVersion }}");
    expect(pinnedJob).not.toContain("windows-latest");
    expect(pinnedJob).not.toContain("macos-latest");
  });

  it("connects the Firefox workflow steps to the real Firefox lifecycle runner", () => {
    expect(packageJson.scripts["test:install:firefox"]).toBe(
      "npm run build && node tests/installation/firefox-extension-install.mjs",
    );
    expect(packageJson.devDependencies["web-ext"]).toBe("10.6.0");
  });

  it("gates validate-extension on every installation job, Chrome and Firefox alike", () => {
    const validate = jobSource("validate-extension", "release");

    expect(workflow).toContain(
      "needs: [installation-test-chrome, installation-test-pinned, installation-test-firefox, installation-test-firefox-pinned, installation-test-safari]",
    );
    expect(validate).toContain("run: npm run validate:extension");
  });

  it("runs the security job on Linux only, between integration and installation", () => {
    const security = jobSource("security-tests", "installation-test-chrome");

    // Sequential now: security-tests waits directly on integration-tests, which already
    // transitively depends on unit-tests and lint.
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

  // Production dependencies are, and must stay, empty (validate-extension.mjs) — passes trivially
  // today, but guards the moment a real runtime dependency is added (docs/THREAT_MODEL.md §6).
  it("audits production dependencies for known vulnerabilities in the security job", () => {
    const security = jobSource("security-tests", "installation-test-chrome");

    expect(security).toContain("run: npm audit --omit=dev");
  });

  it("orders the pipeline as Lint -> Unit -> (Integration + Security) -> Installation (Chrome + Firefox, distro + pinned) -> Validate -> Release", () => {
    const jobIds = [
      "lint",
      "unit-tests",
      "integration-tests",
      "security-tests",
      "installation-test-chrome",
      "resolve-chrome-versions",
      "installation-test-pinned",
      "installation-test-firefox",
      "resolve-firefox-versions",
      "installation-test-firefox-pinned",
      "installation-test-safari",
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
