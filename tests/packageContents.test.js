import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(file) : [file];
  });
}

describe("published package boundaries", () => {
  it("keeps every manifest-referenced file inside the source package", () => {
    const referenced = [
      manifest.background.service_worker,
      manifest.action.default_popup,
      manifest.options_ui.page,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon)
    ];

    for (const file of referenced) {
      expect(existsSync(resolve(projectRoot, file)), file).toBe(true);
    }
  });

  it("does not include store material or development metadata in the build recipe", () => {
    const buildSource = readFileSync(resolve(projectRoot, "scripts/build-extension.mjs"), "utf8");

    expect(buildSource).not.toContain('"store-assets"');
    expect(buildSource).not.toContain('"tests"');
    expect(buildSource).not.toContain('"docs"');
    expect(buildSource).toContain('"manifest.json"');
    expect(buildSource).toContain('"src"');
    expect(buildSource).toContain('"icons"');
  });

  it("contains no executable files outside the expected extension directories", () => {
    const sourceFiles = collectFiles(resolve(projectRoot, "src"));
    const forbidden = sourceFiles.filter((file) => [".map", ".test.js", ".spec.js"].includes(extname(file)));

    expect(forbidden.map((file) => relative(projectRoot, file))).toEqual([]);
  });

  it("does not expose JavaScript or HTML through web_accessible_resources", () => {
    const exposed = manifest.web_accessible_resources.flatMap((entry) => entry.resources || []);

    expect(exposed.some((file) => /\.(?:js|mjs|html)$/i.test(file))).toBe(false);
  });
});
