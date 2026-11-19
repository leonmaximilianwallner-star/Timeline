// views/canvas/tabs.js — the canvas's tabs: independent sheets, like a spreadsheet's (Max, 19 Nov 2026). RULEBOOK A.8.
"use strict";
/* ════════════════════════════════════════════════════════════
   A tab is a record (`canvasTabs`: id, name, order), saved and synced like any other. Which tab is shown is this
   device's (device.canvasTab). Left–right is the date: shared by every tab and the week, so a tab switch never jumps
   in time (B.6.1). Up–down is each tab's own, remembered while the app runs (a switch from the week lands on the floor).
   ════════════════════════════════════════════════════════════ */
const CANVAS_TAB_NAME = "Canvas";      // a tab without a name, as an event without one is "Termin"

const $canvasTabs = document.getElementById("canvasTabs");
const canvasTabY = {};                 // tab id → px from the view's top to the grid's bottom

const canvasTabList = () => [...S.canvasTabs].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));   // ties: two devices adding at once
const activeCanvasTab = () => canvasTabList().find(t => t.id === device.canvasTab) || canvasTabList()[0];

function renderCanvasTabs(){
  if($canvasTabs.querySelector("input")) return;                 // being renamed: a redraw would drop the typing
  const active = activeCanvasTab();
  $canvasTabs.innerHTML = canvasTabList().map(t =>
    `<button class="canvas-tab${t === active ? " active" : ""}" data-id="${t.id}">${esc(t.name)}</button>`).join("")
    + `<button class="cbtn" data-create title="Neuer Tab" aria-label="Neuer Tab">${icon("plus")}</button>`;
}

$canvasTabs.addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  if(b.hasAttribute("data-create")) return createCanvasTab();
  if(b.dataset.id === activeCanvasTab().id) renameCanvasTab(b, false);
  else showCanvasTab(b.dataset.id);
});

function showCanvasTab(id){
  const sc = $canvasScene;
  canvasTabY[activeCanvasTab().id] = sc.scrollHeight - sc.scrollTop;
  setDevice(d => { d.canvasTab = id; });
  const y = canvasTabY[id] ?? sc.clientHeight;                    // not seen yet: its floor
  UI.canvas.rows = Math.max(UI.canvas.rows, Math.ceil((y + CANVAS_EDGE) / CANVAS_CELL));   // tall enough to stand there
  $canvasGrid.style.height = UI.canvas.rows * CANVAS_CELL + "px";
  sc.scrollTop = sc.scrollHeight - y;
}

function createCanvasTab(){
  const id = uid(), order = Math.max(...S.canvasTabs.map(t => t.order)) + 1;
  mutate(plan => { plan.canvasTabs.push({ id, name:CANVAS_TAB_NAME, order }); });
  showCanvasTab(id);
  renameCanvasTab($canvasTabs.querySelector(`[data-id="${id}"]`), true);
}

/* the name typed in place: Enter or leaving saves, Escape keeps the old one; empty is "Canvas" */
function renameCanvasTab(b, isNew){
  const id = b.dataset.id, old = b.textContent;
  const input = document.createElement("input");
  input.className = "canvas-tab active";
  input.value = isNew ? "" : old;                                  // new: typing replaces the default, shown as a hint
  input.placeholder = CANVAS_TAB_NAME;
  input.autocomplete = "off"; input.enterKeyHint = "done"; input.ariaLabel = "Name des Tabs";
  const fit = () => { input.size = Math.max(input.value.length, input.placeholder.length) + 1; };
  let done = false;
  const finish = save => {
    if(done) return;                                               // removing the field blurs it: once only
    done = true;
    const name = input.value.trim() || CANVAS_TAB_NAME;
    input.remove();
    if(save && name !== old) mutate(plan => { const t = plan.canvasTabs.find(t => t.id === id); if(t) t.name = name; });
    else renderCanvasTabs();
  };
  input.addEventListener("input", fit);
  input.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.preventDefault(); finish(true); }
    else if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); finish(false); }   // not also back to the week (app.js)
  });
  input.addEventListener("blur", () => finish(true));
  fit();
  b.replaceWith(input);
  input.focus(); input.select();
  input.scrollIntoView({ block:"nearest", inline:"nearest" });    // a new tab at the end may be past the edge
}
