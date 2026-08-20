// The testable pieces behind scripts/check-source.mjs: file discovery and the per-file syntax
// check, both real (no mocking) since `node --check` is the same binary the tests themselves run on.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

export function collectJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(entryPath);
    return extname(entry.name) === ".js" || extname(entry.name) === ".mjs" ? [entryPath] : [];
  });
}

export function checkSyntax(file) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.error) {
    return { ok: false, message: `${file}\nUnable to start the syntax checker: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { ok: false, message: `${file}\n${result.stderr || result.stdout || "Syntax check failed."}` };
  }
  return { ok: true, message: null };
}
