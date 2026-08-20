// The testable pure pieces behind scripts/convert-safari-extension.mjs — everything else in that
// script is direct xcrun/xcodebuild orchestration, which needs a real macOS+Xcode toolchain to run.

// Sanitizes appName into the bundle ID's last component. Regression coverage for a real CI
// failure where a wrongly-fixed suffix made the host app and its .Extension cousins, not parent/child.
export function buildSafariBundleId(bundleIdBase, appName) {
  return `${bundleIdBase}.${appName.replace(/\s+/g, "-")}`;
}

// `find ... | filter(Boolean)`: trailing-newline splits leave one empty string filter drops here.
export function parseFindOutput(rawOutput) {
  return rawOutput.split("\n").filter(Boolean);
}
