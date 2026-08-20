// The two testable pieces behind scripts/check-comment-length.mjs, pulled out so they can be
// unit tested by importing them directly (see tests/commentLengthChecker.test.js).
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

export function collectFiles(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.name === "node_modules") return [];
    if (entry.isDirectory()) return collectFiles(entryPath, extensions);
    return extensions.includes(extname(entry.name)) ? [entryPath] : [];
  });
}

export function findOverlongCommentBlocks(lines, { isYaml, maxLines }) {
  const violations = [];

  let blockStartLine = null;
  let blockLineCount = 0;
  let inBlockComment = false;

  const flush = (endIndex) => {
    if (blockStartLine !== null && blockLineCount > maxLines) {
      violations.push({ startLine: blockStartLine, endLine: endIndex + 1, lineCount: blockLineCount });
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

  return violations;
}
