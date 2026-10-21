// ui/editor.js — editor and its todo list. Moved from index.html lines 1712–1985 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   editor — the editor (a preview stays behind it), its todo list,
   postponed carry-over
   ════════════════════════════════════════════════════════════ */
function getCarryover(catId, dateISO, excludeId){
  /* todos of the category's most recent event whose latest occurrence is still postponed */
  let best = null, bestKey = "";
  S.events.forEach(ev=>{
    if(ev.categoryId !== catId || ev.id === excludeId) return;
    const occ = latestOccurrence(ev, dateISO);
    if(!occ || !todosOf(ev, occ).some(t=>t.state === "postponed")) return;
    const key = occ + "T" + String(ev.startMin).padStart(4,"0");   // date, then start time
    if(key > bestKey){ bestKey = key; best = ev; }
  });
  if(!best) return [];
  const seen = new Set();
  return todosOf(best, latestOccurrence(best, dateISO)).filter(t=>{
    const k = t.text.trim();                                        // dedup key: trimmed text
    if(t.state !== "postponed" || seen.has(k)) return false;
    seen.add(k); return true;
  }).map(t=>({ id:uid(), text:t.text, state:"open", carried:true }));
}

function todoRowHTML(t){
  return `<div class="todoRow" data-state="${t.state}" data-tid="${t.id}">
    <button class="tcheck" title="Klick: Status · Rechtsklick: verschoben">${t.state==="done"?"✓":t.state==="cancelled"?"✕":t.state==="postponed"?"→":""}</button>
    <span class="tx">${esc(t.text)}</span>
    ${t.carried?`<span class="carry">↻</span>`:""}
    <button class="tdel" title="Löschen">✕</button>
  </div>`;
}
function cycleTodo(t){ t.state = t.state==="open" ? "done" : t.state==="done" ? "cancelled" : "open"; }

function openEditor(ctx){
  closeEditor();
  UI.editor = ctx;
  const ed = ctx.edit;
  if(ctx.type==="event"){
    /* the editor works on its own copy of one day's todos: saving hands it over, cancelling drops it */
    if(ed) ctx.occurrence = ctx.occurrence || ed.date;
    ctx.todos = ed ? JSON.parse(JSON.stringify(todosOf(ed, ctx.occurrence))) : getCarryover(ctx.initial.categoryId, ctx.initial.date, null);
  }
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "editorOverlay";
  ov.innerHTML = `<div class="overlay-window">
    <div class="overlay-window-header">
      <div id="editorTitleBox" style="flex:1; min-width:0"></div>
      <button class="cbtn small" id="editorClose" title="Abbrechen (Esc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <button class="cbtn small danger" id="editorDelete" style="display:none" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg></button>
      <button class="cbtn small primary" id="editorSave" title="Speichern (Strg+Enter)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></button>
    </div>
    <div class="overlay-window-body" id="editorBody"></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener("pointerdown", e=>{ if(e.target===ov) saveEditor(); });   // a tap outside saves; ✕ and Escape cancel (Max, 21 Oct)
  ov.querySelector("#editorClose").onclick = closeEditor;
  ov.querySelector("#editorSave").onclick = saveEditor;
  renderEditorBody();
}
function closeEditor(){
  const ov = document.getElementById("editorOverlay");
  if(ov) ov.remove();
  if(UI.editor && UI.editor.preview) clearPreview(UI.editor.preview);   // preview persisted behind the editor until now
  UI.editor = null;
}

function renderEditorBody(){
  const ctx = UI.editor, ed = ctx.edit, B = document.getElementById("editorBody");
  const v = (ed||ctx.initial||{});
  let h = "";
  const titleField = (placeholder,val)=>{
    document.getElementById("editorTitleBox").innerHTML =
      `<div class="field title-field"><textarea id="fTitle" class="title-inline" rows="1" placeholder="${esc(placeholder||"")}" autocomplete="off">${esc(val||"")}</textarea></div>`;
    return "";
  };
  const dateField  = (id,lab,val)=>`<div class="field"><label>${lab}</label><input id="${id}" type="date" value="${val||todayISO()}"></div>`;
  const categoryPicker = (selectedId)=>{
    const projs = S.categories.filter(c=>c.start && c.end);
    const cats  = S.categories.filter(c=>!c.start && !c.end);
    return `<div class="field"><label>Projekt / Kategorie</label>
      <div class="proj-row">
        <select id="fProj">
          <option value="">— frei —</option>
          ${projs.length?`<optgroup label="Projekte">${projs.map(p=>`<option value="${p.id}" ${selectedId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</optgroup>`:""}
          ${cats.length?`<optgroup label="Kategorien">${cats.map(c=>`<option value="${c.id}" ${selectedId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</optgroup>`:""}
        </select>
        <span class="proj-col" id="fProjCol"></span>
      </div></div>`;
  };

  const kind = ctx.type;

  if(kind==="event"){
    h += titleField(ed ? "Termin bearbeiten" : "Neuer Termin", v.title);
    h += categoryPicker(v.categoryId);
    h += `<div class="frow">${dateField("fDate","Datum",v.date)}
      <div class="field"><label>Von</label><input id="fStart" type="time" step="900" value="${fmtMin(v.startMin??9*60)}"></div>
      <div class="field"><label>Bis</label><input id="fEnd" type="time" step="900" value="${fmtMin(v.endMin??10*60)}"></div></div>`;
    h += `<div class="frow"><div class="field"><label>Wiederholung</label><select id="fRepeat">
      ${["none|Keine","daily|Täglich","weekly|Wöchentlich","monthly|Monatlich","weekdays|Werktags"].map(o=>{const[k,l]=o.split("|");return `<option value="${k}" ${ (v.repeat||"none")===k?"selected":""}>${l}</option>`;}).join("")}</select></div>
      <div class="field"><label>Erinnerung</label><select id="fRem">
      ${["|Keine","0|Zum Start","5|5 min","15|15 min","30|30 min","60|1 h","1440|1 Tag"].map(o=>{const[k,l]=o.split("|");return `<option value="${k}" ${String(v.reminderMin??"")===k?"selected":""}>${l}</option>`;}).join("")}</select></div></div>`;
    h += `<div class="field"><label>Todos</label><div class="todoList" id="editorTodos">${(ctx.todos||[]).map(todoRowHTML).join("")}</div>
      <div class="todoAdd" style="margin-top:6px"><input id="fNewTodo" placeholder="Todo hinzufügen…">
      <button class="cbtn small" id="fAddTodo" title="Hinzufügen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>
      <div class="thint" id="editorCarryHint" style="margin-top:5px" hidden></div></div>`;
  }
  else if(kind==="phase"){
    h += titleField(ed ? "Phase bearbeiten" : "Neue Phase", v.title);
    h += categoryPicker(v.categoryId);
    h += `<div class="frow">${dateField("fStart2","Beginn",v.start)}${dateField("fEnd2","Ende",v.end && lastDay(v.end))}</div>`;
    h += `<div class="field desc-field"><label>Beschreibung</label>
      <div class="rte-tools">
        <button class="cbtn small" data-cmd="bold" title="Fett"><b style="font-size:12px">B</b></button>
        <button class="cbtn small" data-cmd="italic" title="Kursiv"><i style="font-size:12px;font-family:serif">I</i></button>
        <button class="cbtn small" data-cmd="insertUnorderedList" title="Liste"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg></button>
      </div>
      <div class="rte" id="fDetails" contenteditable="true">${sanitize(v.details||"")}</div></div>`;
  }
  else if(kind==="milestone"){
    h += titleField(ed ? "Meilenstein bearbeiten" : "Neuer Meilenstein", v.title);
    h += categoryPicker(v.categoryId);
    h += `<div class="frow">${dateField("fDate","Datum",v.date)}
      <div class="field"><label>Notiz</label><input id="fNote" value="${esc(v.note||"")}" placeholder="z. B. 30 Punkte"></div></div>`;
    h += `<div class="field"><label style="display:flex;align-items:center;gap:8px;text-transform:none;font-size:13px;color:var(--text);letter-spacing:0;cursor:pointer">
      <input id="fFinal" type="checkbox" ${v.final?"checked":""} style="width:auto"> Abschluss ★ <span class="note">(auf der Projektlinie)</span></label></div>`;
  }
  B.innerHTML = h;

  /* wiring */
  B.querySelectorAll(".rte-tools .cbtn").forEach(b=>b.onclick=e=>{
    e.preventDefault(); document.getElementById("fDetails").focus();
    document.execCommand(b.dataset.cmd, false, null);            // deprecated, fine for this scope
  });
  /* category picker: paints the colour swatch and (event editor) refreshes carry-over */
  const _fProj = B.querySelector("#fProj"), _fProjCol = document.getElementById("fProjCol");
  if(_fProj && _fProjCol){
    const paint = ()=>{
      const t = S.categories.find(c=>c.id===_fProj.value);
      _fProjCol.style.background = t ? t.color : FREE_COLOR;
    };
    paint();
    _fProj.addEventListener("change", ()=>{
      paint();
      if(ctx.type==="event" && !ed){
        /* a new event takes over the postponed todos of its category: refresh only the todo list,
           so everything already typed (title, time, date …) stays as it is */
        ctx.initial.categoryId = _fProj.value || null;
        ctx.todos = ctx.todos.filter(t=>!t.carried).concat(getCarryover(ctx.initial.categoryId, ctx.initial.date, null));
        showTodos();
      }
    });
  }
  function showTodos(){
    const list = B.querySelector("#editorTodos"), hint = B.querySelector("#editorCarryHint");
    if(list) list.innerHTML = ctx.todos.map(todoRowHTML).join("");
    if(hint){ hint.textContent = "↻ aus einem früheren Termin übernommen (war verschoben)"; hint.hidden = !ctx.todos.some(t=>t.carried); }
  }
  if(kind==="event") showTodos();
  const addTodo = ()=>{
    const inp = B.querySelector("#fNewTodo"); const txt = inp.value.trim(); if(!txt) return;
    const list = ctx.todos;
    list.push({ id:uid(), text:txt, state:"open" }); inp.value="";
    B.querySelector("#editorTodos").insertAdjacentHTML("beforeend", todoRowHTML(list[list.length-1]));
  };
  const addBtn = B.querySelector("#fAddTodo");
  if(addBtn){ addBtn.onclick = addTodo;
    B.querySelector("#fNewTodo").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); addTodo(); } }); }
  const tl = B.querySelector("#editorTodos");
  if(tl){
    const list = ()=> ctx.todos;
    tl.addEventListener("click", e=>{
      const row = e.target.closest(".todoRow"); if(!row) return;
      const t = list().find(x=>x.id===row.dataset.tid); if(!t) return;
      if(e.target.closest(".tdel")){ list().splice(list().indexOf(t),1); row.remove(); return; }
      if(e.target.closest(".tcheck")){ cycleTodo(t); row.outerHTML = todoRowHTML(t); }
    });
    tl.addEventListener("contextmenu", e=>{
      const row = e.target.closest(".todoRow"); if(!row) return;
      e.preventDefault();
      const t = list().find(x=>x.id===row.dataset.tid); if(!t) return;
      t.state = t.state==="postponed" ? "open" : "postponed";
      row.outerHTML = todoRowHTML(t);
    });
  }
  const del = document.getElementById("editorDelete");
  del.style.display = ed ? "" : "none";
  del.onclick = ()=>{
    const k = ctx.type;
    mutate(s=>{
      if(k==="event") s.events = s.events.filter(x=>x.id!==ed.id);
      else if(k==="phase") s.phases = s.phases.filter(x=>x.id!==ed.id);
      else if(k==="milestone") s.milestones = s.milestones.filter(x=>x.id!==ed.id);
    });
    toast(k==="event" && ed.repeat && ed.repeat!=="none" ? "Serie gelöscht" : "Gelöscht");
    closeEditor();
  };
  const f = B.querySelector("#fTitle");
  if(f){
    const grow = ()=>{ f.style.height="auto"; f.style.height = f.scrollHeight+"px"; };
    grow(); f.addEventListener("input", grow);
    f.addEventListener("keydown", ev=>{
      if(ev.key==="Enter"){ ev.preventDefault(); if(ev.ctrlKey||ev.metaKey) saveEditor(); } // never a literal newline in a title
    });
    f.focus();
  }
}

function saveEditor(){
  const ctx = UI.editor, ed = ctx.edit, B = document.getElementById("editorBody");
  const kind = ctx.type;
  const val = id => { const el=document.getElementById(id); return el?el.value:undefined; };
  const mins = id => { const t=val(id); if(!t) return null; const [h,m]=t.split(":").map(Number); return h*60+m; };

  if(kind==="event"){
    const title = (val("fTitle")||"").trim() || "Termin";
    let s = clamp(mins("fStart")??9*60, HOUR_START*60, HOUR_END*60);
    let e = clamp(mins("fEnd")??s+60, HOUR_START*60, HOUR_END*60);
    if(e<=s) e = Math.min(s+SNAP, HOUR_END*60);
    const data = { title, categoryId: val("fProj")||null,
      date: val("fDate")||todayISO(), startMin:s, endMin:e,
      repeat: val("fRepeat")||"none",
      reminderMin: val("fRem")==="" ? null : Number(val("fRem")) };
    /* this day's todos go back to their day; if the event moved, every day's todos move with it */
    const shift = ed ? diffDays(ed.date, data.date) : 0;
    let byDate = shiftTodos(ed ? ed.todosByDate : {}, shift);
    const day = ed ? isoDate(addDays(parseISO(ctx.occurrence), shift)) : data.date;
    if(data.repeat === "none") byDate = {};                        // a plain event has one day: its own
    byDate[data.repeat === "none" ? data.date : day] = ctx.todos;
    data.todosByDate = JSON.parse(JSON.stringify(byDate));
    if(data.reminderMin!=null) requestNotifPermission();
    mutate(st=>{ if(ed) Object.assign(st.events.find(x=>x.id===ed.id), data);
                 else st.events.push({ id:uid(), ...data }); });
    if(UI.addMode) setAddMode(false);                 // add-mode auto-exits after one creation
  }
  else if(kind==="phase"){
    let a = val("fStart2")||todayISO(), b = val("fEnd2")||a;
    if(b<a) [a,b]=[b,a];
    const data = { title:(val("fTitle")||"").trim()||"Phase",
      categoryId: val("fProj")||null, start:a, end:dayAfter(b),           // the field shows the last day; stored end is the day after
      details: sanitize(B.querySelector("#fDetails").innerHTML) };
    mutate(st=>{ if(ed) Object.assign(st.phases.find(x=>x.id===ed.id), data);
                 else st.phases.push({ id:uid(), ...data }); });
    if(UI.addMode) setAddMode(false);
  }
  else if(kind==="milestone"){
    const data = { title:(val("fTitle")||"").trim()||"Meilenstein", date:val("fDate")||todayISO(),
      categoryId: val("fProj")||null, final: B.querySelector("#fFinal").checked, note:(val("fNote")||"").trim() };
    mutate(st=>{ if(ed) Object.assign(st.milestones.find(x=>x.id===ed.id), data);
                 else st.milestones.push({ id:uid(), ...data }); });
    if(UI.addMode) setAddMode(false);
  }
  closeEditor();
}

