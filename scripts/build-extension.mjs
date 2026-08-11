import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "dist", "extension");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));

rmSync(resolve(projectRoot, "dist"), { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const entry of ["manifest.json", "src", "icons"]) {
  cpSync(resolve(projectRoot, entry), resolve(outputRoot, entry), { recursive: true });
}

writeFileSync(
  resolve(projectRoot, "dist", "BUILD_INFO.txt"),
  `Quick WhatsApp Contact ${manifest.version}\nBuilt at ${new Date().toISOString()}\n`,
  "utf8"
);

console.log(`Extension ${manifest.version} built at ${outputRoot}`);
