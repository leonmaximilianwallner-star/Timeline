// input/canvas-pull.js — getting between the week and the canvas by scrolling past the edge; panning the canvas (Max, 10 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   The pull: the same mechanic as pulling the editor up into Fokus (ui/editor.js), with the wheel for a finger.
   - Up, from the week's top: the week sinks and the canvas shows above it.
   - Down, from the canvas's floor: the rail opens and grows.
   Before the line it holds back, at the line it springs and is armed (pullGive, PULL_FOCUS: the editor's curve,
   one for both). It commits on release, and a wheel's release is the pause after its gesture (WHEEL_IDLE).
   No early commit: only a gesture that starts at the edge pulls. A fling that runs into the edge, or a scroll
   that keeps going past it, stops there; the next gesture pulls. A sideways gesture never pulls.
   Pointer Events and wheel only; everything here is passive, so native scrolling never waits for it.
   ════════════════════════════════════════════════════════════ */
const WHEEL_LINE = 240;        // px of wheel past the edge to the line: a deliberate trackpad swipe, or about three notches
const WHEEL_IDLE = 140;        // ms without a wheel event: the gesture is over (the wheel's release)
const RAIL_HOVER_OPEN  = 120;  // ms over the rail before it opens
const RAIL_HOVER_CLOSE = 280;  // ms away from it before it closes

const $pullHint = document.getElementById("pullHint");
const pull = { dir:null, fromEdge:false, last:0, amount:0, armed:false, timer:null };

const canvasCanStart = () => !UI.editor && !UI.focus && !UI.budgetOpen && !UI.settingsOpen && !UI.addMode && !UI.dayTodos && !UI.dragLive;
const wheelPx = (e, el) => e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
const atTop   = el => el.scrollTop <= 0;
const atFloor = el => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;

$scene.addEventListener("wheel", e => onPullWheel(e, "up"), { passive:true });
$canvasScene.addEventListener("wheel", e => onPullWheel(e, "down"), { passive:true });

function onPullWheel(e, dir){
  if(UI.canvas.moving || (dir === "up" ? UI.canvas.active : !UI.canvas.active)) return;
  const el = dir === "up" ? $scene : $canvasScene, now = performance.now();
  if(now - pull.last > WHEEL_IDLE && !pull.amount){              // a new gesture: it may pull only if it starts at the edge
    pull.dir = dir;
    pull.fromEdge = (dir === "up" ? atTop(el) : atFloor(el)) && (dir === "down" || canvasCanStart());
  }
  pull.last = now;
  if(!pull.fromEdge || pull.dir !== dir || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const d = wheelPx(e, el) * (dir === "up" ? -1 : 1);            // positive: toward the other view
  if(!pull.amount && d <= 0) return;                              // moving away from the edge: plain scrolling
  if(!pull.amount) startPull(dir);
  pull.amount = Math.max(0, pull.amount + d);
  showPull();
  clearTimeout(pull.timer);
  pull.timer = setTimeout(releasePull, WHEEL_IDLE);
  if(!pull.amount){ clearTimeout(pull.timer); endPull(); }        // pulled back to nothing: done, no motion
}

function startPull(dir){
  $views.classList.add("pulling", "pulling-" + dir);            // the scroller being pulled stops scrolling vertically (styles/canvas.css)
  if(dir === "up") showCanvas();
  else openRail(true);
  $pullHint.textContent = dir === "up" ? "Leinwand" : "Zeitleiste";
  $pullHint.dataset.dir = dir;
}
/* where everything is for a pull of pull.amount; the editor's curve, the wheel's line mapped onto its line */
function pullGiveNow(){ return pullGive(pull.amount * PULL_FOCUS / WHEEL_LINE); }
function showPull(){
  const give = pullGiveNow(), armed = pull.amount >= WHEEL_LINE, A = $views.clientHeight;
  if(armed !== pull.armed){ pull.armed = armed; $pullHint.classList.toggle("armed", armed); }
  if(pull.dir === "up"){
    const floor = A - UI.canvas.railOpenH;                        // where the rail's top will be
    $scene.style.transform = `translateY(${give}px)`;
    $canvasView.style.transform = `translateY(${give - floor}px)`; // the canvas's floor stays on the week's top edge
    $pullHint.style.top = (give - 44) + "px";
  } else {
    setRailHeight(give);
    $pullHint.style.top = (A - UI.canvas.railOpenH - give - 44) + "px";
  }
  $pullHint.style.opacity = Math.min(1, give / 28);
}
/* the gesture is over: armed, the motion starts from where things are; otherwise back to rest */
function releasePull(){
  const dir = pull.dir, give = pullGiveNow(), armed = pull.armed;
  if(!pull.amount) return;
  if(armed){
    endPull(true);
    if(dir === "up") morphToCanvas(give); else morphToWeek();
    return;
  }
  const ease = morphEase(), timing = { duration: 220, easing: ease };
  const anims = [$pullHint.animate([{ opacity: $pullHint.style.opacity }, { opacity: 0 }], timing)];
  if(dir === "up"){
    const floor = $views.clientHeight - UI.canvas.railOpenH;
    anims.push($scene.animate([{ transform:`translateY(${give}px)` }, { transform:"none" }], timing),
               $canvasView.animate([{ transform:`translateY(${give - floor}px)` }, { transform:`translateY(${-floor}px)` }], timing));
    $scene.style.transform = ""; $canvasView.style.transform = `translateY(${-floor}px)`;
  } else {
    anims.push($rail.animate([{ height: $rail.style.height }, { height: UI.canvas.railOpenH + "px" }], timing));
  }
  pull.amount = 0;
  UI.canvas.moving = true;
  morphDone(anims, () => { UI.canvas.moving = false; endPull(); });
}
/* everything back to rest; kept: the motion that follows takes over from the current transforms */
function endPull(keep){
  const dir = pull.dir;
  pull.amount = 0; pull.armed = false;
  $pullHint.classList.remove("armed"); $pullHint.style.opacity = 0;
  $views.classList.remove("pulling", "pulling-up", "pulling-down");
  if(keep) return;
  if(dir === "up"){ $scene.style.transform = ""; $canvasView.style.transform = ""; if(!UI.canvas.active) hideCanvas(); }
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
