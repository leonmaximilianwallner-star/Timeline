// app.js — keyboard shortcuts and start-up. Moved unchanged from index.html lines 2337–2374 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   keyboard + escape hatches — the "never stuck" principle
   layer order: budget > modal > popover > settings > add-mode
   ════════════════════════════════════════════════════════════ */
document.addEventListener("keydown", e=>{
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if(e.key==="Escape"){
    if(UI.budgetOpen) closeBudget();
    else if(UI.modal) closeModal();
    else if(UI.pop) closePop();
    else if(UI.settingsOpen) toggleSettings(false);
    else if(UI.addMode) setAddMode(false);
    return;
  }
  if(typing) return;
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="y"){ e.preventDefault(); redo(); }
  else if(e.key.toLowerCase()==="a" && !e.ctrlKey && !e.metaKey){ e.preventDefault(); setAddMode(!UI.addMode); }
  else if(e.key.toLowerCase()==="t" && !e.ctrlKey && !e.metaKey){ scrollToToday(true); }
});

/* ════════════════════════════════════════════════════════════
   boot
   ════════════════════════════════════════════════════════════ */
document.getElementById("btnToday").onclick   = ()=>scrollToToday(true);
document.getElementById("btnBudget").onclick  = ()=>UI.budgetOpen ? closeBudget() : openBudget();
document.getElementById("btnSettings").onclick= ()=>toggleSettings();
document.getElementById("btnUndo").onclick    = undo;
document.getElementById("btnRedo").onclick    = redo;

let rzT = null;
window.addEventListener("resize", ()=>{ clearTimeout(rzT); rzT = setTimeout(renderAll, 150); });

(function(){ const wl=document.createElement("div"); wl.id="washLayer"; document.body.appendChild(wl); })();
renderAll();
updateUndoButtons();
scrollToToday(false);          // auto-landing: today, around the current hour
checkReminders();
