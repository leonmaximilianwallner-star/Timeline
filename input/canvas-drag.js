// input/canvas-drag.js — the canvas's rules for the one drag (input/pointer.js dragRect): drawing, moving and resizing ideas.
"use strict";
/* ════════════════════════════════════════════════════════════
   An idea is a rectangle of cells: x a day, y a row (counted from the grid's top while dragging, stored from the floor).
   Both axes are cells, so its corners always sit on dots. It moves on both axes and resizes from every edge and
   corner, never below one cell. The last one created, moved or resized is drawn in front (z). Draw mode (the add button in the canvas): a drag on the empty grid creates one,
   and one drawn idea ends the mode, as one created event ends add mode. On an idea, a drag moves or resizes it,
   in draw mode too: the thing under the pointer comes first (Max, 20 Nov). A press makes it the selection; when it is
   one of several selected, they all move together, each with its ghost, as one change and one undo step
   (input/canvas-select.js). Resizing stays one idea's.
   ════════════════════════════════════════════════════════════ */
const $canvasIdeas = document.getElementById("canvasIdeas");
let cancelDraw = null;                             // the draw in progress: cancelled by Escape or the add button

function setDrawMode(on){
  if(!on && cancelDraw) cancelDraw();                              // never a half-drawn idea
  UI.drawMode = on;
  $fab.classList.toggle("on", on); setIcon($fab, on);   // plus ⇄ X, as add mode
  $fab.title = on ? "Zeichnen beenden (Esc)" : "Hinzufügen (A)";
  document.documentElement.toggleAttribute("data-draw", on);     // the crosshair over the grid (styles/canvas.css)
}

function canvasRules(){
  const box = $canvasGrid.getBoundingClientRect(), rows = UI.canvas.rows;   // measured once a drag
  return { cells:"xy", min:{ w:1, h:1 }, layer:$canvasIdeas,
    at:m => ({ x:Math.floor((m.clientX - box.left) / CANVAS_CELL), y:Math.floor((m.clientY - box.top) / CANVAS_CELL) }),
    place:(g, r) => { g.el.style.cssText += ";" + ideaStyle(r.x, rows - r.y - r.h, r.w, r.h); },   // shaped as an idea (styles/canvas.css)
    save:(t, r) => Object.assign(t, { day:idxDate(r.x), row:rows - r.y - r.h, w:r.w, h:r.h,
      z: Math.max(0, ...S.ideas.map(i => i.z || 0)) + 1 }) };      // the last one touched is in front (drawn last)
}

/* draw mode, on the empty grid (input/canvas-pull.js) */
function startDraw(e){
  const rules = canvasRules();
  return cancelDraw = dragRect(e, { ...rules, zone:"new", rect:{ ...rules.at(e), w:0, h:0 }, el:$canvasGrid,
    done:(r, moved) => {
      cancelDraw = null;
      if(!moved || r.w * r.h === 1) return;                        // a click or a drag within one cell: nothing
      mutate(plan => { plan.ideas.push(rules.save({ id:uid(), tabId:activeCanvasTab().id }, r)); });
      setDrawMode(false);
    } });
}

/* on an idea: its handles resize it (data-rez, as events' and phases'), the rest moves it, with the rest of the
   selection if it is selected; a click opens it */
function startIdeaDrag(e, el){
  const idea = S.ideas.find(x => x.id === el.dataset.idea); if(!idea) return;
  const zone = e.target.closest(".rez")?.dataset.rez || "move";
  if(!UI.selection.has(idea.id)) selectOnly(idea.id);              // pressed: it is the selection
  const rules = canvasRules(), rectOf = i => ({ x:dayIdx(i.day), y:UI.canvas.rows - i.row - i.h, w:i.w, h:i.h });
  const group = zone === "move" ? S.ideas.filter(i => i.id !== idea.id && UI.selection.has(i.id)) : [], r0 = rectOf(idea);
  const at = (i, r) => { const o = rectOf(i); return { ...o, x:o.x + r.x - r0.x, y:o.y + r.y - r0.y }; };   // the same offset as the pressed one
  return dragRect(e, { ...rules, zone, el, rect:r0,
    dim:[el, ...group.map(i => $canvasIdeas.querySelector(`.idea[data-idea="${i.id}"]`)).filter(Boolean)],
    place:(g, r) => {
      rules.place(g, r);
      group.forEach((i, k) => {                                    // the others: a ghost each, parts of the pressed one's
        if(!g.parts[k]){ const p = document.createElement("div"); p.className = "ghost"; $canvasIdeas.append(p); g.parts[k] = p; }
        rules.place({ el:g.parts[k] }, at(i, r));
      });
    },
    done:(r, moved) => {
      if(!moved){ selectOnly(idea.id); return openEditor({ type:"idea", edit:idea }); }   // a click opens it, as an event
      mutate(plan => {                                             // one change: one undo step; front to back as they were
        [idea, ...group].sort((a, b) => (a.z || 0) - (b.z || 0))
          .forEach(i => rules.save(plan.ideas.find(x => x.id === i.id), i === idea ? r : at(i, r)));
      });
    } });
}
