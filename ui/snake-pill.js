// ui/snake-pill.js — the snake pill: Timeline's one waiting animation (styles/snake-pill.css).
"use strict";
/* ════════════════════════════════════════════════════════════
   It loops for as long as the wait lasts. Told to stop, it first finishes the lap it is in,
   so it always ends where it began: once, twice, as often as needed, never cut off mid-move.
     showSnakePill("loading" | "sync", { dim })   centred on the screen; dim = darken the app behind it
                                                  (dim:false is for over the settings panel, which dims already; a phone still dims)
     snakePill.stop()                             finishes the lap, fades, removes; returns a promise
   At start-up it appears only if the wait lasts longer than 0.3 s; a quicker start shows nothing.
   Loaded first, before the app's own scripts: the start-up one is already in index.html and
   runs from the first frame. Uses nothing of the app's.
   ════════════════════════════════════════════════════════════ */
const SNAKE_PILL_BOOT_PREVIEW_MS = 4800;   // TEMPORARY: start-up shows at least two laps, so it can be seen
                                           // even when the app is ready at once. Set to 0 (or delete) when done looking.

function snakePillHTML(kind){
  const bodies = kind === "sync" ? 2 : 1;
  return `<div class="snake-pill ${kind}" role="status" aria-label="${kind === "sync" ? "Synchronisiert" : "Lädt"}">`
    + `<div class="snake-pill-body"></div>`.repeat(bodies) + `</div>`;
}

/* the handle for a layer already on the page */
const SNAKE_PILL_UNSEEN_MS = 300;          // a start-up quicker than this shows nothing (.after-a-moment in the CSS)

function snakePillOn(layer, bornAt = performance.now()){
  let stopping = null;
  return {
    stop(){
      if(stopping) return stopping;
      if(layer.classList.contains("after-a-moment") && performance.now() - bornAt < SNAKE_PILL_UNSEEN_MS){
        layer.remove(); return stopping = Promise.resolve();   // never seen: nothing to finish
      }
      const anim = layer.querySelector(".snake-pill-body")?.getAnimations()[0];
      const lap = anim ? anim.effect.getComputedTiming().duration : 0;
      const into = anim ? (anim.currentTime + (anim.effect.getComputedTiming().delay || 0)) % lap : 0;
      const rest = anim && lap ? lap - into : 0;            // reduced motion: no animation, stop at once
      stopping = new Promise(done => setTimeout(()=>{
        layer.classList.add("out");
        setTimeout(()=>{ layer.remove(); done(); }, 260);   // the fade in styles/snake-pill.css
      }, rest));
      return stopping;
    }
  };
}

function showSnakePill(kind, { dim = true } = {}){
  const layer = document.createElement("div");
  layer.className = "snake-pill-layer" + (dim ? " dim" : " over-panel");
  layer.innerHTML = snakePillHTML(kind);
  document.body.appendChild(layer);
  return snakePillOn(layer);
}

/* start-up: the one in index.html goes once the page has loaded (and the preview time has passed) */
(function(){
  const layer = document.getElementById("bootSnakePill");
  if(!layer) return;
  const loaded  = new Promise(r => document.readyState === "complete" ? r() : window.addEventListener("load", r, { once:true }));
  const preview = new Promise(r => setTimeout(r, navigator.webdriver ? 0 : SNAKE_PILL_BOOT_PREVIEW_MS));   // tests don't sit through the preview
  Promise.all([loaded, preview]).then(()=>snakePillOn(layer, 0).stop());   // 0: it exists from the page's first moment
})();
