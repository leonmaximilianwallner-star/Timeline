// ui/day-todos.js — todos of a day, without an event: the dots in the day header and the day's panel (Max, 29 Oct).
"use strict";
/* ════════════════════════════════════════════════════════════
   A day's header shows up to three dots: the categories of its open todos (today: with the open ones
   of past days, which come along until ticked). A tap on a day's header opens its panel, in the
   editor's shell: the day's todos, the ones from earlier days, "Todo hinzufügen".
   Every change applies at once through mutate (undoable), as todos do in the editor.
   Rules: core/todos.js (dayTodosOn, dayTodoCategories). RULEBOOK A.4 (day todo).
   ════════════════════════════════════════════════════════════ */
const DAY_DOTS = 3;                     // more than three dots is noise (Max): the rest is a "+"
const TODO_HOLD = 500;                  // ms: holding a day todo moves it to tomorrow

/* the dots under a day's date, for views/day/render.js */
function dayDotsHTML(dateISO){
  const cats = dayTodoCategories(S, dateISO, todayISO());
  return cats.slice(0, DAY_DOTS).map(id=>`<span class="dh-dot" style="background:${cat(id).color}"></span>`).join("")
       + (cats.length > DAY_DOTS ? `<span class="dh-more">+</span>` : "");
}

/* a day todo's row: its circle in its category's colour; from an earlier day, that day as its value */
function dayTodoRowHTML(t, from){
  const d = parseISO(t.date);
  return `<div class="todoRow day-todo" data-state="${t.state}" data-tid="${t.id}" style="--cat:${cat(t.categoryId).color}">
    <button class="tcheck" title="Klick: Status · Halten oder Rechtsklick: auf morgen">${t.state==="done"?"✓":t.state==="cancelled"?"✕":t.state==="postponed"?"→":""}</button>
    <div class="tx-wrap"><span class="tx">${esc(t.text)}</span>
    ${from ? `<span class="row-value">${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth()+1}.</span>` : ""}
    <button class="tdel" title="Löschen">✕</button></div>
  </div>`;
}

function openDayTodos(dateISO){
  closeDayTodos(true);
  UI.dayTodos = { date: dateISO, newCat: UI.dayTodoCat ?? null };
  const projs = S.categories.filter(c=>c.start && c.end), cats = S.categories.filter(c=>!c.start && !c.end);
  const choices = [...projs, ...cats, { id:"", name:"Frei", color:FREE_COLOR }];
  const d = parseISO(dateISO);
  const ov = document.createElement("div");
  ov.className = "overlay editor-overlay"; ov.id = "dayTodoOverlay";
  ov.innerHTML = `<div class="editor-stack">
    <div class="cat-list" id="dayCatList" role="listbox" aria-label="Kategorie für neue Todos" hidden>${choices.map(c=>
      `<button type="button" class="cat-item" role="option" data-pick-cat="${c.id}"><span class="row-dot" style="background:${c.color}"></span>${esc(c.name)}</button>`).join("")}</div>
    <div class="editor neutral" role="dialog" aria-modal="true" aria-label="Todos am ${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}">
      <span class="editor-grip" aria-hidden="true"></span>
      <div class="editor-header">
        <div class="editor-name"><span class="editor-kind">Todos · ${dayWords(dateISO)}</span>
          <h2 class="set-title">${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}</h2></div>
        <button type="button" class="rbtn outline" id="dayTodoClose" title="Schließen (Esc)">${icon("close")}</button>
      </div>
      <div class="editor-body" id="dayTodoBody"></div></div></div>`;
  document.body.appendChild(ov);
  const box = ov.querySelector(".editor"), list = ov.querySelector("#dayCatList");
  ov.addEventListener("pointerdown", e=>{
    if(riseListOpen(list) && !e.target.closest("#dayCatList, #dayTodoCat")){ e.preventDefault(); sinkList(list, document.getElementById("dayTodoCat")); return; }
    if(e.target===ov || e.target.classList.contains("editor-stack")) closeDayTodos();   // nothing to save: changes applied at once
  });
  ov.querySelector("#dayTodoClose").onclick = ()=>closeDayTodos();
  slideToClose(box, ()=>closeDayTodos(true));
  list.querySelectorAll(".cat-item").forEach(b=>b.onclick = ()=>{
    UI.dayTodos.newCat = UI.dayTodoCat = b.dataset.pickCat || null;    // remembered for the next new todo
    sinkList(list, document.getElementById("dayTodoCat"));
    renderDayTodosBody();
  });
  renderDayTodosBody();
  box.style.height = box.offsetHeight + "px";              // as the editor: what is added later scrolls inside
  if(matchMedia("(pointer:fine)").matches) document.getElementById("fNewDayTodo").focus();   // never the keyboard by itself on a phone
}
function closeDayTodos(instant){
  leaveOverlay(document.getElementById("dayTodoOverlay"), instant);
  UI.dayTodos = null;
}
function dayTodosEscape(){
  const list = document.querySelector("#dayTodoOverlay #dayCatList");
  if(riseListOpen(list)){ sinkList(list, document.getElementById("dayTodoCat")); return; }
  closeDayTodos();
}

function renderDayTodosBody(){
  const B = document.getElementById("dayTodoBody"); if(!B) return;
  const day = UI.dayTodos.date, today = todayISO();
  const all = dayTodosOn(S, day, today), own = all.filter(t=>t.date===day), earlier = all.filter(t=>t.date!==day);
  const newCat = cat(UI.dayTodos.newCat);
  const done = own.filter(t=>t.state==="done").length;
  B.innerHTML = `
    <div class="part">
      <div class="part-head"><h3 class="overline">Dieser Tag</h3><span class="count">${own.length ? `${done}/${own.length}` : ""}</span></div>
      <div class="list"><div class="todoList" id="dayTodoList">${own.map(t=>dayTodoRowHTML(t, false)).join("")}</div>
        <div class="row add">
          <button type="button" class="row-icon day-todo-cat" id="dayTodoCat" aria-haspopup="listbox" aria-expanded="false" aria-controls="dayCatList" title="Kategorie: ${esc(newCat.name)}">
            <span class="row-dot" style="background:${newCat.color}"></span></button>
          <span class="row-main"><input id="fNewDayTodo" class="row-input" placeholder="Todo hinzufügen" autocomplete="off" enterkeyhint="done"></span></div>
      </div>
      <p class="hint">Halten oder Rechtsklick: auf morgen verschieben. Der Punkt links wählt die Kategorie.</p></div>
    ${earlier.length ? `<div class="part">
      <div class="part-head"><h3 class="overline">Von früheren Tagen</h3><span class="count">${earlier.length}</span></div>
      <div class="list"><div class="todoList">${earlier.map(t=>dayTodoRowHTML(t, true)).join("")}</div></div></div>` : ""}`;

  const change = fn => { mutate(s=>{ fn(s); }); renderDayTodosBody(); };
  const find = (s, id) => (s.dayTodos||[]).find(x=>x.id===id);
  const input = document.getElementById("fNewDayTodo");
  input.addEventListener("keydown", e=>{
    if(e.key!=="Enter") return;
    e.preventDefault();
    const text = input.value.trim(); if(!text) return;
    change(s=>{ s.dayTodos = s.dayTodos || []; s.dayTodos.push({ id:uid(), text, state:"open", date:day, categoryId:UI.dayTodos.newCat }); });
    const again = document.getElementById("fNewDayTodo"); again.focus(); again.scrollIntoView({ block:"nearest" });
  });
  document.getElementById("dayTodoCat").onclick = ()=>{
    const list = document.querySelector("#dayTodoOverlay #dayCatList"), btn = document.getElementById("dayTodoCat");
    list.querySelectorAll(".cat-item").forEach(b=>b.setAttribute("aria-selected", (b.dataset.pickCat||null) === UI.dayTodos.newCat));
    riseListOpen(list) ? sinkList(list, btn) : riseList(list, btn);
  };
  B.querySelectorAll(".todoRow").forEach(row=>{
    const id = row.dataset.tid;
    row.querySelector(".tcheck").onclick = ()=>change(s=>{ const t = find(s, id); if(t) cycleTodo(t); });
    row.querySelector(".tdel").onclick = ()=>change(s=>{ s.dayTodos = s.dayTodos.filter(x=>x.id!==id); });
    /* to tomorrow: a right click, or holding it (a phone has no right click) */
    let moved = 0;
    const later = ()=>{ if(Date.now() - moved < 800) return; moved = Date.now();   // Android fires a right click on a hold too: once
      change(s=>{ const t = find(s, id); if(t){ t.date = dayAfter(t.date > today ? t.date : today); t.state = "open"; } }); toast("Auf morgen verschoben"); };
    row.addEventListener("contextmenu", e=>{ e.preventDefault(); later(); });
    let hold = null;
    row.addEventListener("pointerdown", e=>{ if(e.pointerType==="mouse" || e.target.closest("button")) return;
      const x = e.clientX, y = e.clientY;
      hold = setTimeout(()=>{ hold = null; vibrate(12); later(); }, TODO_HOLD);
      const cancel = m=>{ if(Math.hypot(m.clientX-x, m.clientY-y) > MOVE_THRESHOLD) stop(); };
      const stop = ()=>{ clearTimeout(hold); row.removeEventListener("pointermove", cancel); row.removeEventListener("pointerup", stop); row.removeEventListener("pointercancel", stop); };
      row.addEventListener("pointermove", cancel); row.addEventListener("pointerup", stop); row.addEventListener("pointercancel", stop);
    });
  });
}

/* a tap on a day's header opens its todos */
document.addEventListener("click", e=>{
  const dh = e.target.closest(".dh[data-day]");
  if(dh) openDayTodos(dh.dataset.day);
});
