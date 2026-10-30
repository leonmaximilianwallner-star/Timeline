// input/add-mode.js — add mode (the + button). Moved unchanged from index.html lines 1375–1391 on 21 Oct 2026.
"use strict";
/* ---------- add mode ---------- */
const $fab = document.getElementById("fab");
function setAddMode(on){
  UI.addMode = on;
  $fab.classList.toggle("on", on);
  $fab.title = on ? "Hinzufügen beenden (Esc)" : "Hinzufügen (A)";
  document.getElementById("scene")?.classList.toggle("addmode", on);
  document.getElementById("dayGrid")?.classList.toggle("addmode", on);
  if(on) renderAddMenu();                                   // the add menu rises with add mode (ui/recording.js)
  $addMenu.classList.toggle("open", on);
  $addMenu.inert = !on;
  if(!on){ hideHover(); }
}
$fab.addEventListener("click", ()=> setAddMode(!UI.addMode));

function hideHover(){
  const h=document.getElementById("hoverLine"), l=document.getElementById("hoverLab"), t=document.getElementById("tlHover");
  if(h) h.style.display="none"; if(l) l.style.display="none"; if(t) t.style.display="none";
}

