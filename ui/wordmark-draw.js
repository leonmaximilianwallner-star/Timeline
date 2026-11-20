// ui/wordmark-draw.js — the drawn wordmark (styles/wordmark-draw.css; the drawing is in index.html's #wordmarkDrawTemplate).
"use strict";
/* ════════════════════════════════════════════════════════════
   Was the loading screen until 20 Nov 2026: it held every start for ~3.4 s while the app was
   already drawn from local data (steward ledger S2). Now it is a greeting, not a wait:
   shown once per device, at the first sign-in (ui/settings.js), remembered in
   device.wordmarkSeen. A tap skips it.
     playWordmarkDraw()   draws it over the app, holds, fades; returns a promise. Callable any time.
   ════════════════════════════════════════════════════════════ */
const WORDMARK_DRAW_MS = 2600;   // the last stroke ends at 2.9 s / 1.3 (the --speed in the CSS) ≈ 2.2 s, then a short hold

function playWordmarkDraw(){
  const tpl = document.getElementById("wordmarkDrawTemplate");
  if(!tpl || document.getElementById("wordmarkDraw")) return Promise.resolve();
  document.body.appendChild(tpl.content.cloneNode(true));
  const el = document.getElementById("wordmarkDraw");
  return new Promise(done => {
    let gone = false;
    const leave = ()=>{
      if(gone) return; gone = true;
      el.classList.add("fade-out");
      el.addEventListener("transitionend", ()=>{ el.remove(); done(); }, { once:true });
    };
    el.addEventListener("click", leave);
    setTimeout(leave, WORDMARK_DRAW_MS);
  });
}
