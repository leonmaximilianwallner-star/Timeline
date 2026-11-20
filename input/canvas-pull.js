// input/canvas-pull.js — the wheel moves between the week and the canvas; panning the canvas (Max, 11 Nov 2026; 20 Nov 2026).
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
const PINCH_SLOP = 24;         // px two fingers' spread must change before they pinch; until then they pan
const RAIL_HOVER_OPEN  = 120;  // ms over the rail before it opens
const RAIL_HOVER_CLOSE = 280;  // ms away from it before it closes

let wheelLast = 0, wheelIdle = 0, pinchScale = 1;
const pointerAt = { x:-1, y:-1 };   // where the pointer last was: whether it rests on the rail when the canvas lands
document.addEventListener("pointermove", e => { pointerAt.x = e.clientX; pointerAt.y = e.clientY; }, { passive:true });
const canvasCanStart = () => !UI.editor && !UI.focus && !UI.budgetOpen && !UI.settingsOpen && !UI.addMode && !UI.dayTodos && !UI.dragLive;
const atFloor = () => $canvasScene.scrollTop >= $canvasScene.scrollHeight - $canvasScene.clientHeight - 1;

/* not passive: a pinch must not zoom the page (preventDefault). Every other wheel returns at once */
$views.addEventListener("wheel", e => {
  if(e.ctrlKey){ e.preventDefault(); return onPinch(e.deltaY, e.timeStamp); }
  onScroll(e);
}, { passive:false });
/* Safari's pinch: scale since the start; gestureend is the fingers lifting.
   Two fingers on the canvas are read from their pointers instead (below), so Safari's own pinch is not counted twice */
$views.addEventListener("gesturestart", e => { e.preventDefault(); pinchScale = 1; }, { passive:false });
$views.addEventListener("gesturechange", e => { e.preventDefault(); if(twoFingers) return; onPinch(100 * Math.log(pinchScale / e.scale), e.timeStamp); pinchScale = e.scale; }, { passive:false });
$views.addEventListener("gestureend", e => { e.preventDefault(); if(twoFingers) return; clearTimeout(wheelIdle); morphRelease(); }, { passive:false });

/* d > 0: together, toward the canvas */
function onPinch(d, t){
  const now = performance.now(), fresh = now - wheelLast > PINCH_IDLE;
  wheelLast = now;
  if(!morph.on){
    if(!fresh) return;
    if(!UI.canvas.active && d > 0 && canvasCanStart()) morphStart(0);
    else if(UI.canvas.active && d < 0) morphStart(1);
    else return;
  }
  morphHold(d * morph.floor / PINCH_FULL, t);
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
  morphHold(-dy, e.timeStamp);
  clearTimeout(wheelIdle);
  if(morph.y === 0 || morph.y === morph.floor){                  // carried to an edge: lands now
    morphEnd(+(morph.y > 0)); $views.classList.add("held");
    wheelIdle = setTimeout(() => $views.classList.remove("held"), WHEEL_IDLE);
  }
  else wheelIdle = setTimeout(() => morphRelease(), WHEEL_IDLE);
}

/* ── panning the canvas (Max, 20 Nov): never the plain drag, which is left for selecting ──
   Space held + drag, Shift + drag (as in CAD), the middle button, anywhere on the canvas, over ideas and the rail too;
   a trackpad's two-finger scroll (the browser's own, above); on touch, two fingers. A pan press decides first
   (capture, before the rail's and the ideas' own handlers). The hand while Space is held, the closed hand while
   panning (styles/canvas.css, styles/base.css) */
let spaceHeld = false, oneFinger = null, twoFingers = null;   // oneFinger: cancel() of the gesture a first finger began
const touches = new Map();                                   // the touch pointers down on the canvas: id → { x, y }
const typingNow = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
function holdSpace(on){ spaceHeld = on; document.documentElement.toggleAttribute("data-pan-ready", on); }
document.addEventListener("keydown", e => {
  if(e.code !== "Space" || !UI.canvas.active || typingNow()) return;
  e.preventDefault();                                            // no page scroll, no click on a focused button
  if(!e.repeat) holdSpace(true);
});
document.addEventListener("keyup", e => { if(e.code === "Space" && spaceHeld){ e.preventDefault(); holdSpace(false); } });
window.addEventListener("blur", () => holdSpace(false));         // released elsewhere: not held any more
$canvasGrid.addEventListener("mousedown", e => { if(e.button === 1) e.preventDefault(); });   // no autoscroll on the middle button

/* a pan by one pointer: the grid follows it 1:1. click(): it ended without moving (Shift + click on an idea, part E) */
function startPan(e, click){
  const x0 = e.clientX, y0 = e.clientY, l0 = $canvasScene.scrollLeft, t0 = $canvasScene.scrollTop;
  let moved = false;
  const move = m => {
    if(m.pointerId !== e.pointerId) return;
    if(!moved){
      if(Math.hypot(m.clientX - x0, m.clientY - y0) <= MOVE_THRESHOLD) return;
      moved = true; $canvasGrid.setPointerCapture(e.pointerId); $canvasGrid.classList.add("panning");
      document.documentElement.dataset.drag = "pan";             // the closed hand, wherever the pointer goes
    }
    $canvasScene.scrollLeft = l0 - (m.clientX - x0); $canvasScene.scrollTop = t0 - (m.clientY - y0);
  };
  const end = u => {
    if(u.pointerId !== e.pointerId) return;
    $canvasGrid.classList.remove("panning"); delete document.documentElement.dataset.drag;
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
    if(!moved && u.type === "pointerup" && click) click();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
}

/* two fingers: their middle pans, their spread is a pinch (onPinch: toward the week or the canvas, as a trackpad's) */
function startTwoFingers(){
  if(oneFinger){ oneFinger(); oneFinger = null; }                 // a second finger: what the first began is undone
  const pts = () => [...touches.values()].slice(0, 2);
  const mid = () => { const [a, b] = pts(); return { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2, d:Math.hypot(a.x - b.x, a.y - b.y) }; };
  const start = mid(), l0 = $canvasScene.scrollLeft, t0 = $canvasScene.scrollTop;
  let last = null;                                               // set once the fingers have spread or closed enough to be a pinch
  twoFingers = m => {
    const now = mid();
    if(!last && Math.abs(now.d - start.d) > PINCH_SLOP) last = now;   // two fingers never move quite together: a pan until then
    if(!last){ $canvasScene.scrollLeft = l0 - (now.x - start.x); $canvasScene.scrollTop = t0 - (now.y - start.y); return; }   // from the start, as one finger's pan
    if(now.d > 0 && last.d > 0 && now.d !== last.d) onPinch(100 * Math.log(last.d / now.d), m.timeStamp);
    last = now;
  };
}
window.addEventListener("pointermove", e => {
  if(!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(twoFingers && touches.size >= 2) twoFingers(e);
});
const liftTouch = e => {
  if(!touches.delete(e.pointerId)) return;
  if(twoFingers && touches.size < 2){ twoFingers = null; if(morph.on){ clearTimeout(wheelIdle); morphRelease(); } }
  if(!touches.size) oneFinger = null;
};
window.addEventListener("pointerup", liftTouch); window.addEventListener("pointercancel", liftTouch);

$canvasGrid.addEventListener("pointerdown", e => {
  if(!UI.canvas.active || morph.on) return;
  if(e.pointerType === "touch"){
    touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(touches.size === 2){ e.stopPropagation(); return startTwoFingers(); }
    if(touches.size > 2){ e.stopPropagation(); return; }
  }
  if(e.button === 1 || (e.button === 0 && (spaceHeld || e.shiftKey))){
    e.stopPropagation(); e.preventDefault();                     // the rail's and the ideas' own handlers never see it
    const idea = e.shiftKey && !spaceHeld && e.button === 0 && !e.target.closest("#rail") && e.target.closest(".idea");
    return startPan(e, idea ? () => toggleSelected(idea.dataset.idea) : null);   // Shift + click on an idea: in or out of the selection
  }
}, true);

/* ── the canvas, after panning has had its say: the thing under the pointer first, then draw mode, then the marquee ── */
$canvasGrid.addEventListener("pointerdown", e => {
  if(e.button !== 0 || e.target.closest("#rail") || !UI.canvas.active || morph.on || twoFingers) return;
  const idea = e.target.closest(".idea");
  if(idea){ oneFinger = startIdeaDrag(e, idea); return; }         // move or resize it (input/canvas-drag.js)
  if(UI.drawMode){ oneFinger = startDraw(e); return; }           // draw mode: the drag draws
  oneFinger = startMarquee(e);                                     // else it selects (input/canvas-select.js)
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
$rail.addEventListener("pointerdown", onTimelinePointerDown);   // resize, create: the timeline's own code (input/timeline-drag.js)
