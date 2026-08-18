// Security-focused static analysis (SAST, `npm run lint:sast`) — catches DOM XSS sinks and
// Node-side risk patterns. See docs/THREAT_MODEL.md and inline eslint-disable-next-line comments.
import noUnsanitized from "eslint-plugin-no-unsanitized";
import security from "eslint-plugin-security";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "assets/**",
      "icons/**",
      "store-assets/**",
      "docs/**",
      "coverage/**"
    ]
  },
  {
    files: ["src/**/*.js"],
    plugins: { "no-unsanitized": noUnsanitized, security },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      "no-unsanitized/property": "error",
      "no-unsanitized/method": "error",
      ...security.configs.recommended.rules,
      // High false-positive rate on obj[key] access; this codebase only uses it for static,
      // developer-controlled lookups (getCountryByCode, i18n DICTIONARY[language]), never untrusted keys.
      "security/detect-object-injection": "off"
    }
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.js", "eslint.config.js"],
    plugins: { security },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      ...security.configs.recommended.rules,
      "security/detect-object-injection": "off",
      // scripts/ and tests/ read paths built from this repo's own constants
      // (import.meta.dirname, resolve(projectRoot, "src")), never from network/user input.
      "security/detect-non-literal-fs-filename": "off"
    }
  }
];
