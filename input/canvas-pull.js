// input/canvas-pull.js — the wheel moves between the week and the canvas; panning the canvas (Max, 11 Nov 2026).
"use strict";
/* Scrolling past the edge holds the position between the views (ui/canvas-morph.js) and moves it 1:1: a pixel of
   scrolling, a pixel of movement; a trackpad's momentum keeps moving it, as a finger would. When the wheel goes
   quiet (WHEEL_IDLE) it is let go. Scrolling again while it settles catches it.
   It takes hold only by a gesture that starts at the edge: the week's top going up, the canvas's floor going down.
   A fling that runs into the edge stops there; so does a gesture that already moved between the views.
   Passive: native scrolling never waits for it. */
const WHEEL_IDLE = 140;        // ms without a wheel event: let go
const RAIL_HOVER_OPEN  = 120;  // ms over the rail before it opens
const RAIL_HOVER_CLOSE = 280;  // ms away from it before it closes

let wheelLast = 0, wheelIdle = 0;
const canvasCanStart = () => !UI.editor && !UI.focus && !UI.budgetOpen && !UI.settingsOpen && !UI.addMode && !UI.dayTodos && !UI.dragLive;
const wheelPx = (e, el) => e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;

$scene.addEventListener("wheel", e => onViewWheel(e, $scene), { passive:true });
$canvasScene.addEventListener("wheel", e => onViewWheel(e, $canvasScene), { passive:true });

function onViewWheel(e, el){
  const now = performance.now(), fresh = now - wheelLast > WHEEL_IDLE;
  wheelLast = now;
  if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;            // sideways: panning, never between the views
  const dy = wheelPx(e, el);
  if(!morph.on){
    if(!fresh) return;
    if(!UI.canvas.active && dy < 0 && $scene.scrollTop <= 0 && canvasCanStart()) morphStart(0);
    else if(UI.canvas.active && dy > 0 && $canvasScene.scrollTop >= $canvasScene.scrollHeight - $canvasScene.clientHeight - 1) morphStart(1);
    else return;
  }
  cancelAnimationFrame(morph.raf);                                 // caught mid-settle: the hand has it again
  morphTo(Math.min(1, Math.max(0, morph.p - dy / morph.floor)));
  clearTimeout(wheelIdle);
  wheelIdle = setTimeout(() => morphRelease(), WHEEL_IDLE);
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
