// ui/canvas-morph.js — between the week and the canvas: one position, set by the hand (Max, 11 Nov 2026).
"use strict";
/* Like a phone's pull-down panel: one number p, 0 = the week, 1 = the canvas. The wheel sets it 1:1
   (input/canvas-pull.js); let go, it settles to the side whose barrier it crossed, or falls back. Nothing plays
   on its own. Every in-between is morphTo(p):
   - the week moves as one sheet: the timeline band and the day view slide down; the day view fades;
   - the band narrows from the week's scale to the canvas's, and the rail, drawn at exactly the same place and
     width, crossfades in: the change of scale has nowhere to be seen;
   - the canvas comes down above, its floor on the band's top edge.
   Only transform and opacity, on layers kept while the canvas is in play: no layout, no paint while it moves. */
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
  morph.floor = $views.clientHeight - UI.canvas.railOpenH;         // where the rail's top is in the canvas
  $tlWrap.style.transformOrigin = `${$scene.scrollLeft + railW()}px 0`;   // the day at the left edge stays put
  $railInner.style.transformOrigin = `${morph.f * CANVAS_CELL}px 0`;
  morphTo(from);
}

/* the scale goes by ratio (k^p), as the eye reads a zoom: halfway, band and rail are stretched alike (measured 11 Nov) */
function morphTo(p){
  morph.p = p;
  const k = CANVAS_CELL / TL_PPD, s = Math.pow(k, p), y = p * morph.floor;
  const x = Math.min(1, Math.max(0, (p - 0.3) / 0.4));           // the crossfade, band → rail, where both are bent alike
  $tlWrap.style.transform = `translateY(${y}px) scaleX(${s})`;
  $tlWrap.style.opacity = 1 - x;
  $railInner.style.transform = `scaleX(${s / k})`;
  $railInner.style.opacity = x;
  $dayWrap.style.transform = `translateY(${y}px)`;
  $dayWrap.style.opacity = 1 - Math.min(1, p * 2);
  $canvasView.style.transform = `translateY(${y - morph.floor}px)`;
  $views.classList.toggle("squeezed", p > 0.06 && p < 0.94);      // labels step out while stretched (text keeps its shape)
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
  [$tlWrap, $railInner, $dayWrap, $canvasView].forEach(el => { el.style.transform = el.style.opacity = el.style.transformOrigin = ""; });
  $views.classList.remove("dragging", "squeezed");
  UI.canvas.active = to === 1;
  if(to === 1){ document.documentElement.dataset.view = "canvas"; if(!UI.canvas.hover) openRail(false); }
  else { delete document.documentElement.dataset.view; openRail(false, true); hideCanvas(); }
}
