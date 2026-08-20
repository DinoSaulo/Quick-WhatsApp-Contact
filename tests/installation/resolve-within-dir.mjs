// Second line of defense (after each script's own version-format regex): resolves the segments
// and rejects the result if canonicalization walked it outside baseDir via "..".
import { resolve, sep } from "node:path";

export function resolveWithinDir(baseDir, ...segments) {
  const base = resolve(baseDir);
  const target = resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`Refusing to use path outside ${base}: ${target}`);
  }
  return target;
}
