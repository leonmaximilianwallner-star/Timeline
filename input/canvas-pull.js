// input/canvas-pull.js — the wheel moves between the week and the canvas; panning the canvas (Max, 11 Nov 2026).
"use strict";
/* The hand moves between the week and the canvas (ui/canvas-morph.js), 1:1, two ways:
   - a pinch on the trackpad: together toward the canvas (more days), apart toward the week. It is a zoom, as this is.
   - scrolling past the edge: up from the week's top, down from the canvas's floor. Only a gesture that starts at the
     edge; a fling that runs into it stops there.
   A trackpad says nothing when the fingers rest or lift, so a quiet stretch counts as letting go (PINCH_IDLE,
   WHEEL_IDLE). Safari's pinch says when the fingers lift (gestureend): there, holding still holds.
   A scroll's momentum goes on after the fingers lift and is the hand's by right: carried to an edge, it lands
   there and then, and the rest of that gesture goes nowhere (.held). */
const WHEEL_IDLE = 140;        // ms without a scroll event: let go
const PINCH_IDLE = 220;        // ms without a pinch event: let go (generous: a pause in a pinch is not a release)
const PINCH_FULL = 90;         // pinch (ctrl+wheel delta) for the whole way: about one comfortable pinch
const RAIL_HOVER_OPEN  = 120;  // ms over the rail before it opens
const RAIL_HOVER_CLOSE = 280;  // ms away from it before it closes

let wheelLast = 0, wheelIdle = 0, pinchScale = 1;
const pointerAt = { x:-1, y:-1 };   // where the pointer last was: whether it rests on the rail when the canvas lands
document.addEventListener("pointermove", e => { pointerAt.x = e.clientX; pointerAt.y = e.clientY; }, { passive:true });
const canvasCanStart = () => !UI.editor && !UI.focus && !UI.budgetOpen && !UI.settingsOpen && !UI.addMode && !UI.dayTodos && !UI.dragLive;
const atFloor = () => $canvasScene.scrollTop >= $canvasScene.scrollHeight - $canvasScene.clientHeight - 1;

/* not passive: a pinch must not zoom the page (preventDefault). Every other wheel returns at once */
$views.addEventListener("wheel", e => {
  if(e.ctrlKey){ e.preventDefault(); return onPinch(e.deltaY); }
  onScroll(e);
}, { passive:false });
/* Safari's pinch: scale since the start; gestureend is the fingers lifting */
$views.addEventListener("gesturestart", e => { e.preventDefault(); pinchScale = 1; }, { passive:false });
$views.addEventListener("gesturechange", e => { e.preventDefault(); onPinch(100 * Math.log(pinchScale / e.scale)); pinchScale = e.scale; }, { passive:false });
$views.addEventListener("gestureend", e => { e.preventDefault(); clearTimeout(wheelIdle); morphRelease(); }, { passive:false });

/* d > 0: together, toward the canvas */
function onPinch(d){
  const now = performance.now(), fresh = now - wheelLast > PINCH_IDLE;
  wheelLast = now;
  if(!morph.on){
    if(!fresh) return;
    if(!UI.canvas.active && d > 0 && canvasCanStart()) morphStart(0);
    else if(UI.canvas.active && d < 0) morphStart(1);
    else return;
  }
  morphHold(d * morph.floor / PINCH_FULL);
  clearTimeout(wheelIdle);
  wheelIdle = setTimeout(() => morphRelease(), PINCH_IDLE);
}

function onScroll(e){
  const now = performance.now(), fresh = now - wheelLast > WHEEL_IDLE;
  wheelLast = now;
  if($views.classList.contains("held")){ clearTimeout(wheelIdle); wheelIdle = setTimeout(() => $views.classList.remove("held"), WHEEL_IDLE); return; }
  if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;            // sideways: panning, never between the views
  const el = UI.canvas.active ? $canvasScene : $scene;
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
  if(!morph.on){
    if(!fresh) return;
    if(!UI.canvas.active && dy < 0 && $scene.scrollTop <= 0 && canvasCanStart()) morphStart(0);
    else if(UI.canvas.active && dy > 0 && atFloor()) morphStart(1);
    else return;
  }
  morphHold(-dy);
  clearTimeout(wheelIdle);
  if(morph.y === 0 || morph.y === morph.floor){                  // carried to an edge: lands now
    morphEnd(+(morph.y > 0)); $views.classList.add("held");
    wheelIdle = setTimeout(() => $views.classList.remove("held"), WHEEL_IDLE);
  }
  else wheelIdle = setTimeout(() => morphRelease(), WHEEL_IDLE);
}

/* ── the canvas: dragging its empty grid pans it (a mouse has no sideways wheel) ── */
$canvasGrid.addEventListener("pointerdown", e => {
  if(e.button !== 0 || e.target.closest("#rail") || !UI.canvas.active || morph.on) return;
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
  railHoverT = setTimeout(() => { if(UI.canvas.active && !morph.on) openRail(true); }, RAIL_HOVER_OPEN);
});
$rail.addEventListener("pointerleave", () => {
  UI.canvas.hover = false; clearTimeout(railHoverT);
  railHoverT = setTimeout(() => { if(UI.canvas.active && !morph.on) openRail(false); }, RAIL_HOVER_CLOSE);
});
$rail.addEventListener("click", onTimelineClick);
