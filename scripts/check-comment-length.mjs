import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles, findOverlongCommentBlocks } from "../tests/comment-length-checker.mjs";

// Project convention: no comment may span more than 2 lines — keeps rationale terse enough to
// actually get read. Deep root-cause narratives belong in commit messages/git history, not here.
const MAX_COMMENT_LINES = 2;

const projectRoot = resolve(import.meta.dirname, "..");
const jsRoots = ["src", "scripts", "tests", "docs"];
const yamlRoots = [".github"];

const jsFiles = jsRoots.flatMap((root) => collectFiles(resolve(projectRoot, root), [".js", ".mjs"]));
const yamlFiles = yamlRoots.flatMap((root) => collectFiles(resolve(projectRoot, root), [".yml", ".yaml"]));

// Also check the two top-level config files that carry the same kind of explanatory comments.
const extraFiles = ["eslint.config.js"].map((name) => resolve(projectRoot, name));

const files = [...jsFiles, ...yamlFiles, ...extraFiles];
const failures = [];

for (const file of files) {
  const isYaml = file.endsWith(".yml") || file.endsWith(".yaml");
  const lines = readFileSync(file, "utf8").split("\n");

  for (const violation of findOverlongCommentBlocks(lines, { isYaml, maxLines: MAX_COMMENT_LINES })) {
    failures.push(
      `${file}:${violation.startLine}-${violation.endLine} — comment block is ${violation.lineCount} lines ` +
        `(max ${MAX_COMMENT_LINES}). Condense it — deep rationale belongs in the commit message.`,
    );
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Comment-length check passed for ${files.length} files.`);
