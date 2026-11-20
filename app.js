// app.js — keyboard shortcuts and start-up. Moved from index.html lines 2337–2374 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   keyboard + escape hatches — the "never stuck" principle
   layer order: time budget > editor > a day's todos > focus view > settings > add mode
   ════════════════════════════════════════════════════════════ */
document.addEventListener("keydown", e=>{
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if(e.key==="Escape"){
    if(UI.budgetOpen) closeBudget();
    else if(UI.editor) editorEscape();          // the category list first, then the editor
    else if(UI.dayTodos) dayTodosEscape();      // a day's todos: its category list first
    else if(UI.focus) closeFocus();             // the focus view, back to the week
    else if(UI.settingsOpen) toggleSettings(false);
    else if(UI.drawMode) setDrawMode(false);    // draw mode before leaving the canvas
    else if(UI.canvas.active && UI.selection.size) clearSelection();   // then the selection (input/canvas-select.js)
    else if(UI.canvas.active && !morph.on){ morphStart(1); morphRelease(0); }   // the canvas, back to the week (ui/canvas-morph.js)
    else if(UI.addMode) setAddMode(false);
    return;
  }
  if(typing) return;
  if(UI.focus && !e.ctrlKey && !e.metaKey) return;  // the week's shortcuts (A, T) don't act under the focus view
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){ e.preventDefault(); e.shiftKey ? redoShown() : undoShown(); }
  else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="y"){ e.preventDefault(); redoShown(); }
  else if(e.key.toLowerCase()==="a" && !e.ctrlKey && !e.metaKey && !UI.canvas.active){ e.preventDefault(); setAddMode(!UI.addMode); }   // add mode belongs to the week
  else if(e.key.toLowerCase()==="t" && !e.ctrlKey && !e.metaKey){ todayShown(); }
});

/* ════════════════════════════════════════════════════════════
   boot
   ════════════════════════════════════════════════════════════ */
/* undo, redo and now: their icon plays whenever the action runs, from the button or a key (ui/header-icons.js) */
const $btnUndo = document.getElementById("btnUndo"), $btnRedo = document.getElementById("btnRedo"), $btnToday = document.getElementById("btnToday");
function undoShown(){ playIcon($btnUndo); undo(); }
function redoShown(){ playIcon($btnRedo); redo(); }
function todayShown(){ playIcon($btnToday); scrollToToday(true); }
$btnToday.onclick = todayShown;
document.getElementById("btnBudget").onclick  = ()=>UI.budgetOpen ? closeBudget() : openBudget();
document.getElementById("btnSettings").onclick= ()=>toggleSettings();
$btnUndo.onclick = undoShown;
$btnRedo.onclick = redoShown;

let rzT = null;
window.addEventListener("resize", ()=>{ clearTimeout(rzT); rzT = setTimeout(renderAll, 150); });

(function(){ const wl=document.createElement("div"); wl.id="washLayer"; document.body.appendChild(wl); })();
renderAll();
updateUndoButtons();
scrollToToday(false);          // auto-landing: today, around the current hour
checkPush().then(checkReminders);   // push on here? then the server reminds, not the app
syncNow();                     // catch up with other devices (does nothing until signed in)
/* the app kept on the device (sw.js): the next start comes from here, also offline. Push registers the same worker (reminders.js).
   After the page has loaded, so storing the app never slows the start it is for. */
if("serviceWorker" in navigator) window.addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(e=>console.warn("service worker", e)), { once:true });
