#!/usr/bin/env node
// Checks every line file in lines/: moves are legal, and every note / arrow / alsoGood / quizTo
// points at a move that really exists in its line. Run:  node tools/validate.js
// No npm install needed — it uses the bundled chess.js.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { Chess } = require("../js/vendor/chess.js");

const root = path.join(__dirname, "..");
const ctx = { REPERTOIRES: {} };
vm.createContext(ctx);
const files = fs.readdirSync(path.join(root, "lines")).filter(f => f.endsWith(".js"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

let errors = 0, warnings = 0, total = 0;
const err = m => { errors++; console.log("  ✗ " + m); };
const warn = m => { warnings++; console.log("  ! " + m); };

for (const f of files) {
  try { vm.runInContext(fs.readFileSync(path.join(root, "lines", f), "utf8"), ctx, { filename: f }); }
  catch (e) { console.log(`✗ ${f}: JavaScript error — ${e.message}`); errors++; }
  if (!html.includes(`lines/${f}`)) { console.log(`! ${f} is not loaded in index.html (add <script src="lines/${f}"></script>)`); warnings++; }
}

const ARROW = /^[grb]:[a-h][1-8][a-h][1-8]$/;
for (const rep in ctx.REPERTOIRES) {
  const R = ctx.REPERTOIRES[rep];
  console.log(`\n${R.label || rep} (${(R.lines || []).length} lines)`);
  if (!["w", "b"].includes(R.side)) err(`side must be "w" or "b"`);
  const ids = new Set();
  for (const L of R.lines || []) {
    total++;
    const where = `${L.id}`;
    if (!L.id) err("a line has no id");
    if (ids.has(L.id)) err(`${where}: duplicate id`);
    ids.add(L.id);
    const g = new Chess(), labels = [];
    const toks = String(L.moves || "").replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      const mv = g.move(toks[i], { sloppy: true });
      if (!mv) { err(`${where}: "${toks[i]}" is illegal (move ${Math.floor(i / 2) + 1}${i % 2 ? "..." : "."})`); break; }
      labels.push((Math.floor(i / 2) + 1) + (i % 2 ? "..." : ".") + mv.san);
    }
    const has = k => labels.includes(k);
    for (const k in L.notes || {}) if (!has(k)) err(`${where}: note "${k}" doesn't match a move in the line`);
    for (const k in L.arrows || {}) {
      if (!has(k)) err(`${where}: arrows "${k}" doesn't match a move in the line`);
      for (const a of String(L.arrows[k]).split(/\s+/).filter(Boolean)) if (!ARROW.test(a)) err(`${where}: arrow "${a}" should look like g:e2e4`);
    }
    for (const k in L.engineOk || {}) if (!has(k)) warn(`${where}: engineOk "${k}" doesn't match a move (ignored)`);
    if (L.quizTo && !has(L.quizTo)) err(`${where}: quizTo "${L.quizTo}" doesn't match a move in the line`);
    for (const k in L.alsoGood || {}) {
      const m = k.match(/^(\d+)\.(\.\.)?(.+)$/);
      if (!m) { err(`${where}: alsoGood "${k}" should look like "5.Bg3" or "5...Nf6"`); continue; }
      const ply = (+m[1] - 1) * 2 + (m[2] ? 1 : 0);
      const t = new Chess();
      for (let j = 0; j < ply; j++) t.move(toks[j], { sloppy: true });
      if (!t.move(m[3], { sloppy: true })) err(`${where}: alsoGood "${k}" is not legal there`);
    }
  }
}
console.log(`\n${total} lines checked: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
