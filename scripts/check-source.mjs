import { resolve } from "node:path";
import { checkSyntax, collectJavaScript } from "../tests/js-syntax-checker.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const roots = ["src", "scripts", "tests", "docs"];

const files = roots.flatMap((root) => collectJavaScript(resolve(projectRoot, root)));
const failures = [];

for (const file of files) {
  const result = checkSyntax(file);
  if (!result.ok) failures.push(result.message);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
