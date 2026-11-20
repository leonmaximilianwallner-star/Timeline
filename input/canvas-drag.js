// input/canvas-drag.js — the canvas's rules for the one drag (input/pointer.js dragRect): drawing, moving and resizing ideas.
"use strict";
/* ════════════════════════════════════════════════════════════
   An idea is a rectangle of cells: x a day, y a row (counted from the grid's top while dragging, stored from the floor).
   Both axes are cells, so its corners always sit on dots. It moves on both axes and resizes from every edge and
   corner, never below one cell. Draw mode (the add button in the canvas): a drag on the empty grid creates one,
   and one drawn idea ends the mode, as one created event ends add mode. On an idea, a drag moves or resizes it,
   in draw mode too: the thing under the pointer comes first (Max, 20 Nov).
   ════════════════════════════════════════════════════════════ */
const $canvasIdeas = document.getElementById("canvasIdeas");
let cancelDraw = null;                             // the draw in progress: cancelled by Escape or the add button

function setDrawMode(on){
  if(!on && cancelDraw) cancelDraw();                              // never a half-drawn idea
  UI.drawMode = on;
  $fab.classList.toggle("on", on);
  $fab.title = on ? "Zeichnen beenden (Esc)" : "Hinzufügen (A)";
  document.documentElement.toggleAttribute("data-draw", on);     // touch-action:none on the canvas, before any gesture
}

function canvasRules(){
  const box = $canvasGrid.getBoundingClientRect(), rows = UI.canvas.rows;   // measured once a drag
  return { cells:"xy", min:{ w:1, h:1 }, layer:$canvasIdeas,
    at:m => ({ x:Math.floor((m.clientX - box.left) / CANVAS_CELL), y:Math.floor((m.clientY - box.top) / CANVAS_CELL) }),
    place:(g, r) => { g.el.style.cssText += ";" + ideaStyle(r.x, rows - r.y - r.h, r.w, r.h); },   // shaped as an idea (styles/canvas.css)
    save:(t, r) => Object.assign(t, { day:idxDate(r.x), row:rows - r.y - r.h, w:r.w, h:r.h }) };
}

/* draw mode, on the empty grid (input/canvas-pull.js) */
function startDraw(e){
  const rules = canvasRules();
  cancelDraw = dragRect(e, { ...rules, zone:"new", rect:{ ...rules.at(e), w:0, h:0 }, el:$canvasGrid,
    done:(r, moved) => {
      cancelDraw = null;
      if(!moved || r.w * r.h === 1) return;                        // a click or a drag within one cell: nothing
      mutate(plan => { plan.ideas.push(rules.save({ id:uid(), tabId:activeCanvasTab().id }, r)); });
      setDrawMode(false);
    } });
}

/* on an idea: within EDGE of its outline resizes from that side, anywhere else moves it. In a rounded corner the
   outline is the arc, and near it both sides move: a corner */
function startIdeaDrag(e, el){
  const idea = S.ideas.find(x => x.id === el.dataset.idea); if(!idea) return;
  const rules = canvasRules(), b = el.getBoundingClientRect(), R = Math.min(CANVAS_CELL / 2, b.width / 2, b.height / 2);
  const dl = e.clientX - b.left, dr = b.right - e.clientX, dt = e.clientY - b.top, db = b.bottom - e.clientY;
  const dx = Math.min(dl, dr), dy = Math.min(dt, db), corner = dx < R && dy < R && R - Math.hypot(R - dx, R - dy) <= EDGE;
  const zone = ((corner || dx <= EDGE ? (dl < dr ? "l" : "r") : "") + (corner || dy <= EDGE ? (dt < db ? "t" : "b") : "")) || "move";
  dragRect(e, { ...rules, zone, el, dim:el, rect:{ x:dayIdx(idea.day), y:UI.canvas.rows - idea.row - idea.h, w:idea.w, h:idea.h },
    done:(r, moved) => { if(moved) mutate(plan => { rules.save(plan.ideas.find(x => x.id === idea.id), r); }); } });
}
