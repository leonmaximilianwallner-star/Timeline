// views/focus/render.js — the focus view: one day, the event of now open (RULEBOOK A.8 "Focus view"; Max, 1 Nov).
"use strict";
/* A layer over the app, not a band of the page (Max, 1 Nov): the week strip, then the day as a list,
   one event open with its todos, free time between events. It reads the plan and redraws with it
   (renderAll); every change goes through mutate. Opened from the event editor; closed by its button,
   Escape, or the phone's back gesture (one history step). The rules: core/focus.js. */
const FOCUS_DOTS = 3;              // category dots per day in the week strip, as in the day view's header

function openFocus(dayIso, eventId, opts = {}){
  if(UI.focus){ UI.focus.day = dayIso; UI.focus.open = eventId; renderFocus(); return; }
  UI.focus = { day: dayIso, open: eventId };
  const el = document.createElement("div");
  el.id = "focusView"; el.className = "focus-view" + (opts.morph ? " morph-in" : "");   // morph-in: ui/focus-morph.js moves it in el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Fokus");
  document.body.appendChild(el);
  history.pushState({ focus: true }, "");                     // the phone's back gesture closes it, not the app
  bindFocus(el);
  renderFocus();
  el.querySelector(".focus-event.open")?.scrollIntoView({ block: "center" });
}
function closeFocus(instant, fromHistory){
  const el = document.getElementById("focusView"); if(!el) return;
  el.removeAttribute("id"); UI.focus = null;                   // closed for the app at once; the motion plays out
  if(!fromHistory && history.state && history.state.focus) history.back();   // its history step goes with it
  if(instant || matchMedia("(prefers-reduced-motion: reduce)").matches) el.remove();
  else { el.classList.add("leaving"); setTimeout(() => el.remove(), 220); }
}
window.addEventListener("popstate", () => { if(UI.focus) closeFocus(false, true); });

const focusNow = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };

function renderFocus(){
  const el = document.getElementById("focusView"); if(!el || !UI.focus) return;
  const f = UI.focus, today = todayISO(), now = focusNow(), isToday = f.day === today;
  const day = focusDay(S.events, f.day);
  if(!day.some(o => o.ev.id === f.open)) f.open = focusOpen(day, isToday, now);
  const d = parseISO(f.day);

  const pill = iso => {
    const p = parseISO(iso), cats = [...new Set(focusDay(S.events, iso).map(o => o.ev.categoryId))].slice(0, FOCUS_DOTS);
    return `<button type="button" class="focus-pill${iso === f.day ? " on" : ""}${iso === today ? " today" : ""}" data-day="${iso}" aria-label="${WD_LONG[p.getDay()]}, ${p.getDate()}.">
      <span class="fp-wd">${WD[p.getDay()]}</span><span class="fp-dn">${p.getDate()}</span>
      <span class="fp-dots">${cats.map(c => `<span style="background:${cat(c).color}"></span>`).join("")}</span></button>`;
  };
  /* the words of an event's time, from today's view: "noch 1h 20min", "in 2h", "vorbei" */
  const when = o => !isToday ? "" : o.e <= now ? "vorbei" : o.s <= now ? "noch " + fmtDur(o.e - now) : "in " + fmtDur(o.s - now);
  const past = o => isToday ? o.e <= now : f.day < today;

  const items = [...day.map(o => ({ s: o.s, o })), ...focusGaps(day).map(g => ({ s: g.s, g }))].sort((a, b) => a.s - b.s);
  const rows = items.map(({ o, g }) => {
    if(g) return `<div class="focus-row"><div class="focus-time"><span class="ft-end">${fmtMin(g.s)}</span></div>
      <button type="button" class="focus-gap" data-gap="${g.s}-${g.e}">${icon("plus")}<span>${fmtDur(g.e - g.s)} frei · Zeit vergeben</span></button></div>`;
    const ev = o.ev, c = cat(ev.categoryId), todos = todosOf(ev, f.day), done = todos.filter(t => t.state === "done").length;
    const time = `<div class="focus-time${past(o) ? " past" : ""}"><span class="ft-start">${fmtMin(o.s)}</span><span class="ft-end">${fmtMin(o.e)}</span></div>`;
    if(ev.id === f.open) return `<div class="focus-row">${time}
      <article class="focus-event open" style="--cat:${c.color}" data-ev="${ev.id}">
        <button type="button" class="fe-head" data-edit="${ev.id}" title="Bearbeiten">
          <span class="fe-line"><span class="fe-title">${esc(ev.title)}</span><span class="fe-when">${when(o)}</span></span>
          <span class="fe-sub"><span class="fe-times">${fmtMin(o.s)} – ${fmtMin(o.e)}</span> · <span class="fe-cat">${esc(ev.categoryId ? c.name : "Frei")}</span></span></button>
        <div class="fe-body">
          <div class="todoList">${todos.map(todoRowHTML).join("")}</div>
          <label class="row add"><span class="row-icon">${icon("plus")}</span><span class="row-main"><input id="focusNewTodo" class="row-input" placeholder="Todo hinzufügen" autocomplete="off" enterkeyhint="done"></span></label>
        </div></article></div>`;
    const meta = [ev.categoryId ? c.name : "Frei", when(o), todos.length ? `${done} von ${todos.length}` : ""].filter(Boolean).join(" · ");
    return `<div class="focus-row">${time}
      <button type="button" class="focus-event${past(o) ? " past" : ""}" style="--cat:${c.color}" data-open="${ev.id}">
        <span class="fe-dot">${todos.length && done === todos.length ? icon("done") : ""}</span>
        <span class="fe-main"><span class="fe-title">${esc(ev.title)}</span><span class="fe-meta">${esc(meta)}</span></span></button></div>`;
  }).join("");

  const scroll = el.scrollTop, typing = document.activeElement && document.activeElement.id === "focusNewTodo";
  el.innerHTML = `<div class="focus-inner">
    <header class="focus-head">
      <div class="focus-name"><span class="overline">Fokus · ${dayWords(f.day)}</span>
        <h1 class="focus-title">${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}</h1></div>
      <button type="button" class="rbtn" id="focusClose" title="Zur Woche (Esc)">${icon("collapse")}</button>
    </header>
    <nav class="focus-week" aria-label="Woche">${weekOf(f.day).map(pill).join("")}</nav>
    <div class="focus-list">${rows || `<div class="focus-row"><div class="focus-time"></div>
      <button type="button" class="focus-gap" data-gap="${9*60}-${10*60}">${icon("plus")}<span>Keine Termine · Termin anlegen</span></button></div>`}</div>
  </div>`;
  el.scrollTop = scroll;                                       // a redraw (a tick, a sync) keeps the place
  if(typing) document.getElementById("focusNewTodo")?.focus();
}

/* one set of listeners on the layer; the content is redrawn under them */
function bindFocus(el){
  const openEv = () => S.events.find(x => x.id === UI.focus.open);
  const setTodos = fn => mutate(s => { const ev = s.events.find(x => x.id === UI.focus.open); if(ev){ const list = JSON.parse(JSON.stringify(todosOf(ev, UI.focus.day))); fn(list); setTodosOf(ev, UI.focus.day, list); } });
  el.addEventListener("click", e => {
    const t = e.target;
    if(t.closest("#focusClose")){ closeFocus(); return; }
    const pill = t.closest(".focus-pill");
    if(pill){ UI.focus.day = pill.dataset.day; UI.focus.open = null; renderFocus(); el.scrollTop = 0; return; }
    const open = t.closest("[data-open]");
    if(open){ UI.focus.open = open.dataset.open; renderFocus(); return; }
    const edit = t.closest("[data-edit]");
    if(edit){ const ev = openEv(); if(ev) openEditor({ type: "event", edit: ev, occurrence: UI.focus.day }); return; }
    const gap = t.closest("[data-gap]");
    if(gap){ const [s, en] = gap.dataset.gap.split("-").map(Number);
      openEditor({ type: "event", initial: { date: UI.focus.day, startMin: s, endMin: Math.min(en, s + 60) } }); return; }
    const row = t.closest(".todoRow"); if(!row) return;
    const id = row.dataset.tid;
    if(t.closest(".tdel")) setTodos(list => { const i = list.findIndex(x => x.id === id); if(i >= 0) list.splice(i, 1); });
    else if(t.closest(".tcheck")) setTodos(list => { const x = list.find(y => y.id === id); if(x) cycleTodo(x); });
  });
  el.addEventListener("contextmenu", e => {                    // as in the editor: postponed, or open again
    const row = e.target.closest(".focus-event.open .todoRow"); if(!row) return;
    e.preventDefault();
    setTodos(list => { const x = list.find(y => y.id === row.dataset.tid); if(x) x.state = x.state === "postponed" ? "open" : "postponed"; });
  });
  el.addEventListener("keydown", e => {
    if(e.target.id !== "focusNewTodo" || e.key !== "Enter") return;
    e.preventDefault();
    const text = e.target.value.trim(); if(!text) return;
    setTodos(list => list.push({ id: uid(), text, state: "open" }));
  });
}
