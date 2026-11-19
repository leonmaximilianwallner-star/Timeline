// input/canvas-draw.js — draw mode on the canvas: a drag draws an idea on the grid's cells (Max, 19 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   The add button's action in the canvas (input/add-mode.js). In draw mode a drag on the grid draws instead of
   panning: from the cell it started in to the cell under the pointer, both included, so its corners sit on dots.
   One row is a pill, more rows a squircle (RULEBOOK A.5, Idea). One drawn idea ends the mode, as one created
   event ends add mode. Pointer rules (gesture-motion): touch-action set before the gesture, capture only after
   the slop, one pointer, the grid measured once, the preview written only when the cell changes.
   ════════════════════════════════════════════════════════════ */
const DRAW_SLOP = { touch:10, pen:2, mouse:2 };   // px before a press becomes a drag (Vaul's values)

const $canvasIdeas = document.getElementById("canvasIdeas");
let drawGesture = null;                            // the drag in progress, while there is one: { cancel }

function setDrawMode(on){
  if(!on && drawGesture) drawGesture.cancel();                    // never a half-drawn idea
  UI.drawMode = on;
  $fab.classList.toggle("on", on);
  $fab.title = on ? "Zeichnen beenden (Esc)" : "Hinzufügen (A)";
  document.documentElement.toggleAttribute("data-draw", on);     // touch-action:none on the canvas, before any gesture
}

/* called by the grid's pointerdown in draw mode (input/canvas-pull.js) */
function startDraw(e){
  if(drawGesture) return;                                         // one pointer draws; a second finger is ignored
  const box = $canvasGrid.getBoundingClientRect(), rows = UI.canvas.rows;
  const cellAt = p => [Math.floor((p.clientX - box.left) / CANVAS_CELL), Math.floor((p.clientY - box.top) / CANVAS_CELL)];
  const [c0, r0] = cellAt(e), id = e.pointerId, slop = DRAW_SLOP[e.pointerType] ?? 2;
  let preview = null, rect = null, key = "";

  const move = m => {
    if(m.pointerId !== id) return;
    if(!preview){
      if(Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) < slop) return;
      $canvasGrid.setPointerCapture(id);                          // only now: a click stays a click
      preview = document.createElement("div");
      $canvasIdeas.append(preview);
    }
    const [c1, r1] = cellAt(m), k = c1 + "," + r1;
    if(k === key) return;                                         // the same cell: nothing to write
    key = k;
    const c = Math.min(c0, c1), r = Math.min(r0, r1), w = Math.abs(c1 - c0) + 1, h = Math.abs(r1 - r0) + 1;
    rect = w > 1 || h > 1 ? { c, w, h, row: rows - r - h } : null;   // row: counted up from the floor
    preview.hidden = !rect;
    if(rect){ preview.className = ideaClass(h) + " preview"; preview.style.cssText = ideaStyle(c, rect.row, w, h); }
  };
  const end = commit => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
    if(preview) preview.remove();
    drawGesture = null;
    if(!commit || !rect) return;                                  // a click or a drag within one cell: nothing
    const idea = { id:uid(), tabId:activeCanvasTab().id, day:idxDate(rect.c), row:rect.row, w:rect.w, h:rect.h };
    mutate(plan => { plan.ideas.push(idea); });
    setDrawMode(false);
  };
  const up = u => { if(u.pointerId === id) end(true); };
  const cancel = c => { if(c.pointerId === id) end(false); };   // the browser took it: no idea
  document.addEventListener("pointermove", move);                 // the document: before the capture, the pointer may leave the grid
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
  drawGesture = { cancel: () => end(false) };
}
