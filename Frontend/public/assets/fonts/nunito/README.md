# Nunito font trial

Unmodified, full-character-set variable fonts from the Google Fonts repository:

- https://github.com/google/fonts/tree/main/ofl/nunito
- Normal: https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf
- Italic: https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito-Italic%5Bwght%5D.ttf

Downloaded 2026-10-24. Licensed under SIL Open Font License 1.1; see OFL.txt.
Both files include Vietnamese and are served locally, not from Google at runtime.
The UI uses weights 400–700; the original variable font files are not subsetted.

## Return to the previous font

Remove only `@import './nunito.css';` from `src/styles/index.css`.
The previous `fonts.css`, theme styles, Segoe UI fallback, and Be Vietnam Pro
assets are preserved. No component markup needs changing.

## Offline asset checks

Run `node --test src/styles/nunito.test.mjs` from Frontend. This checks the
actual TrueType Unicode maps (Vietnamese NFC/NFD), variable weight ranges,
local CSS URLs, and the rollback import without adding Node typings or other
dependencies to the browser application. It does not verify browser rendering.
