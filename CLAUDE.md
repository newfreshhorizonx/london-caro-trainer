# Notes for Claude

Static site, no build step, no dependencies to install. Hosted on GitHub Pages from `main`.

- Repertoire data lives in `lines/*.js`; each file sets `REPERTOIRES.<key> = { label, side, lines: [...] }`. The field format is documented in README.md ("Editing lines").
- Notes, arrows, `alsoGood` and `quizTo` are keyed by move labels like `"9.Ne5"` / `"9...Bb7"`. If you change a line's `moves`, update those keys too.
- After any change to `lines/`, run `node tools/validate.js` and fix every error before committing. CI runs the same check.
- New tab = new file in `lines/` + a `<script>` tag in `index.html` (before `js/app.js`).
- `js/app.js` compiles the line files at load time (top of the file) and contains all trainer logic. Keep the page working when opened straight from disk (`file://`): no `fetch`, no ES modules.
- Styling: tokens at the top of `css/style.css`, with light and dark variants. Keep both themes working.
- New lines should be sound: check them with `tools/engine.js check` when Stockfish is available, and prefer moves real players choose over pure engine moves.
- The lofi loop in `js/vibe.js` is generated with Web Audio. Don't add copyrighted songs or audio files.
