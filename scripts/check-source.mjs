import { readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const roots = ["src", "scripts", "tests", "docs"];

function collectJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(entryPath);
    return extname(entry.name) === ".js" || extname(entry.name) === ".mjs" ? [entryPath] : [];
  });
}

const files = roots.flatMap((root) => collectJavaScript(resolve(projectRoot, root)));
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.error) {
    failures.push(`${file}\nUnable to start the syntax checker: ${result.error.message}`);
    continue;
  }
  if (result.status !== 0) {
    failures.push(`${file}\n${result.stderr || result.stdout || "Syntax check failed."}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
