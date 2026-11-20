// views/canvas/tabs.js — the canvas's tabs: independent sheets, like a spreadsheet's (Max, 19 Nov 2026). RULEBOOK A.8.
"use strict";
/* ════════════════════════════════════════════════════════════
   A tab is a record (`canvasTabs`: id, name, order), saved and synced like any other. Which tab is shown is this
   device's (device.canvasTab). Left–right is the date: shared by every tab and the week, so a tab switch never jumps
   in time (B.6.1). Up–down is each tab's own, remembered while the app runs (a switch from the week lands on the floor).
   ════════════════════════════════════════════════════════════ */
const CANVAS_TAB_NAME = "Canvas";      // a tab without a name, as an event without one is "Termin"

const CANVAS_TAB_SPARE = 16;           // px of room beyond the need before the strip widens again: no flicker at the edge

const $canvasTabs = document.getElementById("canvasTabs");
const canvasTabY = {};                 // tab id → px from the view's top to the grid's bottom

const canvasTabList = () => [...S.canvasTabs].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));   // ties: two devices adding at once
const activeCanvasTab = () => canvasTabList().find(t => t.id === device.canvasTab) || canvasTabList()[0];

function renderCanvasTabs(){
  if($canvasTabs.querySelector("input")) return;                 // being renamed: a redraw would drop the typing
  const active = activeCanvasTab();
  $canvasTabs.innerHTML = canvasTabList().map(t =>
    `<button class="canvas-tab${t === active ? " active" : ""}" data-id="${t.id}" data-letter="${esc([...t.name][0].toUpperCase())}"
      title="${esc(t.name)}" aria-label="${esc(t.name)}"><span>${esc(t.name)}</span></button>`).join("")
    + `<button class="cbtn" data-create title="Neuer Tab" aria-label="Neuer Tab">${addIconHTML()}</button>`;   // the add icon, at rest (ui/header-icons.js)
  canvasTabNeed = null;                                           // names may have changed: measure again
  fitCanvasTabs();
}

/* three states, by the room the header leaves (RULEBOOK A.8, Canvas tab):
   0 every tab a pill · 1 the shown tab a pill, the others circles · 2 the same, scrolling sideways */
let canvasTabNeed = null, canvasTabState = 0;
function fitCanvasTabs(){
  const room = $canvasTabs.clientWidth;
  if(!room) return;                                               // hidden (not the canvas): measured when shown
  if(!canvasTabNeed){                                             // natural widths, read once per drawing
    $canvasTabs.dataset.state = 0;
    const tabs = [...$canvasTabs.children], gap = parseFloat(getComputedStyle($canvasTabs).columnGap) || 0;
    const widths = tabs.map(el => el.offsetWidth), sum = widths.reduce((a, b) => a + b, 0) + gap * (tabs.length - 1);
    const active = $canvasTabs.querySelector(".active");
    canvasTabNeed = [sum, (active ? active.offsetWidth : 0) + (tabs.length - (active ? 1 : 0)) * tabs.at(-1).offsetWidth + gap * (tabs.length - 1)];
  }
  const [all, squeezed] = canvasTabNeed, cur = canvasTabState;
  canvasTabState = room >= all + (cur > 0 ? CANVAS_TAB_SPARE : 0) ? 0 : room >= squeezed + (cur > 1 ? CANVAS_TAB_SPARE : 0) ? 1 : 2;
  $canvasTabs.dataset.state = canvasTabState;
  const active = $canvasTabs.querySelector(".active");
  if(canvasTabState === 2 && active){                             // the shown tab in view
    const l = active.offsetLeft, r = l + active.offsetWidth;
    if(l < $canvasTabs.scrollLeft) $canvasTabs.scrollLeft = l;
    else if(r > $canvasTabs.scrollLeft + room) $canvasTabs.scrollLeft = r - room;
  }
  fadeCanvasTabs();
}
/* the edges fade only where tabs are hidden past them */
function fadeCanvasTabs(){
  const x = $canvasTabs.scrollLeft, max = $canvasTabs.scrollWidth - $canvasTabs.clientWidth;
  $canvasTabs.classList.toggle("fade-l", x > 1);
  $canvasTabs.classList.toggle("fade-r", x < max - 1);
}
new ResizeObserver(fitCanvasTabs).observe($canvasTabs);
$canvasTabs.addEventListener("scroll", fadeCanvasTabs, { passive:true });

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

/* right-click (long-press where the browser makes it one) on a tab: one row, "Löschen". The last tab can't go;
   a tab with ideas asks once, in the row itself (no window: C.3) */
let $tabMenu = null;
$canvasTabs.addEventListener("contextmenu", e => {
  const b = e.target.closest(".canvas-tab[data-id]");
  if(!b) return;
  e.preventDefault();                                              // the browser's own menu: not on tabs
  closeTabMenu();
  const id = b.dataset.id, n = S.ideas.filter(i => i.tabId === id).length, r = b.getBoundingClientRect();
  $tabMenu = document.createElement("div");
  $tabMenu.className = "list tab-menu";
  $tabMenu.innerHTML = rowHTML({ icon:"bin", label:"Löschen", cls:"danger", attrs: S.canvasTabs.length < 2 ? "disabled" : "" });
  $tabMenu.style.left = r.left + "px"; $tabMenu.style.top = r.bottom + 4 + "px";
  document.body.append($tabMenu);
  const row = $tabMenu.firstElementChild;
  row.addEventListener("click", () => {
    if(n && !row.dataset.sure){ row.dataset.sure = 1; row.querySelector(".row-label").textContent = `Mit ${n} ${n === 1 ? "Idee" : "Ideen"} löschen?`; return; }
    closeTabMenu();
    deleteCanvasTab(id);
  });
});
function closeTabMenu(){ if($tabMenu){ $tabMenu.remove(); $tabMenu = null; } }
document.addEventListener("pointerdown", e => { if($tabMenu && !$tabMenu.contains(e.target)) closeTabMenu(); }, true);
document.addEventListener("keydown", e => { if($tabMenu && e.key === "Escape"){ e.stopPropagation(); closeTabMenu(); } }, true);   // before app.js: not back to the week

/* a tab and its ideas go (remembered as deleted, so sync can't bring them back); the shown one hands over to its neighbour */
function deleteCanvasTab(id){
  const tabs = canvasTabList(), i = tabs.findIndex(t => t.id === id);
  if(tabs.length < 2) return;
  if(id === activeCanvasTab().id) setDevice(d => { d.canvasTab = (tabs[i + 1] || tabs[i - 1]).id; });
  mutate(plan => { plan.canvasTabs = plan.canvasTabs.filter(t => t.id !== id); plan.ideas = plan.ideas.filter(x => x.tabId !== id); });
}
