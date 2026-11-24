// ui/choice-menu.js — a choice that floats beside the thing it is about: a raised list of rows (RULEBOOK C.3).
"use strict";
/* ════════════════════════════════════════════════════════════
   One for every such question: a tab's "Löschen", a repeating event's "Nur diesen / Auch alle folgenden".
     openChoiceMenu(at, rows, onCancel)   at: { left, top } in the window; rows: rowHTML's fields plus
                                          disabled and act(rowEl) (return true to stay open: an in-row confirm)
   Escape or a press outside closes it and calls onCancel; Escape then goes no further (not back to the week).
   ════════════════════════════════════════════════════════════ */
let choiceMenu = null;                             // the open one: { el, onCancel }

function openChoiceMenu(at, rows, onCancel){
  closeChoiceMenu(true);
  const el = document.createElement("div");
  el.className = "list choice-menu";
  el.innerHTML = rows.map(({ act, disabled, ...r }) => rowHTML({ ...r, attrs: disabled ? "disabled" : "" })).join("");
  document.body.append(el);
  el.style.left = Math.min(at.left, innerWidth - el.offsetWidth - 8) + "px";     // never past the window's edge
  el.style.top  = Math.min(at.top, innerHeight - el.offsetHeight - 8) + "px";
  [...el.children].forEach((row, i) => row.addEventListener("click", () => { if(!rows[i].act(row)) closeChoiceMenu(false); }));
  choiceMenu = { el, onCancel };
}
function closeChoiceMenu(cancelled){
  if(!choiceMenu) return;
  const { el, onCancel } = choiceMenu;
  choiceMenu = null; el.remove();
  if(cancelled && onCancel) onCancel();
}
document.addEventListener("pointerdown", e => { if(choiceMenu && !choiceMenu.el.contains(e.target)) closeChoiceMenu(true); }, true);
document.addEventListener("keydown", e => { if(choiceMenu && e.key === "Escape"){ e.stopPropagation(); closeChoiceMenu(true); } }, true);
