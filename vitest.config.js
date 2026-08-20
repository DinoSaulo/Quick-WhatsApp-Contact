import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.js", "scripts/**/*.js", "scripts/**/*.mjs"],
      // CLI scripts with real side effects (network, process.exit) — exercised for real by the
      // installation CI jobs, not importable for unit tests without triggering those effects.
      exclude: [
        "scripts/ralph-loop.ps1",
        "src/**/*.css",
        "scripts/install-chrome-version.mjs",
        "scripts/install-firefox-version.mjs"
      ]
    }
  }
});
