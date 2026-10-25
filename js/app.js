// Loads the line files (lines/*.js) and turns them into what the trainer needs.
// Move notation is parsed with chess.js, so a typo in a line shows a clear error instead of a broken board.
const DATA = {};
const LOAD_ERRORS = [];
const REPS = {};
(function compile(){
  const lab = (i, san) => (Math.floor(i/2)+1) + (i%2 ? "..." : ".") + san;
  for (const rep in REPERTOIRES) {
    const R = REPERTOIRES[rep];
    REPS[rep] = { side: R.side, label: R.label, orient: R.side === "w" ? "White" : "Black" };
    DATA[rep] = [];
    for (const L of R.lines) {
      const g = new Chess(), plies = [], labels = [];
      const toks = L.moves.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/);
      let broken = false;
      toks.forEach((s, i) => {
        if (broken) return;
        const fen = g.fen(), mv = g.move(s, { sloppy: true });
        if (!mv) { LOAD_ERRORS.push(`${rep} / ${L.id}: "${s}" is not legal at move ${lab(i, s)}`); broken = true; return; }
        const label = lab(i, mv.san); labels.push(label);
        const ok = {};
        for (const a of (L.engineOk && L.engineOk[label]) || []) { const t = new Chess(fen); const m = t.move(a, { sloppy: true }); if (m) ok[m.from + m.to] = m.san; }
        plies.push({ san: mv.san, from: mv.from, to: mv.to, ok });
      });
      if (broken || !plies.length) continue;
      const notes = labels.map(l => (L.notes && L.notes[l]) || null);
      const arrows = labels.map(l => ((L.arrows && L.arrows[l]) || "").split(/\s+/).filter(Boolean)
        .map(a => { const [c, u] = a.split(":"); return [c, u.slice(0, 2), u.slice(2, 4)]; }).filter(a => a[1] !== a[2]));
      const alts = {};
      for (const k in (L.alsoGood || {})) {
        const m = k.match(/^(\d+)\.(\.\.)?(.+)$/); if (!m) continue;
        const ply = (+m[1] - 1) * 2 + (m[2] ? 1 : 0);
        const t = new Chess(); for (let j = 0; j < ply && j < plies.length; j++) t.move(plies[j].san);
        const mv = t.move(m[3], { sloppy: true }); if (!mv) { LOAD_ERRORS.push(`${rep} / ${L.id}: alsoGood "${k}" is not legal`); continue; }
        (alts[ply] = alts[ply] || {})[mv.from + mv.to] = { san: mv.san, text: L.alsoGood[k] };
      }
      let quiz = L.quizTo ? labels.indexOf(L.quizTo) + 1 : plies.length;
      if (quiz <= 0) { LOAD_ERRORS.push(`${rep} / ${L.id}: quizTo "${L.quizTo}" isn't a move in the line`); quiz = plies.length; }
      const sideIdx = R.side === "w" ? 0 : 1;
      while (quiz > 1 && (quiz - 1) % 2 !== sideIdx) quiz--;
      DATA[rep].push({ id: L.id, group: L.group || "Other", name: L.name || L.id, plies, notes, arrows, alts, quiz });
    }
  }
})();
const PIECES = {}; for (const c of "wb") for (const p of "KQRBNP") PIECES[c + p] = `img/pieces/${c}${p}.svg`;
const FILES = "abcdefgh";
const ARROW = {g:"#4f9a4a", r:"#d0573f", b:"#6f7fd8", next:"#3f8a3c"};

const store = {
  get(){ try{ return JSON.parse(localStorage.getItem("lc-trainer")||"{}"); }catch(e){ return {}; } },
  set(v){ try{ localStorage.setItem("lc-trainer",JSON.stringify(v)); }catch(e){} }
};
let saved = store.get(); saved.progress = saved.progress||{};

const S = { rep: (saved.rep && REPERTOIRES[saved.rep]) ? saved.rep : Object.keys(REPERTOIRES)[0], lineIdx:0, mode: saved.mode||"learn", game:null, ply:0, sel:null,
  mistakes:0, triesHere:0, revealed:false, hintShown:false, done:false, busy:false, timer:null, view:null };

const $ = id => document.getElementById(id);
const lines = () => DATA[S.rep];
const line = () => lines()[S.lineIdx];
const mySide = () => REPS[S.rep].side;
const myTurnAt = p => (p%2===0 ? "w":"b") === mySide();
const prog = id => saved.progress[id] || {runs:0,clean:0,streak:0};
const stateOf = id => { const p=prog(id); return p.streak>=3 ? "mastered" : p.runs>0 ? "learning" : "new"; };
const label = i => (Math.floor(i/2)+1)+(i%2?"…":".")+line().plies[i].san;

/* ---------- board: built once, then only updated ---------- */
const sqEls = {};
let pieceEls = {};
let flipped = null;

function xy(sq){ const f=FILES.indexOf(sq[0]), r=+sq[1]; return flipped ? [7-f, r-1] : [f, 8-r]; }
function place(el,sq){ const [x,y]=xy(sq); el.style.transform=`translate(${x*100}%,${y*100}%)`; }

function buildSquares(){
  const box=$("squares"); box.innerHTML=""; flipped = mySide()==="b";
  for(let i=0;i<64;i++){
    const r=Math.floor(i/8), c=i%8, file=flipped?7-c:c, rank=flipped?r+1:8-r, s=FILES[file]+rank;
    const d=document.createElement("div"); d.className="sq "+((r+c)%2?"d":"l");
    if(c===0){ const e=document.createElement("span"); e.className="coord r"; e.textContent=rank; d.appendChild(e); }
    if(r===7){ const e=document.createElement("span"); e.className="coord f"; e.textContent=FILES[file]; d.appendChild(e); }
    sqEls[s]=d; box.appendChild(d);
  }
}
function syncPieces(){
  const layer=$("pieces"); layer.innerHTML=""; pieceEls={};
  for(const f of FILES) for(let r=1;r<=8;r++){
    const s=f+r, p=S.game.get(s); if(!p) continue;
    const el=document.createElement("div"); el.className="pc instant";
    el.style.backgroundImage=`url("${PIECES[p.color+p.type.toUpperCase()]}")`;
    place(el,s); layer.appendChild(el); pieceEls[s]=el;
  }
  requestAnimationFrame(()=>{ for(const k in pieceEls) pieceEls[k].classList.remove("instant"); });
}
function animateMove(mv, instant){
  const el=pieceEls[mv.from]; if(!el) { syncPieces(); return; }
  const capSq = mv.flags.includes("e") ? mv.to[0]+mv.from[1] : mv.to;
  if(pieceEls[capSq]){ pieceEls[capSq].remove(); delete pieceEls[capSq]; }
  delete pieceEls[mv.from]; pieceEls[mv.to]=el;
  if(instant){ el.classList.add("instant"); place(el,mv.to); requestAnimationFrame(()=>el.classList.remove("instant")); }
  else place(el,mv.to);
  if(mv.promotion) el.style.backgroundImage=`url("${PIECES[mv.color+mv.promotion.toUpperCase()]}")`;
  if(mv.flags.includes("k")||mv.flags.includes("q")){
    const rank=mv.from[1], kside=mv.flags.includes("k");
    const rf=(kside?"h":"a")+rank, rt=(kside?"f":"d")+rank, r=pieceEls[rf];
    if(r){ delete pieceEls[rf]; pieceEls[rt]=r; place(r,rt); }
  }
}
function highlights(extra={}){
  for(const s in sqEls) sqEls[s].classList.remove("last","sel","hint","wrong","check","mv","cap");
  const h=S.game.history({verbose:true}), last=h[h.length-1];
  if(last){ sqEls[last.from].classList.add("last"); sqEls[last.to].classList.add("last"); }
  if(S.sel){ sqEls[S.sel].classList.add("sel");
    for(const m of S.game.moves({square:S.sel,verbose:true})) sqEls[m.to].classList.add(S.game.get(m.to)?"cap":"mv"); }
  if(extra.hint) sqEls[extra.hint].classList.add("hint");
  if(extra.wrong) sqEls[extra.wrong].classList.add("wrong");
  if(S.game.in_check()){ for(const s in sqEls){ const p=S.game.get(s); if(p&&p.type==="k"&&p.color===S.game.turn()) sqEls[s].classList.add("check"); } }
  // arrows: ideas from the last move played (+ the next move in Learn)
  const L=line(), arr=[], at = S.view!==null ? S.view : S.ply;
  const showIdeas = S.mode==="learn" || S.done || S.view!==null;
  if(at>0 && showIdeas) for(const a of (L.arrows[at-1]||[])) arr.push({c:a[0],from:a[1],to:a[2]});
  const showNext = S.view===null && !S.done && !S.busy && myTurnAt(S.ply) && (S.mode==="learn" || S.revealed);
  if(showNext){ const p=L.plies[S.ply]; arr.push({c:"next",from:p.from,to:p.to,main:true}); }
  if(extra.arrows) arr.push(...extra.arrows);
  drawArrows(arr);
}
function drawArrows(list){
  const svg=$("arrows"); svg.innerHTML="";
  const seen=new Set();
  for(const a of list){
    const key=a.from+a.to; if(seen.has(key)) continue; seen.add(key);
    let [x1,y1]=xy(a.from), [x2,y2]=xy(a.to); x1+=.5;y1+=.5;x2+=.5;y2+=.5;
    const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy); if(!len) continue;
    const ux=dx/len, uy=dy/len, px=-uy, py=ux;
    const w=a.main?.17:.12, hw=a.main?.34:.27, hl=a.main?.4:.32;
    const ex=x2-ux*.28, ey=y2-uy*.28, bx=ex-ux*hl, by=ey-uy*hl, sx=x1+ux*.22, sy=y1+uy*.22;
    const pts=[[sx+px*w/2,sy+py*w/2],[bx+px*w/2,by+py*w/2],[bx+px*hw,by+py*hw],[ex,ey],[bx-px*hw,by-py*hw],[bx-px*w/2,by-py*w/2],[sx-px*w/2,sy-py*w/2]];
    const poly=document.createElementNS("http://www.w3.org/2000/svg","polygon");
    poly.setAttribute("points",pts.map(p=>p.map(n=>n.toFixed(3)).join(",")).join(" "));
    poly.setAttribute("fill",ARROW[a.c]||ARROW.g); poly.setAttribute("opacity",a.main?".8":".62");
    svg.appendChild(poly);
  }
}

/* ---------- line flow ---------- */
function startLine(idx){
  clearTimeout(S.timer); if(typeof stopAuto==="function" && autoT) stopAuto();
  S.lineIdx = Math.max(0,Math.min(idx,lines().length-1));
  S.game = new Chess(); S.ply=0; S.sel=null; S.mistakes=0; S.triesHere=0; S.revealed=false; S.hintShown=false; S.done=false; S.busy=false; S.view=null;
  saved.rep=S.rep; store.set(saved);
  if(flipped !== (mySide()==="b")) buildSquares();
  syncPieces(); renderList(); setStatus("",""); step();
}
function step(){
  const L=line();
  if(S.ply>=L.quiz){ finish(); return; }
  if(!myTurnAt(S.ply)){
    S.busy=true; highlights(); renderCoach();
    S.timer=setTimeout(()=>{
      const mv=S.game.move(L.plies[S.ply].san); animateMove(mv,false);
      S.ply++; S.busy=false; S.triesHere=0; S.revealed=false; S.hintShown=false; setStatus("",""); step();
    }, S.ply===0 ? 250 : (S.mode==="learn" && L.notes[S.ply-1] ? 650 : 330));
  } else { highlights(); renderCoach(); }
}
// Is this a "soft" miss? (good move, wrong order, or a known alternative)
function softReason(from,to,legal){
  const L=line(), key=from+to, exp=L.plies[S.ply];
  const alt = L.alts[S.ply] && L.alts[S.ply][key];
  if(alt) return {kind:"alt", text:alt.text};
  for(let j=S.ply+2;j<L.plies.length;j+=2){
    const p=L.plies[j]; if(p.from===from && p.to===to)
      return {kind:"order", text:`Right idea, wrong order. You'll play ${p.san} on move ${Math.floor(j/2)+1}. First ${exp.san}${L.notes[S.ply]?": "+lowerFirst(L.notes[S.ply]):"."}`};
  }
  if(L.plies[S.ply].ok && L.plies[S.ply].ok[key])
    return {kind:"engine", text:`${legal.san} is also a good move (the engine likes it). Your repertoire move is ${exp.san}, which keeps you in the lines you're learning.`};
  return null;
}
function lowerFirst(s){ return s.charAt(0).toLowerCase()+s.slice(1); }

function tryMove(from,to,dragged){
  if(S.done||S.busy||!myTurnAt(S.ply)||S.view!==null) return false;
  const L=line(), exp=L.plies[S.ply];
  const legal=S.game.moves({square:from,verbose:true}).find(m=>m.to===to);
  if(!legal){ S.sel=null; highlights(); return false; }
  S.sel=null;
  if(from===exp.from && to===exp.to){
    const mv=S.game.move({from,to,promotion:"q"}); animateMove(mv,dragged);
    S.ply++; S.triesHere=0; S.revealed=false; S.hintShown=false;
    setStatus("good", `<b>${mv.san}</b> ✓`);
    step(); return true;
  }
  const soft=softReason(from,to,legal);
  if(soft){
    // play it, explain, then take it back and point at the repertoire move
    const mv=S.game.move({from,to,promotion:"q"}); animateMove(mv,dragged);
    S.busy=true; highlights({arrows:[{c:"next",from:exp.from,to:exp.to,main:true}]});
    setStatus("warn", soft.text);
    S.timer=setTimeout(()=>{ S.game.undo(); syncPieces(); S.busy=false; S.revealed=true; highlights(); renderCoach(); }, 1500);
    return true;
  }
  if(S.triesHere===0 && !S.hintShown) S.mistakes++;
  S.triesHere++;
  if(S.triesHere>=2) S.revealed=true;
  highlights({wrong:to});
  setStatus("bad", S.revealed ? `Not this one. Play <b>${exp.san}</b> (green arrow).` : `${legal.san} isn't your repertoire move. Try again.`);
  return false;
}
function finish(){
  S.done=true; S.view=S.ply; highlights(); renderCoach();
  const L=line(), p=prog(L.id); p.runs++;
  const more = L.plies.length>L.quiz ? ` Press <b>→</b> or <b>Play ideas</b> to see how it goes on to move ${Math.ceil(L.plies.length/2)}.` : "";
  if(S.mode==="drill"){ if(S.mistakes===0){ p.clean++; p.streak++; } else p.streak=0; }
  saved.progress[L.id]=p; store.set(saved); renderList();
  if(S.mode!=="drill") setStatus("good","Quiz part complete."+more);
  else if(S.mistakes===0) setStatus("good",`Clean run. Streak ${p.streak}${p.streak>=3?" — mastered.":"/3."}`+more);
  else setStatus("bad",`Done with ${S.mistakes} mistake${S.mistakes>1?"s":""}. Streak reset.`+more);
  renderCoach();
}
function hint(){
  if(S.done||S.busy||!myTurnAt(S.ply)) return;
  const exp=line().plies[S.ply];
  if(!S.hintShown){ S.hintShown=true; if(S.triesHere===0 && S.mode==="drill") S.mistakes++; highlights({hint:exp.from}); setStatus("","Move the highlighted piece."); }
  else { S.revealed=true; highlights({hint:exp.from}); setStatus("",`The move is <b>${exp.san}</b>.`); }
}
function randomDrill(){
  const ls=lines(), w=ls.map(l=>{ const p=prog(l.id); return p.streak>=3 ? 1 : p.runs===0 ? 6 : 5-Math.min(p.streak,3); });
  let r=Math.random()*w.reduce((a,b)=>a+b,0), i=0;
  for(;i<ls.length-1;i++){ r-=w[i]; if(r<=0) break; }
  if(ls.length>1 && i===S.lineIdx) i=(i+1)%ls.length;
  setMode("drill"); startLine(i);
}
/* review a finished line move by move */
function viewAt(n){
  if(!S.done) return;
  const L=line(); n=Math.max(0,Math.min(n,L.plies.length));
  if(n===S.view) return;
  const forward = n===S.view+1;
  if(forward){ const mv=S.game.move(L.plies[n-1].san); animateMove(mv,false); }
  else { S.game=new Chess(); for(let i=0;i<n;i++) S.game.move(L.plies[i].san); syncPieces(); }
  S.view=n; S.sel=null; highlights(); renderCoach();
  if(n>=L.quiz && n>S.ply) setStatus("", n===L.plies.length ? "End of the line. You know the ideas from here." : "Ideas (not quizzed). Press → for the next move.");
}
const viewPos = () => S.view!==null ? S.view : S.ply;

/* ---------- panels ---------- */
function setStatus(kind,html){ const s=$("status"); s.className="status "+(kind||""); s.innerHTML=html; }
function renderCoach(){
  const L=line(), at=viewPos();
  $("lineTitle").textContent=L.name;
  $("lineGroup").textContent=L.group+" · quiz to move "+Math.ceil(L.quiz/2)+(L.plies.length>L.quiz?", ideas to move "+Math.ceil(L.plies.length/2):"");
  $("modeLearn").setAttribute("aria-pressed",S.mode==="learn"); $("modeDrill").setAttribute("aria-pressed",S.mode==="drill");
  $("progBar").style.width=(100*Math.min(S.ply,L.quiz)/L.quiz)+"%";
  const n=$("note"); let idx=-1, prefix="";
  if(at>0 && L.notes[at-1] && (S.mode==="learn"||S.done||!myTurnAt(at-1))) idx=at-1;
  else if(S.mode==="learn" && !S.done && myTurnAt(S.ply) && L.notes[S.ply]){ idx=S.ply; prefix="Next: "; }
  if(idx>=0){ n.innerHTML=`<span class="who">${prefix}${label(idx)}</span>`; n.append(L.notes[idx]); n.hidden=false; } else n.hidden=true;
  const mv=$("moves"); mv.innerHTML=""; mv.classList.toggle("review",S.done);
  L.plies.forEach((p,i)=>{
    if(!S.done && i>=L.quiz) return;
    if(i===L.quiz){ const s=document.createElement("span"); s.className="ideasTag"; s.textContent="ideas"; mv.appendChild(s); }
    if(i%2===0 || i===L.quiz){ const s=document.createElement("span"); s.className="num"; s.textContent=(Math.floor(i/2)+1)+(i%2?"…":"."); mv.appendChild(s); }
    const s=document.createElement("span"); s.className="mv";
    if(i===at-1) s.classList.add("cur");
    if(i>=L.quiz) s.classList.add("idea");
    if(i>=S.ply && !S.done) s.classList.add("todo");
    s.textContent = (S.mode==="drill" && i>=S.ply && !S.done) ? "··" : p.san;
    if(S.done) s.onclick=()=>viewAt(i+1);
    mv.appendChild(s);
  });
  $("reviewBar").hidden=!S.done;
  const st=$("status");
  if(!S.done && !S.busy && myTurnAt(S.ply) && !st.classList.contains("bad") && !st.classList.contains("warn") && !st.innerHTML.includes("✓"))
    setStatus("", S.mode==="learn" ? `Your move: <b>${L.plies[S.ply].san}</b>` : "Your move.");
}
function renderList(){
  const ls=lines(), box=$("lineList"); box.innerHTML="";
  const groups={}; ls.forEach((l,i)=>(groups[l.group]=groups[l.group]||[]).push([l,i]));
  for(const g in groups){
    const div=document.createElement("div"); div.className="group";
    const h=document.createElement("h3"); h.textContent=g; div.appendChild(h);
    for(const [l,i] of groups[g]){
      const b=document.createElement("button"); b.className="lineBtn";
      if(i===S.lineIdx) b.setAttribute("aria-current","true");
      const st=stateOf(l.id);
      b.innerHTML=`<span class="dot ${st}" title="${st}"></span><span class="n"></span>`;
      b.querySelector(".n").textContent=l.name; b.onclick=()=>startLine(i); div.appendChild(b);
    }
    box.appendChild(div);
  }
  const m=ls.filter(l=>stateOf(l.id)==="mastered").length;
  $("stats").textContent=`${m} of ${ls.length} mastered`;
  $("pgn").value=buildPGN(); $("orientWord").textContent=REPS[S.rep].orient;
  for(const r in REPS) $("tab-"+r).setAttribute("aria-selected",S.rep===r);
}
function setMode(m){ S.mode=m; saved.mode=m; store.set(saved); }

function buildPGN(){
  const rep=REPS[S.rep];
  return lines().map(L=>{
    let body="";
    L.plies.forEach((p,i)=>{
      if(i%2===0) body+=(i/2+1)+". "; else if(L.notes[i-1]||(L.arrows[i-1]||[]).length) body+=(Math.floor(i/2)+1)+"... ";
      body+=p.san+" ";
      const arr=(L.arrows[i]||[]).map(a=>({g:"G",r:"R",b:"B"}[a[0]]||"G")+a[1]+a[2]).join(",");
      if(L.notes[i]||arr) body+="{ "+(L.notes[i]||"").replace(/[{}]/g,"")+(arr?` [%cal ${arr}]`:"")+" } ";
    });
    return `[Event "${rep.label}: ${L.name}"]\n[White "${rep.side==="w"?"Me":"Opponent"}"]\n[Black "${rep.side==="b"?"Me":"Opponent"}"]\n[Result "*"]\n\n${body.trim()} *\n`;
  }).join("\n");
}

/* ---------- input: click-click or drag ---------- */
const boardEl=$("board");
let drag=null;
function sqFromPoint(x,y){
  const r=boardEl.getBoundingClientRect(); const c=Math.floor((x-r.left)/r.width*8), w=Math.floor((y-r.top)/r.height*8);
  if(c<0||c>7||w<0||w>7) return null;
  return flipped ? FILES[7-c]+(w+1) : FILES[c]+(8-w);
}
boardEl.addEventListener("pointerdown",e=>{
  if(e.button>0) return;
  const s=sqFromPoint(e.clientX,e.clientY); if(!s) return;
  const p=S.game.get(s), canMove=myTurnAt(S.ply)&&!S.done&&!S.busy&&S.view===null;
  if(S.sel && S.sel!==s && !(p&&p.color===mySide())){ tryMove(S.sel,s,false); return; }
  if(p && p.color===mySide() && canMove){
    const reselect = S.sel===s;
    S.sel=s; highlights();
    drag={from:s, el:pieceEls[s], x:e.clientX, y:e.clientY, moved:false, reselect};
    boardEl.setPointerCapture(e.pointerId);
  } else if(S.sel){ S.sel=null; highlights(); }
});
boardEl.addEventListener("pointermove",e=>{
  if(!drag||!drag.el) return;
  if(!drag.moved && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4) return;
  drag.moved=true; drag.el.classList.add("drag");
  const r=boardEl.getBoundingClientRect(), sz=r.width/8;
  drag.el.style.transform=`translate(${e.clientX-r.left-sz/2}px,${e.clientY-r.top-sz/2}px)`;
});
function endDrag(e){
  if(!drag) return; const d=drag; drag=null;
  if(d.el) d.el.classList.remove("drag");
  if(!d.moved){ if(d.reselect){ S.sel=null; highlights(); } return; }
  const to=e?sqFromPoint(e.clientX,e.clientY):null;
  const ok = to && to!==d.from && tryMove(d.from,to,true);
  if(!ok && d.el && pieceEls[d.from]===d.el){ d.el.classList.add("instant"); place(d.el,d.from); requestAnimationFrame(()=>d.el.classList.remove("instant")); }
}
boardEl.addEventListener("pointerup",endDrag);
boardEl.addEventListener("pointercancel",()=>endDrag(null));

(function buildTabs(){
  const box=$("tabs"); box.innerHTML="";
  for(const r in REPS){
    const b=document.createElement("button"); b.setAttribute("role","tab"); b.id="tab-"+r;
    b.innerHTML=`<span class="pip ${REPS[r].side}"></span>`; b.append(REPS[r].label);
    b.onclick=()=>{ S.rep=r; startLine(0); }; box.appendChild(b);
  }
})();
$("modeLearn").onclick=()=>{ setMode("learn"); startLine(S.lineIdx); };
$("modeDrill").onclick=()=>{ setMode("drill"); startLine(S.lineIdx); };
$("btnRestart").onclick=()=>startLine(S.lineIdx);
$("btnNext").onclick=()=>startLine((S.lineIdx+1)%lines().length);
$("btnRandom").onclick=randomDrill;
$("btnHint").onclick=hint;
$("revPrev").onclick=()=>{ stopAuto(); viewAt(viewPos()-1); };
let autoT=null;
function stopAuto(){ clearInterval(autoT); autoT=null; $("revPlay").textContent="Play ideas ▶"; }
$("revPlay").onclick=()=>{
  if(autoT){ stopAuto(); return; }
  const L=line(); if(viewPos()>=L.plies.length) viewAt(L.quiz);
  $("revPlay").textContent="Pause";
  autoT=setInterval(()=>{ if(!S.done||viewPos()>=line().plies.length){ stopAuto(); return; } viewAt(viewPos()+1); }, 1400);
};
$("revNext").onclick=()=>viewAt(viewPos()+1);
$("btnCopy").onclick=()=>{
  const ta=$("pgn");
  const ok=()=>{$("copyMsg").textContent="Copied.";};
  const fb=()=>{ta.focus();ta.select();$("copyMsg").textContent="Selected — press Ctrl/Cmd+C.";};
  try{ navigator.clipboard.writeText(ta.value).then(ok,fb); }catch(err){ fb(); }
};
document.addEventListener("keydown",e=>{
  if(e.target.closest("textarea,input")||e.metaKey||e.ctrlKey) return;
  const k=e.key.toLowerCase();
  if(k==="r") startLine(S.lineIdx); else if(k==="h") hint(); else if(k==="n") startLine((S.lineIdx+1)%lines().length);
  else if(k==="arrowleft" && S.done){ e.preventDefault(); viewAt(viewPos()-1); }
  else if(k==="arrowright" && S.done){ e.preventDefault(); viewAt(viewPos()+1); }
});

if(LOAD_ERRORS.length){ const e=$("loadErrors"); e.hidden=false; e.textContent="Some lines were skipped:\n"+LOAD_ERRORS.join("\n"); console.warn(LOAD_ERRORS); }
startLine(0);
