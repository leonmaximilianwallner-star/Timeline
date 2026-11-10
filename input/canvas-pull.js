// input/canvas-pull.js — getting between the week and the canvas by scrolling past the edge; panning the canvas (Max, 10 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   The pull, for a wheel or a trackpad:
   - Up, from the week's top: the timeline band sinks and the canvas shows above it.
   - Down, from the canvas's floor: the rail grows.
   It gives a little with every bit of scrolling (the editor's pull, ui/editor.js, without its release: a trackpad's
   release is the end of its momentum, up to a second later, Max 10 Nov: "never longer than a button").
   So it commits **the moment it crosses the line**, and the rest of that gesture goes nowhere (no scrolling on
   after landing). Short of the line, a pause springs it back.
   No accidental switch: only a gesture that starts at the edge pulls. A fling that runs into the edge, or a scroll
   that keeps going past it, stops there; the next gesture pulls. A sideways gesture never pulls.
   Only light layers move (the timeline band, the canvas, the rail); the week's scroller never does.
   Everything here is passive: native scrolling never waits for it.
   ════════════════════════════════════════════════════════════ */
const WHEEL_LINE = 240;        // px of wheel past the edge to the line: a deliberate trackpad swipe, or about three notches
const WHEEL_IDLE = 140;        // ms without a wheel event: the gesture is over
const PULL_PEEK  = 72;         // px the pull gives at the line: enough to see where it leads
const RAIL_HOVER_OPEN  = 120;  // ms over the rail before it opens
const RAIL_HOVER_CLOSE = 280;  // ms away from it before it closes

const $pullHint = document.getElementById("pullHint");
const pull = { dir:null, fromEdge:false, last:0, amount:0, spent:false, timer:null, spentTimer:null, spring:null };

const canvasCanStart = () => !UI.editor && !UI.focus && !UI.budgetOpen && !UI.settingsOpen && !UI.addMode && !UI.dayTodos && !UI.dragLive;
const wheelPx = (e, el) => e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
const atTop   = el => el.scrollTop <= 0;
const atFloor = el => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
/* the give: more with every bit of scrolling, less and less so toward the line (an ease-out) */
const pullGiveNow = () => { const x = Math.min(1, pull.amount / WHEEL_LINE); return PULL_PEEK * (1 - (1 - x) * (1 - x)); };

$scene.addEventListener("wheel", e => onPullWheel(e, "up"), { passive:true });
$canvasScene.addEventListener("wheel", e => onPullWheel(e, "down"), { passive:true });

function onPullWheel(e, dir){
  const now = performance.now(), fresh = now - pull.last > WHEEL_IDLE;
  pull.last = now;
  if(pull.spent){ endSpentLater(); return; }                      // the gesture that switched: its momentum goes nowhere
  if(UI.canvas.moving || (dir === "up") === UI.canvas.active) return;
  const el = dir === "up" ? $scene : $canvasScene;
  if(fresh && !pull.amount){                                      // a new gesture: it may pull only if it starts at the edge
    pull.dir = dir;
    pull.fromEdge = (dir === "up" ? atTop(el) && canvasCanStart() : atFloor(el));
  }
  if(!pull.fromEdge || pull.dir !== dir || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const d = wheelPx(e, el) * (dir === "up" ? -1 : 1);            // positive: toward the other view
  if(!pull.amount && d <= 0) return;                              // moving away from the edge: plain scrolling
  if(!pull.amount) startPull(dir);
  pull.amount = Math.max(0, pull.amount + d);
  clearTimeout(pull.timer);
  if(pull.amount >= WHEEL_LINE){ commitPull(); return; }
  if(!pull.amount){ endPull(); return; }                          // pulled back to nothing: done, no motion
  showPull();
  pull.timer = setTimeout(springBack, WHEEL_IDLE);
}

function startPull(dir){
  if(pull.spring){ const s = pull.spring; pull.spring = null; s.forEach(a => a.cancel()); }   // a new pull takes over a spring-back
  if(dir === "up") showCanvas();                                  // drawn already (idle): only put in play
  else openRail(true);
  $views.classList.add("pulling-" + dir);
  $pullHint.textContent = dir === "up" ? "Leinwand" : "Zeitleiste";
}
/* up: the timeline band sinks, the canvas's floor stays on its top edge. down: the rail grows */
function showPull(){
  const give = pullGiveNow(), A = $views.clientHeight;
  if(pull.dir === "up"){
    $tlWrap.style.transform = `translateY(${give}px)`;
    $canvasView.style.transform = `translateY(${give - (A - UI.canvas.railOpenH)}px)`;
    $pullHint.style.top = (give - 40) + "px";
  } else {
    setRailHeight(give);
    $pullHint.style.top = (A - UI.canvas.railOpenH - give - 40) + "px";
  }
  $pullHint.style.opacity = Math.min(1, give / 40);
}
/* the line is crossed: the switch starts now, from where things are */
function commitPull(){
  const dir = pull.dir, give = pullGiveNow();
  pull.spent = true; $views.classList.add("settling"); endSpentLater();
  endPull(true);
  if(dir === "up") morphToCanvas(give); else morphToWeek();
}
/* the switching gesture is over once its wheel has been quiet for WHEEL_IDLE after the motion landed:
   while the motion runs, a busy frame can delay events longer than that, and its momentum would scroll on */
function endSpentLater(){
  clearTimeout(pull.spentTimer);
  pull.spentTimer = setTimeout(() => {
    if(UI.canvas.moving) return endSpentLater();
    pull.spent = false; $views.classList.remove("settling");
  }, WHEEL_IDLE);
}
/* a pause short of the line: back to rest */
function springBack(){
  if(!pull.amount) return;
  const dir = pull.dir, give = pullGiveNow(), A = $views.clientHeight;
  const timing = { duration: 180, easing: morphEase() };
  const anims = [$pullHint.animate([{ opacity: $pullHint.style.opacity }, { opacity: 0 }], timing)];
  if(dir === "up"){
    const floor = A - UI.canvas.railOpenH;
    anims.push($tlWrap.animate([{ transform:`translateY(${give}px)` }, { transform:"none" }], timing),
               $canvasView.animate([{ transform:`translateY(${give - floor}px)` }, { transform:`translateY(${-floor}px)` }], timing));
  } else {
    anims.push($rail.animate([{ height: $rail.style.height }, { height: UI.canvas.railOpenH + "px" }], timing));
  }
  pull.amount = 0;
  pull.spring = anims;                                            // not a motion that blocks: the next pull may interrupt it
  Promise.all(anims.map(a => a.finished)).then(() => { if(pull.spring === anims){ pull.spring = null; endPull(); } }, () => {});
}
/* everything back to rest; kept: the motion that follows takes over from the current transforms */
function endPull(keep){
  const dir = pull.dir;
  pull.amount = 0;
  $pullHint.style.opacity = 0;
  $views.classList.remove("pulling-up", "pulling-down");
  if(keep) return;
  if(dir === "up"){ $tlWrap.style.transform = $canvasView.style.transform = ""; if(!UI.canvas.active) hideCanvas(); }
  else { setRailHeight(); if(!UI.canvas.hover) openRail(false); }
}

/* ── the canvas: dragging its empty grid pans it (a mouse has no sideways wheel) ── */
$canvasGrid.addEventListener("pointerdown", e => {
  if(e.button !== 0 || e.target.closest("#rail") || !UI.canvas.active || UI.canvas.moving) return;
  const x0 = e.clientX, y0 = e.clientY, l0 = $canvasScene.scrollLeft, t0 = $canvasScene.scrollTop;
  $canvasGrid.setPointerCapture(e.pointerId);
  $canvasGrid.classList.add("panning");
  const move = m => { $canvasScene.scrollLeft = l0 - (m.clientX - x0); $canvasScene.scrollTop = t0 - (m.clientY - y0); };
  const up = () => {
    $canvasGrid.classList.remove("panning");
    $canvasGrid.removeEventListener("pointermove", move);
    $canvasGrid.removeEventListener("pointerup", up); $canvasGrid.removeEventListener("pointercancel", up);
  };
  $canvasGrid.addEventListener("pointermove", move);
  $canvasGrid.addEventListener("pointerup", up); $canvasGrid.addEventListener("pointercancel", up);
});

/* ── the rail: opens while the pointer rests on it; a click opens what it hits, as on the timeline ── */
let railHoverT = null;
$rail.addEventListener("pointerenter", () => {
  UI.canvas.hover = true; clearTimeout(railHoverT);
  railHoverT = setTimeout(() => { if(UI.canvas.active && !UI.canvas.moving) openRail(true); }, RAIL_HOVER_OPEN);
});
$rail.addEventListener("pointerleave", () => {
  UI.canvas.hover = false; clearTimeout(railHoverT);
  railHoverT = setTimeout(() => { if(UI.canvas.active && !UI.canvas.moving && !pull.amount) openRail(false); }, RAIL_HOVER_CLOSE);
});
$rail.addEventListener("click", onTimelineClick);
