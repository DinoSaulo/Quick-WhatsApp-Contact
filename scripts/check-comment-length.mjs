import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

// Project convention: no comment may span more than 2 lines — keeps rationale terse enough to
// actually get read. Deep root-cause narratives belong in commit messages/git history, not here.
const MAX_COMMENT_LINES = 2;

const projectRoot = resolve(import.meta.dirname, "..");
const jsRoots = ["src", "scripts", "tests", "docs"];
const yamlRoots = [".github"];

function collectFiles(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.name === "node_modules") return [];
    if (entry.isDirectory()) return collectFiles(entryPath, extensions);
    return extensions.includes(extname(entry.name)) ? [entryPath] : [];
  });
}

const jsFiles = jsRoots.flatMap((root) => collectFiles(resolve(projectRoot, root), [".js", ".mjs"]));
const yamlFiles = yamlRoots.flatMap((root) => collectFiles(resolve(projectRoot, root), [".yml", ".yaml"]));

// Also check the two top-level config files that carry the same kind of explanatory comments.
const extraFiles = ["eslint.config.js"].map((name) => resolve(projectRoot, name));

const files = [...jsFiles, ...yamlFiles, ...extraFiles];
const failures = [];

for (const file of files) {
  const isYaml = file.endsWith(".yml") || file.endsWith(".yaml");
  const lines = readFileSync(file, "utf8").split("\n");

  let blockStartLine = null;
  let blockLineCount = 0;
  let inBlockComment = false;

  const flush = (endIndex) => {
    if (blockStartLine !== null && blockLineCount > MAX_COMMENT_LINES) {
      failures.push(
        `${file}:${blockStartLine}-${endIndex + 1} — comment block is ${blockLineCount} lines ` +
          `(max ${MAX_COMMENT_LINES}). Condense it — deep rationale belongs in the commit message.`,
      );
    }
    blockStartLine = null;
    blockLineCount = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (inBlockComment) {
      blockLineCount++;
      if (trimmed.includes("*/")) {
        inBlockComment = false;
        flush(i);
      }
      continue;
    }

    if (!isYaml && /^\/\*/.test(trimmed) && !trimmed.includes("*/")) {
      flush(i - 1);
      blockStartLine = i + 1;
      blockLineCount = 1;
      inBlockComment = true;
      continue;
    }

    const isLineComment = isYaml ? /^#/.test(trimmed) : /^\/\//.test(trimmed);

    if (isLineComment) {
      if (blockStartLine === null) blockStartLine = i + 1;
      blockLineCount++;
    } else {
      flush(i - 1);
    }
  }
  flush(lines.length - 1);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Comment-length check passed for ${files.length} files.`);
