// ui/editor.js — the editor (one shell for events, phases, milestones) and its todo list; the shared icons and rows. RULEBOOK Part C.
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
    <div class="tx-wrap"><span class="tx">${esc(t.text)}</span>
    ${t.carried?`<span class="carry" title="aus einem früheren Termin übernommen">↻</span>`:""}
    <button class="tdel" title="Löschen">✕</button></div>
  </div>`;
}
function cycleTodo(t){ t.state = t.state==="open" ? "done" : t.state==="done" ? "cancelled" : "open"; }

/* icons, 24-unit stroke paths (1.5px at 20px) */
const ICON = {
  close:   '<path d="M6 6l12 12M18 6L6 18"/>',
  done:    '<path d="M5 12l4 4 10-10"/>',
  bin:     '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  down:    '<path d="M6 9l6 6 6-6"/>',
  right:   '<path d="M9 6l6 6-6 6"/>',
  left:    '<path d="M15 6l-6 6 6 6"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  repeat:  '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  bell:    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  note:    '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6"/>',
  star:    '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  sync:    '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  export:  '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  import:  '<path d="M12 20V9"/><path d="M7 14l5-5 5 5"/><path d="M5 4h14"/>',
  moon:    '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  columns: '<path d="M4 5h16v14H4z"/><path d="M9.3 5v14M14.7 5v14"/>',
  out:     '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

/* a row of a list: icon, label, value; a native select may cover it (picked natively) */
function rowHTML({ icon:ic, label, value="", pick="", chev=false, cls="", id="", attrs="" }){
  return `<${pick?"div":"button type=\"button\""} class="row ${cls}" ${id?`id="${id}"`:""} ${attrs}>
    ${ic?`<span class="row-icon">${ic.startsWith("<")?ic:icon(ic)}</span>`:""}
    <span class="row-main"><span class="row-label">${label}</span>${value!==""?`<span class="row-value">${value}</span>`:""}${chev?`<span class="row-chev">${icon("right")}</span>`:""}</span>
    ${pick}</${pick?"div":"button"}>`;
}
const optionsHTML = (opts, current) => opts.map(([k,l])=>`<option value="${k}" ${String(current)===String(k)?"selected":""}>${l}</option>`).join("");
const REPEATS   = [["none","Keine"],["daily","Täglich"],["weekly","Wöchentlich"],["weekdays","Werktags"],["monthly","Monatlich"]];
const REMINDERS = [["","Keine"],["0","Zum Start"],["5","5 min vorher"],["15","15 min vorher"],["30","30 min vorher"],["60","1 h vorher"],["1440","1 Tag vorher"]];
const KIND_WORD = { event:"Termin", phase:"Phase", milestone:"Meilenstein" };

function openEditor(ctx){
  closeEditor();
  UI.editor = ctx;
  const ed = ctx.edit;
  if(ctx.type==="event"){
    /* the editor works on its own copy of one day's todos: saving hands it over, cancelling drops it */
    if(ed) ctx.occurrence = ctx.occurrence || ed.date;
    ctx.todos = ed ? JSON.parse(JSON.stringify(todosOf(ed, ctx.occurrence))) : getCarryover(ctx.initial.categoryId, ctx.initial.date, null);
  }
  const v = ed || ctx.initial || {};
  const projs = S.categories.filter(c=>c.start && c.end), cats = S.categories.filter(c=>!c.start && !c.end);
  const ov = document.createElement("div");
  ov.className = "overlay editor-overlay"; ov.id = "editorOverlay";
  ov.innerHTML = `<div class="editor" role="dialog" aria-modal="true" aria-label="${KIND_WORD[ctx.type]} bearbeiten">
    <div class="editor-header">
      <div class="editor-name">
        <label class="editor-kind"><span id="editorKind"></span>${icon("down")}
          <select id="fProj" aria-label="Projekt oder Kategorie">
            <option value="">frei</option>
            ${projs.length?`<optgroup label="Projekte">${projs.map(p=>`<option value="${p.id}" ${v.categoryId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</optgroup>`:""}
            ${cats.length?`<optgroup label="Kategorien">${cats.map(c=>`<option value="${c.id}" ${v.categoryId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</optgroup>`:""}
          </select></label>
        <input id="fTitle" type="text" autocomplete="off" aria-label="Titel" placeholder="${ed ? "" : "Neue"+(ctx.type==="event"?"r Termin":ctx.type==="phase"?" Phase":"r Meilenstein")}" value="${esc(v.title||"")}">
      </div>
      <button type="button" class="rbtn" id="editorDelete" title="Löschen" ${ed?"":"hidden"}>${icon("bin")}</button>
      ${ed?`<span class="rbtn-gap"></span>`:""}
      <button type="button" class="rbtn outline" id="editorClose" title="Schließen ohne Speichern (Esc)">${icon("close")}</button>
      <button type="button" class="rbtn fill" id="editorSave" title="Speichern (Strg+Enter)">${icon("done")}</button>
    </div>
    <div class="editor-body" id="editorBody"></div></div>`;
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
  const kind = ctx.type;
  let h = "";

  if(kind==="event"){
    h += `<div class="when">
      <div class="when-top">
        <span class="when-big"><input id="fStart" type="time" step="900" aria-label="Von" value="${fmtMin(v.startMin??9*60)}">–<input id="fEnd" type="time" step="900" aria-label="Bis" value="${fmtMin(v.endMin??10*60)}"></span>
        <span class="when-len" id="fLen"></span></div>
      <span class="when-sub"><span id="fWeekday"></span><input id="fDate" type="date" aria-label="Datum" value="${v.date||todayISO()}"><span id="fDayWords"></span></span></div>`;
    h += `<div class="list">
      ${rowHTML({ icon:"repeat", label:"Wiederholung", value:`<span id="fRepeatText"></span>`, pick:`<select id="fRepeat" class="row-pick" aria-label="Wiederholung">${optionsHTML(REPEATS, v.repeat||"none")}</select>` })}
      ${rowHTML({ icon:"bell", label:"Erinnerung", value:`<span id="fRemText"></span>`, pick:`<select id="fRem" class="row-pick" aria-label="Erinnerung">${optionsHTML(REMINDERS, v.reminderMin??"")}</select>` })}
    </div>`;
    h += `<div class="part">
      <div class="part-head"><h3 class="overline">Todos</h3><span class="count" id="editorTodoCount"></span></div>
      <div class="list"><div class="todoList" id="editorTodos"></div>
        <label class="row add"><span class="row-icon">${icon("plus")}</span><span class="row-main"><input id="fNewTodo" class="row-input" placeholder="Todo hinzufügen" autocomplete="off" enterkeyhint="done"></span></label>
      </div>
      <p class="hint" id="editorCarryHint" hidden></p></div>`;
  }
  else if(kind==="phase"){
    h += `<div class="when">
      <div class="when-top">
        <span class="when-big"><input id="fStart2" type="date" aria-label="Beginn" value="${v.start||todayISO()}">–<input id="fEnd2" type="date" aria-label="Ende (letzter Tag)" value="${v.end ? lastDay(v.end) : todayISO()}"></span></div>
      <div class="when-top"><span class="when-sub" id="fSpanWords"></span><span class="when-len" id="fLen"></span></div></div>`;
    h += `<div class="part"><h3 class="overline" style="padding:0 4px">Notiz</h3>
      <div class="list">
        <div class="text-tools">
          <button type="button" data-cmd="bold" title="Fett"><b>B</b></button>
          <button type="button" data-cmd="italic" title="Kursiv"><i style="font-family:serif">I</i></button>
          <button type="button" data-cmd="insertUnorderedList" title="Liste"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg></button>
        </div>
        <div class="rte" id="fDetails" contenteditable="true">${sanitize(v.details||"")}</div></div></div>`;
  }
  else if(kind==="milestone"){
    h += `<div class="when">
      <div class="when-top"><span class="when-big"><input id="fDate" type="date" aria-label="Datum" value="${v.date||todayISO()}"></span></div>
      <span class="when-sub"><span id="fWeekday"></span><span id="fDayWords"></span></span></div>`;
    h += `<div class="list">
      <div class="row"><span class="row-icon">${icon("note")}</span><span class="row-main"><input id="fNote" class="row-input" value="${esc(v.note||"")}" placeholder="Notiz, z. B. 30 Punkte" autocomplete="off"></span></div>
      <label class="row"><span class="row-icon">${icon("star")}</span><span class="row-main"><span class="row-label">Abschluss des Projekts</span><input id="fFinal" type="checkbox" class="switch" ${v.final?"checked":""}></span></label>
    </div>`;
  }
  B.innerHTML = h;

  /* the header: the thing's colour and the category's name */
  const fProj = document.getElementById("fProj");
  const paint = ()=>{
    const c = cat(fProj.value || null);
    document.querySelector(".editor").style.setProperty("--ed-colour", c.color);
    document.getElementById("editorKind").textContent = fProj.value ? c.name : KIND_WORD[kind];
  };
  paint();
  fProj.addEventListener("change", ()=>{
    paint();
    if(kind==="event" && !ed){
      /* a new event takes over the postponed todos of its category: refresh only the todo list,
         so everything already typed (title, time, date …) stays as it is */
      ctx.initial.categoryId = fProj.value || null;
      ctx.todos = ctx.todos.filter(t=>!t.carried).concat(getCarryover(ctx.initial.categoryId, ctx.initial.date, null));
      showTodos();
    }
  });

  /* the words around the time: weekday, Heute/Morgen/…, length */
  const words = ()=>{
    const val = id => { const el = document.getElementById(id); return el ? el.value : ""; };
    const set = (id, t) => { const el = document.getElementById(id); if(el) el.textContent = t; };
    const date = val("fDate");
    if(date){ set("fWeekday", WD_LONG[parseISO(date).getDay()] + (kind==="event" ? "," : "")); set("fDayWords", "· " + dayWords(date)); }   // event: "Donnerstag, <date> · Morgen"
    if(kind==="event"){
      const m = id => { const [hh,mm] = (val(id)||"0:0").split(":").map(Number); return hh*60+mm; };
      const len = m("fEnd") - m("fStart");
      set("fLen", len > 0 ? fmtDur(len) : "");
      set("fRepeatText", REPEATS.find(r=>r[0]===val("fRepeat"))[1]);
      set("fRemText", REMINDERS.find(r=>r[0]===val("fRem"))[1]);
    }
    if(kind==="phase"){
      let a = val("fStart2"), b = val("fEnd2");
      if(a && b){ if(b < a) [a,b] = [b,a]; set("fLen", daysWords(diffDays(a,b)+1)); set("fSpanWords", spanWords(a, dayAfter(b))); }
    }
  };
  words();
  B.addEventListener("input", words); B.addEventListener("change", words);

  /* the phase's text tools */
  B.querySelectorAll(".text-tools button").forEach(b=>b.onclick=e=>{
    e.preventDefault(); document.getElementById("fDetails").focus();
    document.execCommand(b.dataset.cmd, false, null);            // deprecated, fine for this scope
  });

  /* todos */
  function showTodos(){
    const list = B.querySelector("#editorTodos"), hint = B.querySelector("#editorCarryHint");
    if(list) list.innerHTML = ctx.todos.map(todoRowHTML).join("");
    countTodos();
    if(hint){ hint.textContent = "↻ aus einem früheren Termin übernommen (war verschoben)"; hint.hidden = !ctx.todos.some(t=>t.carried); }
  }
  function countTodos(){
    const el = B.querySelector("#editorTodoCount"); if(!el) return;
    el.textContent = ctx.todos.length ? `${ctx.todos.filter(t=>t.state==="done").length}/${ctx.todos.length}` : "";
  }
  if(kind==="event") showTodos();
  const newTodo = B.querySelector("#fNewTodo");
  if(newTodo) newTodo.addEventListener("keydown", e=>{
    if(e.key!=="Enter") return;
    e.preventDefault();
    const txt = newTodo.value.trim(); if(!txt) return;
    ctx.todos.push({ id:uid(), text:txt, state:"open" }); newTodo.value="";
    B.querySelector("#editorTodos").insertAdjacentHTML("beforeend", todoRowHTML(ctx.todos[ctx.todos.length-1]));
    countTodos();
  });
  const tl = B.querySelector("#editorTodos");
  if(tl){
    tl.addEventListener("click", e=>{
      const row = e.target.closest(".todoRow"); if(!row) return;
      const t = ctx.todos.find(x=>x.id===row.dataset.tid); if(!t) return;
      if(e.target.closest(".tdel")){ ctx.todos.splice(ctx.todos.indexOf(t),1); row.remove(); countTodos(); return; }
      if(e.target.closest(".tcheck")){ cycleTodo(t); row.outerHTML = todoRowHTML(t); countTodos(); }
    });
    tl.addEventListener("contextmenu", e=>{
      const row = e.target.closest(".todoRow"); if(!row) return;
      e.preventDefault();
      const t = ctx.todos.find(x=>x.id===row.dataset.tid); if(!t) return;
      t.state = t.state==="postponed" ? "open" : "postponed";
      row.outerHTML = todoRowHTML(t);
    });
  }

  const del = document.getElementById("editorDelete");
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
  const f = document.getElementById("fTitle");
  f.addEventListener("keydown", ev=>{ if(ev.key==="Enter"){ ev.preventDefault(); if(ev.ctrlKey||ev.metaKey) saveEditor(); } });
  f.focus();
}

function saveEditor(){
  const ctx = UI.editor, ed = ctx.edit, B = document.getElementById("editorBody");
  const kind = ctx.type;
  const val = id => { const el=document.getElementById(id); return el?el.value:undefined; };
  const mins = id => { const t=val(id); if(!t) return null; const [h,m]=t.split(":").map(Number); return h*60+m; };

  if(kind==="event"){
    const typed = (val("fNewTodo")||"").trim();
    if(typed) ctx.todos.push({ id:uid(), text:typed, state:"open" });   // typed but not yet confirmed: kept, not lost
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

