// ui/todo-panel.js — todo panel and completion celebration. Moved from index.html lines 1986–2084 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   todo panel — click an event: quick todo panel in the day view
   ════════════════════════════════════════════════════════════ */
function openTodoPanel(ev, dateISO, anchorEl){
  closeTodoPanel();
  const r = anchorEl.getBoundingClientRect();
  const panel = document.createElement("div"); panel.id="todoPanel";
  const x = clamp(r.right+10 <= window.innerWidth-310 ? r.right+10 : r.left-310, 8, window.innerWidth-308);
  const y = clamp(r.top, 8, window.innerHeight-300);
  panel.style.left=x+"px"; panel.style.top=y+"px";
  const c = cat(ev.categoryId);
  panel.innerHTML = `<div class="panel-header">
      <span class="panel-category" style="background:${c.color}1a; color:${c.color}; border:1px solid ${c.color}38">${esc(c.name)}</span>
      <div class="panel-actions">
        <button class="cbtn small" id="todoPanelEdit" title="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cbtn small panel-close" title="Schließen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </div>
    <div class="panel-title">${esc(ev.title)}</div>
    <div class="panel-meta">${fmtDateLong(dateISO)} · ${fmtMin(ev.startMin)}–${fmtMin(ev.endMin)}${ev.repeat&&ev.repeat!=="none"?" · ↻":""}</div>
    <div class="todoList" id="todoPanelTodos">${todosOf(ev, dateISO).map(todoRowHTML).join("")}</div>
    <div class="todoAdd" style="margin-top:8px"><input id="todoPanelNew" placeholder="Todo hinzufügen…">
      <button class="cbtn small" id="todoPanelAdd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>`;
  document.body.appendChild(panel);
  const allDone = list => list.length>0 && list.every(t=>t.state==="done");
  panel.classList.toggle("complete", allDone(todosOf(ev, dateISO)));
  panel.style.setProperty("--cat-fill", c.color);
  UI.todoPanel = { evId:ev.id, date:dateISO };

  /* changes this day's list (and only this day's) without tearing the todo panel down */
  const current = ()=> todosOf(S.events.find(x=>x.id===ev.id), dateISO);
  const sync = change => {
    mutate(s=>{
      const e2 = s.events.find(x=>x.id===ev.id); if(!e2) return;
      const list = JSON.parse(JSON.stringify(todosOf(e2, dateISO)));
      change(list);
      setTodosOf(e2, dateISO, list);
    }, { skipRender:true });
    renderAll();
    const e2 = S.events.find(x=>x.id===ev.id);
    document.getElementById("todoPanelTodos").innerHTML = current().map(todoRowHTML).join("");
    panel.classList.toggle("complete", allDone(current()));
    panel.style.setProperty("--cat-fill", cat(e2.categoryId).color);
  };
  panel.querySelector(".panel-close").onclick = closeTodoPanel;
  panel.querySelector("#todoPanelEdit").onclick = ()=>{ const e2=S.events.find(x=>x.id===ev.id); closeTodoPanel(); if(e2) openEditor({ type:"event", edit:e2, occurrence:dateISO }); };
  const add = ()=>{ const i=panel.querySelector("#todoPanelNew"); const t=i.value.trim(); if(!t) return; i.value="";
    sync(list=>list.push({ id:uid(), text:t, state:"open" })); };
  panel.querySelector("#todoPanelAdd").onclick = add;
  panel.querySelector("#todoPanelNew").addEventListener("keydown", e=>{ if(e.key==="Enter") add(); });
  panel.addEventListener("click", e=>{
    const row = e.target.closest(".todoRow"); if(!row) return;
    if(e.target.closest(".tdel")) sync(list=>{ const i = list.findIndex(t=>t.id===row.dataset.tid); if(i>=0) list.splice(i,1); });
    else if(e.target.closest(".tcheck")){
      const before = allDone(current());
      sync(list=>{ const t=list.find(t=>t.id===row.dataset.tid); if(t) cycleTodo(t); });
      if(allDone(current()) && !before) celebrate(S.events.find(x=>x.id===ev.id), ev.id);
    }
  });
  panel.addEventListener("contextmenu", e=>{
    const row = e.target.closest(".todoRow"); if(!row) return;
    e.preventDefault();
    sync(list=>{ const t=list.find(t=>t.id===row.dataset.tid); if(t) t.state = t.state==="postponed"?"open":"postponed"; });
  });
}
function closeTodoPanel(){ const p=document.getElementById("todoPanel"); if(p) p.remove(); UI.todoPanel=null; }
function celebrate(ev, evId){
  const panel = document.getElementById("todoPanel");
  const layer = document.getElementById("washLayer");
  if(!panel || !layer) return;

  panel.classList.remove("celebrating");
  void panel.offsetWidth;
  panel.classList.add("celebrating");
  
  const color = cat(ev.categoryId).color;
  const cr = panel.getBoundingClientRect();

  const w = document.createElement("div");
  w.className = "wash go";
  w.style.setProperty("--cat-fill", color);
  w.style.width  = cr.width+"px";
  w.style.height = cr.height+"px";
  w.style.left = (cr.left + cr.width/2)+"px";
  w.style.top  = (cr.top + cr.height/2)+"px";
  layer.appendChild(w);
  w.addEventListener("animationend", ()=> {w.remove(); closeTodoPanel();}, { once:true });

  const t = document.createElement("div");
  t.className = "celeb-text";
  t.innerHTML = `<div class="ct-title">${esc(ev.title)}</div>`
              + `<div class="ct-sub">${fmtDur(ev.endMin - ev.startMin)} · ${esc(cat(ev.categoryId).name)}</div>`;
  const GAP_ABOVE_PANEL = 30; // distance between text and panel's top edge — increase to move text further up
  t.style.left = (cr.left + cr.width/2) + "px";
  t.style.top  = (cr.top - GAP_ABOVE_PANEL) + "px";
  layer.appendChild(t);
  void t.offsetWidth;
  t.classList.add("go");
  t.addEventListener("animationend", () => t.remove(), { once: true });
}

document.addEventListener("pointerdown", e=>{
  if(UI.todoPanel && !e.target.closest("#todoPanel") && !e.target.closest(".event")) closeTodoPanel();
  if(UI.settingsOpen && !e.target.closest("#setPanel") && !e.target.closest("#btnSettings")) toggleSettings(false);
}, true);
