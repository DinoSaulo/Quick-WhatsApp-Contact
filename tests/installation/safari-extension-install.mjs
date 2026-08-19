// Safari counterpart to extension-install.mjs/firefox-extension-install.mjs — with a steeper
// platform gap than either: this only smoke-tests Playwright's bundled WebKit engine.

// Playwright's webkit is a Microsoft-maintained WebKit build, not Safari.app, and never goes
// through safaridriver — nor can it load browser extensions at all (Chromium-only feature).

// So it never opens scripts/convert-safari-extension.mjs's .app and never loads the extension —
// an explicit, informed trade-off the project owner asked for, not a shortcut taken silently.

// No retry loop, unlike the Chrome pinned job: that retry targets a SIGSEGV in a separately
// downloaded binary. This launches Playwright's own managed WebKit download instead.
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { webkit } from "playwright";

const projectRoot = resolve(import.meta.dirname, "../..");
const diagnosticsRoot = resolve(projectRoot, "ci-diagnostics");
const safariLogFile = resolve(diagnosticsRoot, "safari.log");

function log(line) {
  console.log(line);
  mkdirSync(diagnosticsRoot, { recursive: true });
  writeFileSync(safariLogFile, `${line}\n`, { flag: "a" });
}

let browser;
let testSucceeded = false;

try {
  log("🚀 Launching Playwright's bundled WebKit (not Safari.app — see header comment)...");
  browser = await webkit.launch();

  const page = await browser.newPage();
  await page.goto("about:blank");
  const title = await page.title();
  const url = page.url();

  assert.equal(url, "about:blank");
  assert.equal(typeof title, "string");
  log(`✅ WebKit page is alive — navigated to "${url}", title: "${title}"`);

  // Extension check: not performed. Playwright's webkit never touches the converted .app or any
  // extension, so there is no signal to check here, informational or otherwise — see header.
  log("⚠️  Extension check: not applicable — this run only proves WebKit itself launches.");

  testSucceeded = true;
  log("✅ WebKit engine smoke test passed (browser launch + page navigation only).");
} catch (error) {
  console.error("❌ Test failed:", error);
  log(`❌ Failure: ${error.message}`);
  throw error;
} finally {
  console.log("🔒 Closing WebKit browser...");
  try {
    await browser?.close();
  } catch {
    // Ignored — best-effort cleanup, must never mask the real test result.
  }
  if (testSucceeded) {
    rmSync(diagnosticsRoot, { recursive: true, force: true });
  }
}
