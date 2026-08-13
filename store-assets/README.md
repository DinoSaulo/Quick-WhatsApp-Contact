# Chrome Web Store assets

These files are uploaded to the Developer Dashboard and are not included in the extension ZIP.

## Ready

- `small-promo-440x280.png`: mandatory 440×280 small promotional tile.
- `../icons/icon128.png`: mandatory 128×128 store icon.

## Real screenshot still required

Add one to five real product screenshots under `store-assets/screenshots/`. Each PNG must be exactly 1280×800 (preferred) or 640×400, full bleed, with square corners and no added padding.

Recommended first capture:

1. Build and load `dist/extension` from `chrome://extensions`.
2. Open a neutral local test page containing a visible `tel:` link.
3. Enable the optional page helpers and show the extension action beside that link.
4. Remove personal tabs, bookmarks, account avatars, notifications, and unrelated extensions from view.
5. Capture the actual 1280×800 viewport and save it as `store-assets/screenshots/01-auto-highlight-1280x800.png`.

Useful additional screenshots show the real popup, Settings, or onboarding tutorial. Do not use an AI-generated UI or stretch the tutorial images.

Run `npm run validate:store` after adding the screenshot and replacing the support-email placeholders.
