import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles, findOverlongCommentBlocks } from "../tests/comment-length-checker.mjs";

// Project convention: no comment may span more than 2 lines — keeps rationale terse enough to
// actually get read. Deep root-cause narratives belong in commit messages/git history, not here.
const MAX_COMMENT_LINES = 2;

const projectRoot = resolve(import.meta.dirname, "..");
const jsRoots = ["src", "scripts", "tests", "docs"];
const yamlRoots = [".github"];

export function runCommentLengthCheck({
  root = projectRoot,
  collect = collectFiles,
  read = readFileSync,
} = {}) {
  const jsFiles = jsRoots.flatMap((directory) =>
    collect(resolve(root, directory), [".js", ".mjs"]),
  );
  const yamlFiles = yamlRoots.flatMap((directory) =>
    collect(resolve(root, directory), [".yml", ".yaml"]),
  );
  const extraFiles = ["eslint.config.js"].map((name) => resolve(root, name));
  const files = [...jsFiles, ...yamlFiles, ...extraFiles];
  const failures = [];

  for (const file of files) {
    const isYaml = file.endsWith(".yml") || file.endsWith(".yaml");
    const lines = read(file, "utf8").split("\n");

    for (const violation of findOverlongCommentBlocks(lines, {
      isYaml,
      maxLines: MAX_COMMENT_LINES,
    })) {
      failures.push(
        `${file}:${violation.startLine}-${violation.endLine} — comment block is ${violation.lineCount} lines ` +
          `(max ${MAX_COMMENT_LINES}). Condense it — deep rationale belongs in the commit message.`,
      );
    }
  }

  return { failures, files };
}

export function reportCommentLengthCheck(
  { failures, files },
  { logger = console, runtime = process } = {},
) {
  if (failures.length) {
    logger.error(failures.join("\n"));
    runtime.exitCode = 1;
    return false;
  }
  logger.log(`Comment-length check passed for ${files.length} files.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportCommentLengthCheck(runCommentLengthCheck());
}
