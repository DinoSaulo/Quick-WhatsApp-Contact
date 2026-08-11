# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                               # run all tests (vitest)
npx vitest run tests/phone.test.js    # run a single test file
```

There is no build step — the extension is loaded directly in Chrome via "Load unpacked" from the project root. The manifest is at `manifest.json`.

## Architecture

**Quick WhatsApp Contact** is a Manifest V3 Chrome extension that lets users open WhatsApp from any phone number found on a web page. It is written in vanilla JS with no bundler or framework.

### Entry points

| File | Role |
|---|---|
| `src/popup/popup.html` + `popup.js` | Main popup — manual number entry with country picker |
| `src/popup/ddi.html` + `ddi.js` | Secondary screen opened when a selected number lacks a country code |
| `src/options/options.html` + `options.js` | Settings page (auto-highlight, dark mode, language, default country) |
| `src/background.js` | Service worker — context menu, message routing, WhatsApp tab opening |
| `src/content/autoHighlight.js` | Injects WhatsApp buttons next to `<a href="tel:">` links |
| `src/content/selectionButton.js` | Shows floating WhatsApp button when user selects phone-like text |

### UI pattern
All UI is built with native **Web Components** (`class Foo extends HTMLElement` + `customElements.define`). Each component has a `connectedCallback` that loads settings, calls `render()` (sets `this.innerHTML`), then `bindEvents()`.

### Utils layer (`src/utils/`)

| File | Responsibility |
|---|---|
| `countries.js` | `COUNTRIES` array (code, dialCode, flag, phoneMask), `getCountryByCode`, locale→country helpers |
| `phone.js` | Sanitize, mask (`applyPhoneMask`/`getPhoneMaskPlaceholder`), validate, build WhatsApp URL |
| `phoneFormats.js` | `PHONE_FORMAT_RULES_BY_DDI` — maps dial codes to valid local-number patterns (X = digit) |
| `storage.js` | All `chrome.storage.sync` reads/writes; `getSettings()` is the single source of truth for settings |
| `i18n.js` | Static `DICTIONARY` for `en-US` / `pt-BR`; `getMessages(lang)` and `t(messages, key, params)` |
| `location.js` | Detect country from `navigator.languages` or page URL TLD |

### Country resolution priority (popup & ddi)
`defaultCountry (settings) → storedCountry (last used) → languageDefault → detectedCountry → "US"`

### Phone mask format
`phoneMask` in `countries.js` uses spaces as visual separators; every non-space character is a digit slot. `applyPhoneMask` strips non-digits and re-inserts them at those slots. Phone *validation* uses the separate `PHONE_FORMAT_RULES_BY_DDI` table (patterns with `X` placeholders).

### Storage keys
All keys are prefixed `quick-whatsapp-contact.` and live in `chrome.storage.sync` except pending-context keys which use `chrome.storage.session` (consumed once by the popup, then removed).
