// ui/canvas-morph.js — between the week and the canvas: one position, set by the hand (Max, 11 Nov; 17 Nov 2026).
"use strict";
/* Like a phone's pull-down panel. One value: morph.y, how far the week has dropped, 0 (the week) … floor (the canvas).
   Three phases (RULEBOOK B.6.1):
   - HOLD: the hand sets y directly (input/canvas-pull.js: a pinch, or a scroll past the edge). Nothing eases.
   - LET GO: where would it come to rest? y + project(velocity); the nearer side wins. One number decides
     distance and flick alike.
   - SETTLE: a spring from where it is, at the speed it was let go; it lands exactly, then (only then) the state changes.
   Every frame is morphTo(p), p = y / floor: a zoom, not a picture of one ("scaled, not stretched", Max 11 Nov). */
const SETTLE_S    = 0.35;      // the spring's visual duration (s): critically damped, so no overshoot, no second movement
const SETTLE_W    = 2 * Math.PI / (SETTLE_S * 1.2);   // its rate (1/s), as Motion derives it from a visual duration
const FLICK_RATE  = 0.998;     // how far a flick carries: Apple's deceleration rate (project)
const VELOCITY_MS = 100;       // only the last stretch of the hand counts for its speed

const morph = { on:false, from:0, y:0, floor:1, f:0, p:0, raf:0, gen:0, hist:[] };
const project = v => (v / 1000) * FLICK_RATE / (1 - FLICK_RATE);         // px/s → px it would still travel

/* takes hold: the canvas in place under the week, at the week's day; from 0 (the week) or 1 (the canvas) */
function morphStart(from){
  morph.gen++; cancelAnimationFrame(morph.raf);                   // a settle in flight stops where it is
  if(morph.on) return;
  morph.on = true; morph.from = from; morph.hist = [];
  if(from === 0){ showCanvas(); morph.f = weekLeftDay(); }
  else { openRail(true, true); morph.f = canvasLeftDay(); }
  $views.classList.add("dragging");                               // snapping off, the canvas under the week, the rail hidden
  $scene.scrollTop = 0;
  $scene.scrollLeft = morph.f * TL_PPD;
  canvasScrollToDay(morph.f);
  morph.floor = $railInner.getBoundingClientRect().top - $views.getBoundingClientRect().top;   // the band lands on the rail's rows
  $tlWrap.querySelectorAll(".dropdown-row").forEach(r => r.style.setProperty("--h", r.offsetHeight + "px"));   // it closes from here (styles/canvas.css)
  morph.y = from * morph.floor;
  morphTo(from);
}

/* HOLD: the hand moves it by dy px; a settle in flight stops under it */
function morphHold(dy){
  morph.gen++; cancelAnimationFrame(morph.raf);
  morph.y = Math.min(morph.floor, Math.max(0, morph.y + dy));
  const now = performance.now();
  morph.hist.push([now, morph.y]);
  while(morph.hist.length > 2 && now - morph.hist[0][0] > VELOCITY_MS) morph.hist.shift();
  morphTo(morph.y / morph.floor);
}

/* every in-between, from p alone. The days' scale goes by ratio, as the eye reads a zoom (k^p); the day at the left
   edge stays put; the week drops by the same share. Re-laid out, not stretched: a pill keeps its round ends, a line
   its width, text its size; at p = 1 the band is drawn exactly as the rail (hidden meanwhile: one timeline at a time) */
function morphTo(p){
  morph.p = p;
  const ppd = TL_PPD * Math.pow(CANVAS_CELL / TL_PPD, p), y = p * morph.floor;
  $scene.style.setProperty("--ppd", ppd + "px");
  $scene.style.setProperty("--p", p);
  $scene.scrollLeft = morph.f * ppd;
  $tlWrap.style.transform = $dayWrap.style.transform = `translateY(${y}px)`;
  $canvasView.style.transform = `translateY(${y - morph.floor}px)`;
}

/* LET GO: the speed of the last stretch (ending at the last move: the pause that told us it was let go isn't the
   hand's), carried on by projection; the nearer side wins. `to` forces a side (a key), from rest */
function morphRelease(to){
  if(!morph.on) return;
  const h = morph.hist, a = h[0], b = h[h.length - 1];
  const v = to === undefined && h.length > 1 && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) * 1000 : 0;
  if(to === undefined) to = +(morph.y + (reducedMotion() ? 0 : project(v)) > morph.floor / 2);   // reduced motion: no fling
  morphSettle(to, v);
}

/* SETTLE: a critically damped spring from (y, v) to the side, in closed form: x(t) = (x0 + (v0 + w·x0)·t)·e^(−w·t).
   It lands exactly (within half a pixel and nearly still, it is put there). Reduced motion: a short ease, no carry */
function morphSettle(to, v){
  const gen = ++morph.gen, T = to * morph.floor, x0 = morph.y - T, t0 = performance.now(), reduce = reducedMotion();
  const step = now => {
    if(gen !== morph.gen) return;                                 // caught by the hand meanwhile
    const t = (now - t0) / 1000;
    let x, dx;
    if(reduce){ const u = Math.min(1, t / 0.15); x = x0 * Math.pow(1 - u, 3); dx = u < 1 ? 1 : 0; }
    else { const e = Math.exp(-SETTLE_W * t); x = (x0 + (v + SETTLE_W * x0) * t) * e; dx = (v - SETTLE_W * (v + SETTLE_W * x0) * t) * e; }
    if(Math.abs(x) < 0.5 && Math.abs(dx) < 20){ morph.y = T; morphTo(to); return morphEnd(to); }
    morph.y = Math.min(morph.floor, Math.max(0, T + x));
    morphTo(morph.y / morph.floor);
    morph.raf = requestAnimationFrame(step);
  };
  morph.raf = requestAnimationFrame(step);
}

/* landed: everything back to its own style, and only now the state. The rail lands open (it is the band); if the
   pointer isn't on it, it closes at once, its own motion, as the end of this one */
function morphEnd(to){
  morph.on = false; morph.gen++;
  [$tlWrap, $dayWrap, $canvasView].forEach(el => { el.style.transform = ""; });
  $scene.style.removeProperty("--ppd"); $scene.style.removeProperty("--p");
  $views.classList.remove("dragging");
  UI.canvas.active = to === 1;
  if(to === 1){
    document.documentElement.dataset.view = "canvas";
    const r = $rail.getBoundingClientRect();
    UI.canvas.hover = pointerAt.x >= r.left && pointerAt.x <= r.right && pointerAt.y >= r.top && pointerAt.y <= r.bottom;
    if(!UI.canvas.hover) openRail(false);
  }
  else { delete document.documentElement.dataset.view; openRail(false, true); hideCanvas(); }
}
