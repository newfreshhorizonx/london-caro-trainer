/* ---------- retro pixel campfire ---------- */
(function(){
  const cv=document.getElementById("fire"); if(!cv) return;
  const W=32,H=32, ctx=cv.getContext("2d"); cv.width=W; cv.height=H;
  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heat=new Float32Array(W*H), sparks=[];
  const pal=["rgba(0,0,0,0)","#6b1d0e","#a4300f","#d8521a","#f08a24","#f7b84a","#fde58c","#fff6d0"];
  function logs(){
    ctx.fillStyle="#4a2c1a"; ctx.fillRect(7,26,18,3); ctx.fillStyle="#6b4226"; ctx.fillRect(7,26,18,1);
    ctx.fillStyle="#3b2213"; ctx.fillRect(10,24,12,3); ctx.fillStyle="#5c3820"; ctx.fillRect(10,24,12,1);
    ctx.fillStyle="#7a6a5c"; [5,26].forEach(x=>{ctx.fillRect(x,28,3,2);}); ctx.fillRect(9,29,2,1); ctx.fillRect(21,29,2,1);
  }
  function step(){
    for(let x=10;x<22;x++){ heat[(H-9)*W+x]= Math.random()<.75 ? 7 : 4; }
    for(let y=0;y<H-9;y++) for(let x=1;x<W-1;x++){
      const b=(y+1)*W+x; const v=(heat[b-1]+heat[b]+heat[b+1]+heat[Math.min(b+W,W*H-1)])/4 - Math.random()*.9 - (Math.abs(x-16)>4?.35:0);
      heat[y*W+x]=Math.max(0,v);
    }
    if(Math.random()<.25) sparks.push({x:12+Math.random()*8,y:20,vy:-.4-Math.random()*.4,vx:(Math.random()-.5)*.3,life:20+Math.random()*15});
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(let y=0;y<H-8;y++) for(let x=0;x<W;x++){ const v=Math.floor(heat[y*W+x]); if(v>0){ ctx.fillStyle=pal[Math.min(7,v)]; ctx.fillRect(x,y,1,1);} }
    logs();
    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.x+=s.vx; s.y+=s.vy; s.life--; if(s.life<0||s.y<0){sparks.splice(i,1);continue;} ctx.fillStyle=s.life>10?"#fde58c":"#f08a24"; ctx.fillRect(Math.round(s.x),Math.round(s.y),1,1); }
  }
  for(let i=0;i<30;i++) step();
  draw();
  if(!reduce) setInterval(()=>{ if(document.hidden) return; step(); draw(); }, 90);
})();

/* ---------- original lofi loop (Web Audio, generated live) ---------- */
const Lofi=(function(){
  let ac=null, master=null, timer=null, nextTime=0, step16=0, playing=false, crackleSrc=null;
  const BPM=74, S16=60/BPM/4;
  // ii–V–I–vi in C, jazzy 9ths/7ths (MIDI notes)
  const CH=[[50,53,57,60,64],[43,53,57,59,64],[48,52,55,59,62],[45,52,55,60,64]];
  const BASS=[38,31,36,33];
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  function noiseBuf(sec){ const b=ac.createBuffer(1,ac.sampleRate*sec,ac.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
  let nb=null;
  function init(){
    ac=new (window.AudioContext||window.webkitAudioContext)();
    master=ac.createGain(); master.gain.value=.0;
    const lp=ac.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=2400; lp.Q.value=.4;
    master.connect(lp); lp.connect(ac.destination);
    nb=noiseBuf(2);
    // vinyl crackle bed
    const cb=ac.createBuffer(1,ac.sampleRate*3,ac.sampleRate), d=cb.getChannelData(0);
    for(let i=0;i<d.length;i++){ d[i]=(Math.random()*2-1)*.012 + (Math.random()<.0006 ? (Math.random()*2-1)*.5 : 0); }
    crackleSrc=ac.createBufferSource(); crackleSrc.buffer=cb; crackleSrc.loop=true;
    const cf=ac.createBiquadFilter(); cf.type="bandpass"; cf.frequency.value=3000; cf.Q.value=.7;
    const cg=ac.createGain(); cg.gain.value=.5; crackleSrc.connect(cf); cf.connect(cg); cg.connect(master); crackleSrc.start();
  }
  function keys(t,notes,dur){
    notes.forEach((n,i)=>{
      const o=ac.createOscillator(), o2=ac.createOscillator(), g=ac.createGain();
      o.type="triangle"; o2.type="sine"; o.frequency.value=mtof(n); o2.frequency.value=mtof(n+12)*1.002;
      o.detune.value=(Math.random()-.5)*10;
      const v=.045-i*.004, st=t+i*.012;
      g.gain.setValueAtTime(0,st); g.gain.linearRampToValueAtTime(v,st+.03); g.gain.exponentialRampToValueAtTime(v*.35,st+dur*.6); g.gain.exponentialRampToValueAtTime(.0001,st+dur);
      const g2=ac.createGain(); g2.gain.value=.25;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      o.start(st); o2.start(st); o.stop(st+dur+.05); o2.stop(st+dur+.05);
    });
  }
  function bass(t,n,dur){
    const o=ac.createOscillator(), g=ac.createGain(); o.type="sine"; o.frequency.value=mtof(n);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.16,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.05);
  }
  function kick(t){
    const o=ac.createOscillator(), g=ac.createGain(); o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(42,t+.18);
    g.gain.setValueAtTime(.38,t); g.gain.exponentialRampToValueAtTime(.0001,t+.35); o.connect(g); g.connect(master); o.start(t); o.stop(t+.4);
  }
  function noiseHit(t,freq,type,vol,len){
    const s=ac.createBufferSource(); s.buffer=nb; const f=ac.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=ac.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+len); s.connect(f); f.connect(g); g.connect(master);
    s.start(t,Math.random()*1.5); s.stop(t+len+.02);
  }
  function schedule(){
    while(nextTime < ac.currentTime+.15){
      const t=nextTime, s=step16%16, bar=Math.floor(step16/16)%4;
      const swing=(s%2===1)? S16*.18 : 0;
      if(s===0){ keys(t,CH[bar],S16*15); bass(t,BASS[bar],S16*6); }
      if(s===10){ bass(t,BASS[bar]+7,S16*4); }
      if(s===0||s===7||s===10) kick(t+swing);
      if(s===4||s===12) noiseHit(t+swing,1800,"bandpass",.13,.18);
      if(s%2===0||Math.random()<.25) noiseHit(t+swing,7000,"highpass",s%4===2?.05:.025,.05);
      nextTime+=S16; step16++;
    }
  }
  return {
    toggle(){
      if(!ac) init();
      if(!playing){ ac.resume(); nextTime=ac.currentTime+.1; master.gain.cancelScheduledValues(ac.currentTime); master.gain.linearRampToValueAtTime(+volEl().value,ac.currentTime+1.2); timer=setInterval(schedule,30); playing=true; }
      else { master.gain.cancelScheduledValues(ac.currentTime); master.gain.linearRampToValueAtTime(0,ac.currentTime+.6); clearInterval(timer); playing=false; setTimeout(()=>{ if(!playing) ac.suspend(); },700); }
      return playing;
    },
    setVol(v){ if(master&&playing) master.gain.linearRampToValueAtTime(+v,ac.currentTime+.1); }
  };
})();
function volEl(){ return document.getElementById("vol"); }
document.getElementById("musicBtn").onclick=()=>{
  try{ const on=Lofi.toggle(); const b=document.getElementById("musicBtn"); b.setAttribute("aria-pressed",on); b.querySelector("span").textContent= on ? "Lofi on" : "Lofi off"; }
  catch(e){ document.getElementById("musicBtn").querySelector("span").textContent="No audio here"; }
};
volEl().oninput=e=>Lofi.setVol(e.target.value);
