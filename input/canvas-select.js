// input/canvas-select.js — selecting ideas on the canvas: the marquee, Shift + click, the mode (Max, 20 Nov 2026).
"use strict";
/* ════════════════════════════════════════════════════════════
   Its own file: the selection is view state with its own gesture, not one of the drag's rules (input/canvas-drag.js).
   The selection (UI.selection: ids of ideas on the shown tab) is never synced and never undone. For now it is what
   moves together (input/canvas-drag.js); later, what acts on many at once.
   - A plain drag on the empty canvas draws the marquee: the one drag (dragRect) in pixels instead of cells, so it is
     not snapped. It selects live. With Ctrl/Cmd (Shift pans) what it hits is added or taken away.
   - A press on an idea makes it the selection (it moves alone); on a selected one, all of them move. A click opens
     it and leaves it the selection. Shift + click adds it or takes it away (Shift + drag pans: input/canvas-pull.js).
   - A click on the empty canvas, or Escape, clears it.
   - The mode, per device (device.selectMode), switched by the select button in the header: "touch", what the marquee
     touches (the default: forgiving, as the marquee isn't snapped and a finger is imprecise), or "enclose", only
     what it encloses. Its icon: crossing corners at rest (touching), the closed marquee when active (enclosing).
   ════════════════════════════════════════════════════════════ */
const MARQUEE_RADIUS = CANVAS_CELL / 2;              // the ideas' one radius, half a row (styles/canvas.css)
const $btnSelect = document.getElementById("btnSelect");
UI.selection = new Set();

function showSelection(){ $canvasIdeas.querySelectorAll(".idea").forEach(el => el.classList.toggle("selected", UI.selection.has(el.dataset.idea))); }
function selectOnly(id){ UI.selection = new Set(id ? [id] : []); showSelection(); }
function toggleSelected(id){ UI.selection.has(id) ? UI.selection.delete(id) : UI.selection.add(id); showSelection(); }
function clearSelection(){ selectOnly(null); }

/* the marquee: the add ghost's line and radius, no fill, wider gaps (styles/canvas.css). Returns cancel() */
function startMarquee(e){
  const box = $canvasGrid.getBoundingClientRect(), add = e.ctrlKey || e.metaKey, base = add ? new Set(UI.selection) : new Set();
  const enclose = device.selectMode === "enclose";
  const ideas = [...$canvasIdeas.querySelectorAll(".idea")].map(el => { const r = el.getBoundingClientRect();   // measured once a drag
    return { id:el.dataset.idea, l:r.left - box.left, t:r.top - box.top, r:r.right - box.left, b:r.bottom - box.top }; });
  const at = m => ({ x:m.clientX - box.left, y:m.clientY - box.top });
  return dragRect(e, { zone:"new", rect:{ ...at(e), w:0, h:0 }, at, el:$canvasGrid, layer:$canvasIdeas,
    place(g, r){
      if(!g.el.firstChild){ g.el.classList.add("marquee"); g.el.innerHTML = `<svg aria-hidden="true"><rect/></svg>`; }
      Object.assign(g.el.style, { left:r.x + "px", top:r.y + "px", width:r.w + "px", height:r.h + "px" });
      const rad = Math.min(MARQUEE_RADIUS, r.w / 2, r.h / 2), line = g.el.querySelector("rect");
      line.setAttribute("rx", rad); line.setAttribute("ry", rad);   // as the browser keeps a radius to half the shorter side
      const hit = i => enclose ? i.l >= r.x && i.t >= r.y && i.r <= r.x + r.w && i.b <= r.y + r.h
                               : i.l < r.x + r.w && i.r > r.x && i.t < r.y + r.h && i.b > r.y;   // touching: overlapping, not only sharing an edge
      UI.selection = new Set(base);
      ideas.filter(hit).forEach(i => add && base.has(i.id) ? UI.selection.delete(i.id) : UI.selection.add(i.id));
      showSelection();
    },
    done(r, moved){ if(!moved && !add) clearSelection(); } });     // a click on the empty canvas
}

/* the mode: the header's select button, shown in the canvas only (styles/header-icons.css) */
function showSelectMode(instant){
  const on = device.selectMode === "enclose";
  setIcon($btnSelect, on, instant);
  $btnSelect.title = on ? "Auswahl: was der Rahmen umschließt" : "Auswahl: was der Rahmen berührt";
  $btnSelect.setAttribute("aria-pressed", on);
}
$btnSelect.onclick = () => { setDevice(dv => { dv.selectMode = dv.selectMode === "enclose" ? "touch" : "enclose"; }); showSelectMode(); };
showSelectMode(true);
