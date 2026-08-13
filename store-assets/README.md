# Chrome Web Store assets

These files are uploaded to the Developer Dashboard and are not included in the extension ZIP.

## Ready

- `small-promo-440x280.png`: mandatory 440×280 small promotional tile.
- `../icons/icon128.png`: mandatory 128×128 store icon.

## Generated publication assets

- `small-promo-440x280-v2.png`: alternative generated small promo tile.
- `marquee-1400x560.png`: generated optional marquee tile.
- `screenshots/quick-whatsapp-contact-workflow.png`: generated workflow mockup.
- `screenshots/quick-whatsapp-contact-settings.png`: generated settings mockup.
- `screenshots/quick-whatsapp-contact-open-chat.png`: generated open-chat mockup.

The three mockups are already 1280x800 PNGs without alpha. They are promotional mockups, not captures of a running browser session. Replace them with real screenshots if Web Store review requires proof of the installed product UI.

## Real screenshot still required

Add one to five real product screenshots under `store-assets/screenshots/`. Each PNG must be exactly 1280×800 (preferred) or 640×400, full bleed, with square corners and no added padding.

Recommended first capture:

1. Build and load `dist/extension` from `chrome://extensions`.
2. Open a neutral local test page containing a visible `tel:` link.
3. Enable the optional page helpers and show the extension action beside that link.
4. Remove personal tabs, bookmarks, account avatars, notifications, and unrelated extensions from view.
5. Capture the actual 1280×800 viewport and save it as `store-assets/screenshots/01-auto-highlight-1280x800.png`.

Useful additional screenshots show the real popup, Settings, or onboarding tutorial. Do not use an AI-generated UI or stretch the tutorial images.

## Refreshed assets based on supplied real-interface screenshots

- `screenshots/real-ui-workflow-1280x800.png`
- `screenshots/real-ui-popup-1280x800.png`
- `screenshots/real-ui-chat-flow-1280x800.png`
- `small-promo-real-ui-440x280.png`
- `marquee-real-ui-1400x560.png`

These are generated promotional compositions based on the supplied screenshots. They preserve the extension's dark popup, Portugal selector, green Send action, confirmation page, and chat flow. All are RGB PNGs without alpha and have exact Web Store dimensions.

Run `npm run validate:store` after adding the screenshot and replacing the support-email placeholders.
