# London & Caro Trainer

A chill, campfire-lit opening trainer for my repertoire:

- **London System** as White (early `2.Bf4`, Banzea-style)
- **Caro-Kann** against 1.e4
- **King's Indian** against 1.d4

You play your side, the trainer plays the opponent. **Learn** mode shows arrows and explains every key move; **Drill** mode hides them and counts mistakes (3 clean runs in a row = mastered). After the quizzed part (around move 10–15) you can press **Play ideas ▶** to watch how the game typically continues to about move 20.

Lines are built from IM Alex Banzea's own games (chess.com `alex_banzea`), mainstream theory, and checked with Stockfish. Pieces are the cburnett set used on Lichess.

## Play it

- **Online:** https://newfreshhorizonx.github.io/london-caro-trainer/ (GitHub Pages; works on phone too)
- **Offline:** download the repo and double-click `index.html`. No install, no server.

Progress is saved in your browser.

## Project layout

```
index.html          page shell — loads everything below
css/style.css       look & feel (colors are tokens at the top; light + dark theme)
js/app.js           trainer logic: board, quiz, review, PGN export
js/vibe.js          pixel campfire + generated lofi loop
js/vendor/chess.js  move rules (chess.js 0.10.3, BSD licence)
lines/london.js     ← the repertoire lines, one file per tab
lines/caro.js
lines/kid.js
img/pieces/         piece images (cburnett, CC BY-SA 3.0)
tools/validate.js   checks every line is legal and every note points at a real move
tools/engine.js     optional Stockfish helpers (best move / extend a line / check for blunders)
```

## Editing lines

Every line in `lines/*.js` looks like this:

```js
{
  "id": "l-bd6-exf4",                       // unique, never shown
  "group": "Main setup (…d5 & …e6)",        // heading in the sidebar
  "name": "…Bd6: let him take, exf4 & Ne5", // title in the sidebar
  "moves": "1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Nf3 Bd6 5.Bd3 Bxf4 6.exf4 O-O ...",
  "quizTo": "10.Ne5",                       // quiz stops after this move; the rest plays as "ideas"
  "notes":  { "6.exf4": "Take with the e-pawn ..." },
  "arrows": { "6.exf4": "g:f4e5 g:e1e8" },  // g = green (my plan), r = red (their threat), b = blue (other idea)
  "alsoGood": { "5.Bg3": "Bg3 is fine too ..." }, // friendly yellow note instead of a mistake
  "engineOk": { "7.O-O": ["c3", "Nbd2"] }   // auto-generated alternatives; safe to edit or delete
}
```

- **Move labels** are the move number plus the move, exactly as in `moves`: `"9.Ne5"` for White, `"9...Bb7"` for Black.
- **Add a line:** copy an existing one, give it a new `id`, change `moves`, notes and arrows.
- **Remove a line:** delete its `{ ... }` block (mind the commas).
- **Add a whole new tab** (for example the Scandinavian): copy `lines/kid.js` to `lines/scandi.js`, change `REPERTOIRES.kid` to `REPERTOIRES.scandi`, set `label` and `side` (`"w"` or `"b"`), and add `<script src="lines/scandi.js"></script>` to `index.html`.

Then check your work:

```bash
node tools/validate.js
```

It tells you exactly which move is illegal or which note doesn't match. The same check runs automatically on GitHub for every push (Actions → "Check lines"). If a line is broken, the app skips that line, shows a red message at the top, and keeps working.

## Engine helpers (optional)

Download Stockfish from https://stockfishchess.org/download/ and run:

```bash
STOCKFISH=/path/to/stockfish node tools/engine.js best   "1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Nf3 Bd6"
STOCKFISH=/path/to/stockfish node tools/engine.js extend "1.e4 c6 2.f4 d5 3.e5 c5" 20
STOCKFISH=/path/to/stockfish node tools/engine.js check  "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nf6 5.Ng5 h6 6.Nxf7 Kxf7"
```

## Credits

- Piece set: cburnett, CC BY-SA 3.0 (via Lichess)
- Move generation: [chess.js](https://github.com/jhlywa/chess.js) (BSD 2-Clause)
- Repertoire inspired by IM Alex Banzea's games and videos
