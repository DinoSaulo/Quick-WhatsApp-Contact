import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));

describe("README and project configuration consistency", () => {
  it("documents only npm scripts that exist in package.json", () => {
    const documentedScripts = [...readme.matchAll(/npm run ([a-z0-9:_-]+)/gi)].map(
      ([, script]) => script
    );

    expect(documentedScripts.length).toBeGreaterThan(0);
    for (const script of new Set(documentedScripts)) {
      expect(packageJson.scripts, `README references missing script: ${script}`).toHaveProperty(script);
    }
  });

  it("keeps every local Markdown link in README resolvable", () => {
    const localLinks = [...readme.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)].map(([, link]) => link);

    expect(localLinks.length).toBeGreaterThan(0);
    for (const link of new Set(localLinks)) {
      expect(existsSync(resolve(projectRoot, link)), `Missing README target: ${link}`).toBe(true);
    }
  });

  it("documents both browser installation paths and the complete verification command", () => {
    expect(readme).toContain("chrome://extensions");
    expect(readme).toContain("about:debugging#/runtime/this-firefox");
    expect(readme).toContain("npm run verify");
    expect(readme).toContain("npm run test:weblint");
  });
});
