// views/canvas/render.js — the canvas view: the endless dot grid above the timeline view, and its rail (Max, 10 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   The canvas view sits above the timeline view (RULEBOOK B.6.1). It is its own native scroller
   (#canvasScene), stacked over the week's (#scene), because one native scroller serves one scale
   (ARCHITECTURE §6): the week's is a day per column, the canvas's a day per grid cell (CANVAS_CELL).
   Only one of the two is ever in use; position passes between them once, at the switch, as the day
   at the left edge (views/viewport.js). Nothing is kept in step frame by frame.

   Horizontal: day i at x = i × CANVAS_CELL, over the same days as the week (UI.range), so dayIdx serves both.
   Vertical: the grid's floor is its bottom edge; it grows upward without end (rows are added near the top).
   The rail: the timeline view drawn by its own rule at the canvas's scale (buildTimeline), pinned to the
   floor with position:sticky, so it moves with the canvas on the compositor, never a frame behind.
   ════════════════════════════════════════════════════════════ */
const CANVAS_CELL = 40;      // px per grid cell = per day: about a month across a laptop screen
const CANVAS_ROWS = 120;     // rows the grid starts with; this many more are added as you near its top
const CANVAS_EDGE = 800;     // px from the top at which the grid grows
const RAIL_THIN   = 64;      // px: the closed rail at most (months, then phases as lines)
const RAIL_OPEN   = 0.45;    // the open rail at most, as a share of the view's height

const $views       = document.getElementById("views");
const $canvasView  = document.getElementById("canvasView");
const $canvasScene = document.getElementById("canvasScene");
const $canvasGrid = document.getElementById("canvasGrid");
const $rail        = document.getElementById("rail");
const $railInner   = document.getElementById("railInner");

UI.canvas = {
  shown:false,      // in play: during a pull, a motion, or while it is the view
  stale:true,       // the rail needs drawing (the plan changed while the canvas was out of play)
  active:false,     // the canvas is the view in use
  rows:CANVAS_ROWS,
  railOpen:false, hover:false,
  railOpenH:0, railThinH:0,
};
document.documentElement.style.setProperty("--cell", CANVAS_CELL + "px");

/* draws the grid's size and the rail. renderAll calls it on every change: in play it draws at once; out of play
   it only notes the change and draws when the browser is idle, so the first wheel of a pull finds it ready */
const CANVAS_IDLE = 12;      // ms of a quiet stretch the drawing needs; in a shorter one it waits (it would delay a motion)
let _idleCanvas = false;
function renderCanvas(){
  if(!UI.canvas.shown){ UI.canvas.stale = true; drawCanvasWhenIdle(); return; }
  drawCanvas();
}
function drawCanvasWhenIdle(){
  if(_idleCanvas) return;
  _idleCanvas = true;
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 50 }), 300));   // Safari: no idle callback
  idle(deadline => {
    _idleCanvas = false;
    if(UI.canvas.shown || !UI.canvas.stale) return;
    if(deadline.timeRemaining() < CANVAS_IDLE) return drawCanvasWhenIdle();   // not quiet enough: the next stretch
    drawCanvas();
  });
}
function drawCanvas(){
  UI.canvas.stale = false;
  const w = UI.range.days * CANVAS_CELL;
  $canvasGrid.style.width = w + "px";
  $canvasGrid.style.height = UI.canvas.rows * CANVAS_CELL + "px";
  const frag = buildTimeline(CANVAS_CELL, true);
  $railInner.replaceChildren(frag);
  $railInner.style.width = w + "px";
  fitLabels(frag);
  measureRail();
}

/* the rail's two heights: closed (months, then lines) and open (the timeline's own rows), each capped */
function measureRail(){
  const wasOpen = $rail.classList.contains("open");
  $rail.classList.add("measuring");                              // no transitions while it is measured
  $rail.classList.add("open");    const open = $railInner.offsetHeight;
  $rail.classList.remove("open"); const thin = $railInner.offsetHeight;
  $rail.classList.toggle("open", wasOpen);
  void $rail.offsetHeight;
  $rail.classList.remove("measuring");
  UI.canvas.railOpenH = Math.min(open, Math.round($views.clientHeight * RAIL_OPEN));
  UI.canvas.railThinH = Math.min(thin, RAIL_THIN);
  setRailHeight();
}
/* the rail's height: closed or open */
function setRailHeight(extra = 0){
  $rail.style.height = (UI.canvas.railOpen ? UI.canvas.railOpenH : UI.canvas.railThinH) + extra + "px";
}
function openRail(open, instant){
  if(UI.canvas.railOpen === open) return;
  UI.canvas.railOpen = open;
  if(instant) $rail.classList.add("measuring");                  // no motion: it isn't seen (under the timeline it replaces)
  $rail.classList.toggle("open", open);
  setRailHeight();
  if(instant){ void $rail.offsetHeight; $rail.classList.remove("measuring"); }
}

/* puts the canvas in play under the week, at the week's day, its floor in view. Usually already drawn (idle) */
function showCanvas(){
  UI.canvas.shown = true;
  openRail(true, true);                                           // a motion lands on the open rail: the same rows as the timeline
  if(UI.canvas.stale) drawCanvas();
  $canvasScene.scrollTop = $canvasScene.scrollHeight;            // the floor
  canvasScrollToDay(weekLeftDay());
}
function hideCanvas(){
  UI.canvas.shown = UI.canvas.active = false;                     // its drawing is kept: the next pull finds it ready
}

/* the grid grows upward when its top comes near; the days grow sideways like the week's (views/viewport.js) */
function maybeGrowCanvas(){
  if($canvasScene.scrollTop >= CANVAS_EDGE) return;
  const y = $canvasScene.scrollTop;
  UI.canvas.rows += CANVAS_ROWS;
  $canvasGrid.style.height = UI.canvas.rows * CANVAS_CELL + "px";
  $canvasScene.scrollTop = y + CANVAS_ROWS * CANVAS_CELL;         // rows added above: the view stays where it was
}
