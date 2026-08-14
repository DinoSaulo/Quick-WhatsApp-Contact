# Security Audit Report — Quick WhatsApp Contact

**Audit date**: 2026-08-14
**Auditor**: Claude Code, independent review (source inspection + local execution, no network attacks)
**Scope**: Full repository — Manifest V3 Chrome/Firefox extension, build/CI tooling, no backend
**Related**: `docs/THREAT_MODEL.md` (living threat model, updated as part of this audit with a new
"Security Invariants" section); `SECURITY_AUDIT-codex.md` (a prior independent audit already present
in the working tree — this report was produced independently and cross-checked against it, not by
copying it; both arrive at the same conclusion through separately verified evidence)

---

## 1. Executive summary

**Quick WhatsApp Contact** is a client-only Manifest V3 browser extension (Chrome + Firefox) with
**no backend, no database, no user accounts, and zero runtime npm dependencies**. Its only job is to
turn a phone number (typed, selected on a page, or from a `tel:` link) into a `https://wa.me/...`
URL the browser opens in a new tab when the user asks for it.

Because there is no server, no database, and no authentication system, most of the standard web/API
audit categories (SQLi, IDOR, JWT handling, CORS, SSRF, rate limiting, session cookies, webhook
signatures, etc.) are **not applicable** — there is no such surface in this codebase. The audit
therefore concentrated on what actually applies to a browser extension: manifest permission scope,
extension messaging trust boundaries, DOM-based XSS, storage isolation, network egress, and supply
chain.

### Overall posture: **Strong**

- Manifest V3, permissions limited to `["contextMenus", "scripting", "storage"]` — no `tabs`, no
  `<all_urls>` at install time.
- Broad page access (`http://*/*`, `https://*/*`) is **optional**, requested at runtime only when
  the user opts into the auto-highlight feature, and content scripts are registered/unregistered
  dynamically to match.
- Restrictive extension-page CSP (`script-src 'self'`, no `unsafe-inline`/`unsafe-eval`,
  `frame-ancestors 'none'`, `base-uri 'self'`).
- No `externally_connectable` — the message listener is unreachable from arbitrary web pages or
  other extensions — and the listener itself independently validates `sender.id`/`sender.tab`
  as defense-in-depth rather than relying on that alone.
- Every `innerHTML` sink in `src/` renders only static i18n strings, statically-defined data
  (`COUNTRIES`, `TUTORIAL_STEPS`, `DONATION_METHODS`), or values that have already passed through
  an allow-list resolver (`getCountryByCode`, `normalizeSelectedNumber`) or `escapeHtml()`. None
  interpolate a raw string from `chrome.storage`, a query parameter, or page content.
- Content scripts (`autoHighlight.js`, `selectionButton.js`) never touch an HTML sink — every DOM
  node is built with `document.createElement` + property assignment.
- Zero runtime dependencies; `npm audit --omit=dev` reports 0 vulnerabilities.
- No secrets, API keys, or private credentials anywhere in source, tests, or the built package.
  `src/utils/donation.js` contains a PayPal email and a PIX/Revolut payload — these are the
  developer's own, intentionally public donation-receiving details (the same information already
  published in the project's README/store listing), not a credential.
- No `fetch`/`XMLHttpRequest` anywhere in shipped code — the only network egress is
  `chrome.tabs.create({ url: "https://wa.me/..." })`, always HTTPS, always user-initiated.
- CI (`.github/workflows/ci.yml`) runs on least-privilege `permissions: contents: read` by default,
  elevating to `contents: write` only in the release job; no `pull_request_target`, no untrusted
  input interpolated into a shell step.

### Findings by severity

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational / Defense-in-depth | 2 (both implemented in this audit) |

**No exploitable vulnerability was found or fixed in this audit.** The two changes made are
preventive guardrails (Finding IDs `INF-1` and `INF-2` below), not fixes for live bugs.

### Verification performed and results

```
npm run verify   # lint + lint:sast + validate:extension + full test suite + build
  → Syntax check passed for 62 JavaScript files.
  → eslint . → 0 violations (no-unsanitized + eslint-plugin-security)
  → Extension validation passed (20 runtime files inspected).
  → Test Files  29 passed (29) / Tests  348 passed (348)
  → Build: Extension 1.0.0 built at dist/extension (215 local Twemoji assets)

npm audit --omit=dev
  → found 0 vulnerabilities

git log --all --diff-filter=A --name-only | grep -iE "\.env|secret|credential|\.pem|\.key"
  → no matching files ever committed

grep for AWS keys / PEM blocks / api_key=.../ Bearer tokens / sk-... across src, tests, dist
  → no matches (the only regex hit anywhere in the repo is the pattern definitions themselves,
    inside the pre-existing SECURITY_AUDIT-codex.md documentation)

dist/extension inspection
  → no eval/new Function, no source maps, no secrets
```

All of the above were executed locally in this repository; none required network access to a
production system.

---

## 2. Architecture and threat model

*(Full detail already lives in `docs/THREAT_MODEL.md`, which this audit extended with a new
"Security Invariants" section — see §4. Summary below.)*

### Components

| Component | Privilege | Role |
|---|---|---|
| `src/background.js` (service worker) | Highest — the only context that opens tabs, reads/writes `chrome.storage`, registers content scripts | Message routing, context menu, tab opening |
| `src/popup/*`, `src/options/*`, `src/onboarding/*` | Extension-page (chrome-extension:// origin, own CSP) | User-facing UI, all built with native Web Components |
| `src/content/autoHighlight.js`, `selectionButton.js` | Runs in an **optional**, user-granted origin (`http(s)://*/*`), isolated JS world | Detects `tel:` links / phone-like selections, asks the background page to act |
| `chrome.storage.sync` | Semi-trusted (own writes, but syncs across devices and is DevTools-editable) | User preferences |
| `chrome.storage.session` | Semi-trusted, single-consumption handoff | Pending number/country between popup ↔ ddi screen, pending donation-modal-open flag |

### Trust boundaries

1. **Web page ↔ content script** — content scripts read `tel:` hrefs and user text selections from
   an attacker-controlled DOM. Both are validated with a digit-count/character-class regex
   (`isLikelyPhoneText` / `isLikelyPhoneSelection`) before ever being sent onward; no DOM string
   from the page is ever assigned to an HTML sink.
2. **Content script ↔ service worker** — the only privileged channel. Guarded by the manifest
   (no `externally_connectable`) **and**, redundantly, by the listener itself
   (`sender.id === chrome.runtime.id && sender.tab`).
3. **Storage ↔ UI** — `chrome.storage.sync` is technically writable outside the extension's own
   code path (DevTools, a corrupted sync payload). Every read site resolves the value through a
   static allow-list (`getCountryByCode`) before it reaches an HTML attribute, so a corrupted value
   degrades to a safe default instead of injecting markup.
4. **Extension ↔ WhatsApp** — the only sanctioned network egress, always `https://wa.me/`, always
   built from a number that already passed `isValidPhoneForSend` (8–15 digits, no other characters).

### Sensitive assets

- The user's own phone numbers/messages, transient and only ever sent where the user explicitly
  asked (WhatsApp).
- Extension preferences (language, theme, default country) — not sensitive.
- The developer's own public donation-receiving details — intentionally public, not a secret asset.

There is no account system, no cross-user data, and no database, so most "impact of compromise"
scenarios in the standard prompt template (tenant isolation, IDOR, privilege escalation between
users) do not have an analog here. The realistic worst case for this extension is a **DOM XSS
inside an extension page** (popup/options/onboarding) reached via a corrupted `chrome.storage.sync`
value or malicious page content — which is exactly the class of bug the SAST config
(`eslint-plugin-no-unsanitized`) and the innerHTML sink review in §3 exist to prevent, and which
this audit found to already be closed at every sink.

---

## 3. Findings

### INF-1 — No regression guard against a future `optional_permissions` grant

- **Severity**: Informational (defense-in-depth)
- **Confidence**: High
- **Status**: ✅ Fixed (guardrail added)
- **Files**: `tests/manifest.test.js`, `scripts/validate-extension.mjs`
- **CWE**: CWE-250 (Execution with Unnecessary Privileges)

**Description**: `manifest.json` never declares `optional_permissions` (the manifest key for
non-host runtime-requestable APIs — `clipboardRead`, `clipboardWrite`, `tabs`, `nativeMessaging`,
`management`, `debugger`, `identity`, `proxy`, `webRequest`, etc.). The existing test suite pinned
`permissions` and `optional_host_permissions` with exact-equality assertions, so either of those
growing silently already fails CI — but nothing asserted that `optional_permissions` stays absent,
so a future PR could add e.g. `clipboardRead` to that key without any test catching the scope
increase.

**Attack path (theoretical, not exploited)**: A future contributor (human or LLM-assisted) adds
`"optional_permissions": ["clipboardRead"]` while implementing an unrelated feature; nothing in CI
flags the new attack surface for review before merge.

**Fix**: Added an exact assertion that `manifest.optional_permissions` is `undefined`, in both the
Vitest suite (`tests/manifest.test.js`) and the build-time validator
(`scripts/validate-extension.mjs`, which already asserted the equivalent for
`externally_connectable`). Introducing the key now requires deliberately updating this assertion,
which forces a reviewed decision instead of a silent scope increase.

**Tests added**: `tests/manifest.test.js` → `"does not declare optional_permissions, keeping every
requestable API on the reviewed allowlist"`. Verified failing against a manifest with
`optional_permissions` set, passing against the current manifest (348/348 total suite passing after
the change).

### INF-2 — No durable "Security Invariants" reference

- **Severity**: Informational (documentation/process)
- **Confidence**: High
- **Status**: ✅ Fixed
- **Files**: `docs/THREAT_MODEL.md`

**Description**: `docs/THREAT_MODEL.md` already documented the audited vectors and fixes narratively,
but had no compact, rule-form summary a future contributor (or an LLM making changes) could scan in
a few seconds before touching security-relevant code.

**Fix**: Added a "Security Invariants" section (§8 of that document) listing the six durable rules
this codebase must keep holding — no `externally_connectable`/`optional_permissions`, sender
validation on every privileged message handler, network egress restricted to `https://wa.me/`,
allow-listed data only in `innerHTML` sinks, no bundled private credentials, and "every security fix
gets a regression test" — each cross-referenced to the test file that enforces it. This repo has no
`AGENTS.md`; `docs/THREAT_MODEL.md` is the existing, purpose-built home for this content, so the
section was added there instead of creating a new file.

### Verified-safe areas (no finding — audit evidence recorded for completeness)

The following were specifically checked per the audit's required categories and found already
correctly handled, each backed by an existing, passing, behavioral (not tautological) regression
test:

| Area | Evidence |
|---|---|
| Message sender spoofing | `tests/background.integration.test.js` sends messages with wrong `sender.id` / missing `sender.tab` / hostile `<script>`/`<img onerror>` payloads as `selectionText` and asserts no tab opens and no storage write occurs |
| DOM XSS via corrupted synced storage | `tests/options.integration.test.js` seeds `defaultCountry` with `'"><img src=x onerror=alert("xss")>'` and asserts no `img[onerror]` renders and the hidden input stays a 2-letter code |
| DOM XSS via query string | `tests/ddi.integration.test.js` covers `?number=` with injected markup |
| Donation modal HTML/attribute escaping + link scheme allow-list | `tests/donationModalEscaping.test.js` |
| Tabnabbing (`target="_blank"` without `rel="noopener"`) | `tests/security.test.js`, codebase-wide sweep over every `.html`/`.js` in `src/`, not a per-file list |
| Network egress restricted to `https://wa.me/` | `tests/networkSecurity.test.js` |
| Manifest permission/CSP allowlist | `tests/manifest.test.js` (now also covering `optional_permissions`, see INF-1) |
| Hardcoded secrets | `tests/security.test.js`, PEM/AWS-key/credential-assignment regex sweep over all of `src/` |
| Build/CI script injection | `scripts/install-chrome-version.mjs` / `install-firefox-version.mjs` use `execFileSync` with argument arrays (never a shell string), fetch only from `googlechromelabs.github.io` / Mozilla's own release archive, and only act on a version string matched against that catalog's own data — no unsanitized interpolation |
| CI privilege scope | `.github/workflows/ci.yml` — `permissions: contents: read` at the workflow level, `contents: write` only in the `release` job, gated to `push` on `main` |

---

## 4. Tests and automated controls

### Existing security-relevant test/tooling inventory (verified, not just claimed)

| Command | What it runs |
|---|---|
| `npm test` | Full Vitest suite — 348 tests across 29 files |
| `npm run test:security` | `tests/security.test.js`, `tests/networkSecurity.test.js`, `tests/manifest.test.js`, `tests/donationModalEscaping.test.js` |
| `npm run lint:sast` | ESLint with `eslint-plugin-no-unsanitized` (errors on any new/unjustified `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`) and `eslint-plugin-security` |
| `npm run validate:extension` | `scripts/validate-extension.mjs` — manifest allowlist assertions, forbidden-pattern sweep (`eval`, `new Function`, remote `<script src>`, remote dynamic `import()`), runtime-dependency check |
| `npm run verify` | Runs all of the above plus the syntax check and the build, in sequence — this is the command to run before any PR |
| `npm audit --omit=dev` | Production dependency vulnerability scan (0 runtime deps → 0 findings) |

### Changes made in this audit

- `tests/manifest.test.js`: +1 test (`optional_permissions` absence, INF-1).
- `scripts/validate-extension.mjs`: +1 assertion (same invariant, enforced at build-validation time
  too, not just in the test suite).
- `docs/THREAT_MODEL.md`: +1 section ("Security Invariants", INF-2).

No existing test was weakened, skipped, or had its assertions loosened. No lint rule was suppressed.
`npm run verify` passes clean after the changes (348/348 tests, 0 lint violations, build succeeds).

### Commands to run the complete security suite

```bash
npm ci
npm run verify          # full gate: lint, SAST, extension validation, tests, build
npm run test:security   # security-focused subset only
npm audit --omit=dev    # production dependency advisories
```

---

## 5. Manual actions required

None are security-critical. Two pre-existing, non-security items surfaced during review:

1. **`PRIVACY.md` has a placeholder support email** (`<!-- TODO(owner): substituir pelo e-mail de
   suporte antes de enviar à Chrome Web Store. -->`). This is a store-listing completeness gap, not
   a vulnerability — flagging it because Chrome Web Store submission requires a real contact before
   publishing.
2. **Dev-only dependency advisory**: `puppeteer-core@24.8.1` → `@puppeteer/browsers` →
   `extract-zip` carries a symlink-traversal advisory (test-only, never shipped; `npm audit
   --omit=dev` confirms 0 production vulnerabilities). Optional: upgrade `puppeteer-core` to v25+
   when convenient — it's a breaking change, so it wasn't done automatically in this audit.

No credentials require rotation — none were found. No Git-history cleanup is needed — history was
checked and contains no secret files or credential commits.

---

## 6. Conclusion

This audit independently re-derived the same conclusion a prior audit pass already reached
(`SECURITY_AUDIT-codex.md`, present in the working tree): the extension has a small, well-understood
attack surface for its category (no backend, zero runtime dependencies), every trust boundary that
applies to a Manifest V3 extension is enforced with both a runtime check and a regression test, and
`npm run verify` / `npm audit --omit=dev` both pass clean. Two defense-in-depth guardrails were added
(`optional_permissions` allowlist enforcement, and a "Security Invariants" reference section) to keep
that posture from eroding silently in future changes — nothing else required remediation.
