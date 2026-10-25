#!/usr/bin/env node
// Optional Stockfish helpers for building new lines. Needs a Stockfish binary:
//   STOCKFISH=/path/to/stockfish node tools/engine.js <command> "<moves>" [options]
//
// Commands
//   best    "<moves>"            top 5 engine moves in that position, with evaluation (White's view, in pawns)
//   extend  "<moves>" [toMove]   continue the line with engine moves up to move N (default 20)
//   check   "<moves>"            flag moves where the evaluation swings by more than 0.7
//
// Example:
//   STOCKFISH=./stockfish node tools/engine.js best "1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Nf3 Bd6"
const { spawn } = require("child_process");
const { Chess } = require("../js/vendor/chess.js");

const SF = process.env.STOCKFISH || "stockfish";
const [, , cmd, movesArg = "", opt] = process.argv;
if (!cmd) { console.log("Usage: node tools/engine.js best|extend|check \"<moves>\" [toMove]"); process.exit(1); }

class Engine {
  constructor() {
    this.p = spawn(SF); this.buf = ""; this.cb = null;
    this.p.on("error", () => { console.error(`Couldn't start Stockfish ("${SF}"). Set STOCKFISH=/path/to/stockfish.`); process.exit(1); });
    this.p.stdout.on("data", d => { this.buf += d; let i; while ((i = this.buf.indexOf("\n")) >= 0) { const l = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1); this.cb && this.cb(l); } });
    this.send("uci"); this.send("setoption name Threads value 4"); this.send("setoption name Hash value 256");
  }
  send(s) { this.p.stdin.write(s + "\n"); }
  analyse(fen, depth = 16, multipv = 1) {
    return new Promise(res => {
      const lines = {};
      this.cb = l => {
        if (l.startsWith("info") && l.includes(" pv ") && l.includes("multipv")) {
          const k = l.match(/multipv (\d+)/)[1], sc = l.match(/score (cp|mate) (-?\d+)/);
          lines[k] = { cp: sc[1] === "cp" ? +sc[2] : (+sc[2] > 0 ? 10000 : -10000), uci: l.split(" pv ")[1].split(" ")[0] };
        }
        if (l.startsWith("bestmove")) { this.cb = null; res(Object.keys(lines).sort((a, b) => a - b).map(k => lines[k])); }
      };
      this.send("setoption name MultiPV value " + multipv); this.send("position fen " + fen); this.send("go depth " + depth);
    });
  }
  quit() { this.send("quit"); }
}
const play = s => { const g = new Chess(); for (const t of s.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean)) if (!g.move(t, { sloppy: true })) { console.error(`Illegal move: ${t}`); process.exit(1); } return g; };
const san = (fen, uci) => { const g = new Chess(fen); const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" }); return m && m.san; };
const pgn = h => h.map((m, i) => (i % 2 ? "" : (i / 2 + 1) + ".") + m).join(" ");
const pawns = cp => (cp / 100 >= 0 ? "+" : "") + (cp / 100).toFixed(2);

(async () => {
  const e = new Engine();
  if (cmd === "best") {
    const g = play(movesArg), s = g.turn() === "w" ? 1 : -1;
    for (const r of await e.analyse(g.fen(), 18, 5)) console.log(`${san(g.fen(), r.uci).padEnd(7)} ${pawns(s * r.cp)}`);
  } else if (cmd === "extend") {
    const g = play(movesArg), to = +(opt || 20);
    while (g.history().length < to * 2) { const [r] = await e.analyse(g.fen(), 16); if (!r) break; g.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] }); }
    console.log(pgn(g.history()));
  } else if (cmd === "check") {
    const g = new Chess(), toks = movesArg.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean);
    let prev = null, flagged = 0;
    for (let i = 0; i <= toks.length; i++) {
      const [r] = await e.analyse(g.fen(), 14); const ev = (g.turn() === "w" ? 1 : -1) * r.cp;
      if (prev !== null && Math.abs(ev - prev) > 70) { flagged++; console.log(`${Math.floor((i - 1) / 2) + 1}${(i - 1) % 2 ? "..." : "."}${toks[i - 1]}: ${pawns(prev)} → ${pawns(ev)}`); }
      prev = ev; if (i < toks.length) g.move(toks[i], { sloppy: true });
    }
    console.log(flagged ? `${flagged} big swing(s).` : "No big swings.");
  } else console.log("Unknown command. Use best, extend or check.");
  e.quit();
})();
