// ui/snake-pill.js — the snake pill: Timeline's one waiting animation (styles/snake-pill.css).
"use strict";
/* ════════════════════════════════════════════════════════════
   A pill on the logo's 3×3 dot grid: its head reaches the next dot, then its tail follows.
   Kinds, all on the same grid, the loops starting and ending as a dot at the top left:
     loading    around the four outer dots                     (start-up)
     hourglass  top, diagonal, bottom, diagonal + one line text (start-up taking long)
     sync       top and bottom rows, in opposite directions    (Jetzt synchronisieren)
     done / cancel   a check / an X drawn once                 (how a sync ended)
   The wait decides what is shown (Max, 20 Nov): under 0.3 s nothing (start-up only), then the loop,
   past SNAKE_PILL_LONG_MS the hourglass and a line of text. Nothing jumps mid-move: the switch to the
   hourglass comes at the end of a lap (both start top left); the end comes at the next point where the
   loop is only dots (SNAKE_PILL_REST), at most 0.6 s (0.9 s for sync) after the wait is over.
     showSnakePill(kind, { dim })   centred; dim darkens the app (false: over the settings panel,
                                    which dims already; a phone still dims, its panel fills the screen)
     pill.stop({ result })          ends at the next dot; result "done" | "cancel" draws that mark first
   Loaded before the app's own scripts: the start-up one is in index.html from the first frame.
   ════════════════════════════════════════════════════════════ */
const SNAKE_PILL_UNSEEN_MS = 300;          // a start-up quicker than this shows nothing (.after-a-moment in the CSS)
const SNAKE_PILL_LONG_MS   = 4800;         // two loops; a wait still going then becomes the hourglass
const SNAKE_PILL_MARK_MS   = { done:1500, cancel:1700 };   // the check / X keyframes in the CSS
const SNAKE_PILL_LONG_NOTE = "Dauert länger als sonst …";
const SNAKE_PILL_LABEL = { loading:"Lädt", hourglass:"Lädt", sync:"Synchronisiert", done:"Erledigt", cancel:"Fehlgeschlagen" };

function snakePillHTML(kind){
  const path = (d, cls = "") => `<path class="snake-pill-stroke ${cls}" pathLength="1" d="${d}"/>`;
  const svg  = s => `<svg viewBox="0 0 72 72" aria-hidden="true">${s}</svg>`;
  const inner =
      kind === "loading"   ? `<div class="snake-pill-body lap"></div>`
    : kind === "sync"      ? `<div class="snake-pill-body lap"></div><div class="snake-pill-body"></div>`
    : kind === "hourglass" ? svg(path("M12 12 L60 12", "lap") + path("M60 12 L12 60") + path("M12 60 L60 60") + path("M60 60 L12 12"))
                             + `<p class="snake-pill-note">${SNAKE_PILL_LONG_NOTE}</p>`
    : kind === "done"      ? svg(path("M12 33 L30 51 L60 21"))
    :                        svg(path("M12 12 L60 60") + path("M12 60 L60 12"));
  return `<div class="snake-pill ${kind}" role="status" aria-label="${SNAKE_PILL_LABEL[kind]}">${inner}</div>`;
}

/* where a loop may end without a jump: wherever it is only dots (Max, 20 Nov: "never mid-move").
   loading and hourglass: at every corner, each quarter lap · sync: each half lap, both rows at their ends */
const SNAKE_PILL_REST = { loading:.25, hourglass:.25, sync:.5 };

/* ms until the loop now running next reaches such a point (whole: the end of the lap); 0 without animation */
function snakePillLapRest(layer, whole = false){
  const anim = layer.querySelector(".lap")?.getAnimations()[0];
  if(!anim) return 0;
  const step = anim.effect.getComputedTiming().duration * (whole ? 1 : SNAKE_PILL_REST[layer.dataset.kind] || 1);
  return step - (anim.currentTime % step);
}

function snakePillOn(layer, kind, bornAt = performance.now()){
  let stopping = null;
  const show = k => { layer.dataset.kind = k; layer.innerHTML = snakePillHTML(k); };
  layer.dataset.kind = kind;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* a long wait: at the end of the lap that crosses SNAKE_PILL_LONG_MS, the loop becomes the hourglass */
  if(kind === "loading"){
    wait(Math.max(0, SNAKE_PILL_LONG_MS - (performance.now() - bornAt) - 100))   // just before that lap ends
      .then(()=>{ if(!stopping && layer.isConnected) return wait(snakePillLapRest(layer, true)); throw 0; })   // the hourglass starts top left
      .then(()=>{ if(!stopping && layer.isConnected) show("hourglass"); })
      .catch(()=>{});
  }

  return {
    stop({ result } = {}){
      if(stopping) return stopping;
      if(layer.classList.contains("after-a-moment") && performance.now() - bornAt < SNAKE_PILL_UNSEEN_MS){
        layer.remove(); return stopping = Promise.resolve();   // never seen: nothing to finish
      }
      stopping = wait(snakePillLapRest(layer))
        .then(()=>{ if(result){ show(result); return wait(SNAKE_PILL_MARK_MS[result]); } })
        .then(()=>{ layer.classList.add("out"); return wait(260); })   // the fade in styles/snake-pill.css
        .then(()=>{ layer.remove(); });
      return stopping;
    }
  };
}

function showSnakePill(kind, { dim = true } = {}){
  const layer = document.createElement("div");
  layer.className = "snake-pill-layer" + (dim ? " dim" : " over-panel");
  layer.innerHTML = snakePillHTML(kind);
  document.body.appendChild(layer);
  return snakePillOn(layer, kind);
}

/* start-up: the one in index.html goes once the page has loaded; a quick start shows nothing (SNAKE_PILL_UNSEEN_MS) */
(function(){
  const layer = document.getElementById("bootSnakePill");
  if(!layer) return;
  const pill    = snakePillOn(layer, "loading", 0);   // 0: it exists from the page's first moment
  const loaded  = new Promise(r => document.readyState === "complete" ? r() : window.addEventListener("load", r, { once:true }));
  loaded.then(()=>pill.stop());
})();
