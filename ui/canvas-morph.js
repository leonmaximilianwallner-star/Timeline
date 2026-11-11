// ui/canvas-morph.js — between the week and the canvas: one position, set by the hand (Max, 11 Nov 2026).
"use strict";
/* Like a phone's pull-down panel: one number p, 0 = the week, 1 = the canvas. The wheel sets it 1:1
   (input/canvas-pull.js); let go, it settles to the side whose barrier it crossed, or falls back. Nothing plays
   on its own. Every in-between is morphTo(p), and it is a zoom, not a picture of one (Max, 11 Nov: "scaled, not
   stretched"): the timeline and the day view stay one sheet, drawn at a scale between the week's and the canvas's,
   and drop together; the canvas comes down above, its floor on the band's top edge. */
const SETTLE_MS = 240;         // a whole settle; a shorter way takes its share of it
const BARRIER   = 0.35;        // the share of the way to cross before letting go goes on rather than back

const morph = { on:false, from:0, p:0, f:0, floor:0, raf:0 };

/* takes hold: the canvas in place under the week, at the week's day; from 0 (the week) or 1 (the canvas) */
function morphStart(from){
  cancelAnimationFrame(morph.raf);
  if(morph.on) return;
  morph.on = true; morph.from = morph.p = from;
  if(from === 0){ showCanvas(); morph.f = weekLeftDay(); }
  else { openRail(true, true); morph.f = canvasLeftDay(); }
  $views.classList.add("dragging");                               // snapping off: both views hold the same day, to the fraction
  $scene.scrollTop = 0;
  $scene.scrollLeft = morph.f * TL_PPD;
  canvasScrollToDay(morph.f);
  morph.floor = $railInner.getBoundingClientRect().top - $views.getBoundingClientRect().top;   // where the band lands: on the rail's rows
  $tlWrap.querySelectorAll(".dropdown-row").forEach(r => r.style.setProperty("--h", r.offsetHeight + "px"));   // it closes from here (styles/canvas.css)         // where the rail's top is in the canvas
  morphTo(from);
}

/* every in-between, from p alone. The days' scale goes by ratio, as the eye reads a zoom (k^p); the day at the left
   edge stays put; the week drops by the same share of the way. Re-laid out, not stretched: a pill keeps its round
   ends, a line its width, text its size; at p = 1 the band is drawn exactly as the rail beneath it */
function morphTo(p){
  morph.p = p;
  const ppd = TL_PPD * Math.pow(CANVAS_CELL / TL_PPD, p), y = p * morph.floor;
  $scene.style.setProperty("--ppd", ppd + "px");
  $scene.style.setProperty("--p", p);
  $scene.scrollLeft = morph.f * ppd;
  $tlWrap.style.transform = $dayWrap.style.transform = `translateY(${y}px)`;
  $canvasView.style.transform = `translateY(${y - morph.floor}px)`;
}

/* let go: on to the side whose barrier was crossed, or back; from where it is, at the speed of the rest */
function morphRelease(to){
  if(!morph.on) return;
  if(to === undefined) to = morph.from === 0 ? +(morph.p > BARRIER) : +(morph.p > 1 - BARRIER);
  const p0 = morph.p, ms = reducedMotion() ? 0 : SETTLE_MS * Math.abs(to - p0), t0 = performance.now();
  const step = now => {
    const t = ms ? Math.min(1, (now - t0) / ms) : 1;
    morphTo(p0 + (to - p0) * (1 - Math.pow(1 - t, 3)));           // ease-out: fast from the hand, soft at rest
    if(t < 1) morph.raf = requestAnimationFrame(step); else morphEnd(to);
  };
  morph.raf = requestAnimationFrame(step);
}

/* at rest on one side: everything back to its own style */
function morphEnd(to){
  morph.on = false;
  [$tlWrap, $dayWrap, $canvasView].forEach(el => { el.style.transform = ""; });
  $scene.style.removeProperty("--ppd"); $scene.style.removeProperty("--p");
  $views.classList.remove("dragging");
  UI.canvas.active = to === 1;
  if(to === 1){ document.documentElement.dataset.view = "canvas"; if(!UI.canvas.hover) openRail(false); }
  else { delete document.documentElement.dataset.view; openRail(false, true); hideCanvas(); }
}
