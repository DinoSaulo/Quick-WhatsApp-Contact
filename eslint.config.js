// Security-focused static analysis (SAST), separate from scripts/check-source.mjs (syntax-only
// lint run by `npm run lint`). This config exists to catch the vulnerability classes an
// extension security audit cares about most — see docs/THREAT_MODEL.md:
//   - eslint-plugin-no-unsanitized: flags DOM XSS sinks (innerHTML/outerHTML/insertAdjacentHTML/
//     document.write) fed anything other than a string literal, so any *new* dynamic sink has to
//     be deliberately reviewed and either sanitized or explicitly justified inline — it cannot
//     land silently.
//   - eslint-plugin-security: flags Node-side risk patterns (unsafe regex, dynamic require/eval,
//     non-literal fs paths) most relevant to the build/dev scripts in scripts/ and tests/.
// Run with `npm run lint:sast`. Every finding in src/ at the time this config was added was
// hand-reviewed and left with an inline eslint-disable-next-line explaining why the sink is
// safe (allow-list sanitized upstream, or escaped) — see those comments for the actual audit
// reasoning, not this file.
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
      // High false-positive rate on any obj[key] access (bracket notation into a plain object
      // or Map-like lookup) — this codebase uses it for static, developer-controlled lookups
      // only (e.g. getCountryByCode, i18n DICTIONARY[language]), never with untrusted keys.
      // See eslint-plugin-security's own docs for why this rule is commonly disabled project-wide.
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
