import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { checkSyntax, collectJavaScript } from "../tests/js-syntax-checker.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const roots = ["src", "scripts", "tests", "docs"];

export function runSourceCheck({
  root = projectRoot,
  collect = collectJavaScript,
  check = checkSyntax,
} = {}) {
  const files = roots.flatMap((directory) => collect(resolve(root, directory)));
  const failures = [];

  for (const file of files) {
    const result = check(file);
    if (!result.ok) failures.push(result.message);
  }

  return { failures, files };
}

export function reportSourceCheck({ failures, files }, { logger = console, runtime = process } = {}) {
  if (failures.length) {
    logger.error(failures.join("\n"));
    runtime.exitCode = 1;
    return false;
  }
  logger.log(`Syntax check passed for ${files.length} JavaScript files.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportSourceCheck(runSourceCheck());
}
