// views/day/render.js — draws the day view. Moved from index.html lines 1083–1237 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- daily view ---------- */
function renderDays(){
  const ppd = dayPPD(), days = UI.range.days, W = railW() + days*ppd;
  UI.dayPPD = ppd;
  const today = todayISO();

  const inner = document.createElement("div");
  inner.style.width = W+"px";

  /* sticky day header */
  const head = document.createElement("div"); head.id="dayHead";
  const corner = document.createElement("div");
  corner.id = "dayHeadCorner";
  corner.className = "dh";
  corner.innerHTML = `<span class="dw">KW</span><span class="dn" id="kwNum"></span><span class="dh-dots"></span>`;
  head.appendChild(corner);
  for(let i=0;i<days;i++){
    const dIso = idxDate(i), d = parseISO(dIso);
    const el = document.createElement("div");
    el.className = "dh"+(dIso===today?" today":"")+((d.getDay()===0||d.getDay()===6)?" weekend":"");
    el.style.width = ppd+"px";
    el.dataset.day = dIso; el.setAttribute("role", "button"); el.title = "Todos dieses Tages";
    el.innerHTML = `<span class="dw">${WD[d.getDay()]}</span><span class="dn">${d.getDate()}</span><span class="dh-dots">${dayDotsHTML(dIso)}</span>`;
    head.appendChild(el);
  }
  inner.appendChild(head);

  /* body: hour rail + grid */
  const body = document.createElement("div"); body.id="dayBody"; body.style.height = gridHeight()+"px";
  const rail = document.createElement("div"); rail.id="hourRail";
  const startH = dayStartMin()/60;
  for(let h=HOUR_START; h<=HOUR_END; h++){
    if(h > 0 && h < startH) continue;                   // the thin night: too little room for its hours; 00:00 marks where it begins
    const lab = document.createElement("span"); lab.className="hr-lab";
    lab.style.top = minToY(h*60)+"px"; lab.textContent = String(h).padStart(2,"0")+":00";
    rail.appendChild(lab);
  }
  const hoverLab = document.createElement("span"); hoverLab.id="hoverLab"; rail.appendChild(hoverLab);
  body.appendChild(rail);

  const grid = document.createElement("div"); grid.id="dayGrid";
  grid.style.width = days*ppd+"px"; grid.style.height = gridHeight()+"px";
  if(startH > 0){ const night = document.createElement("div"); night.className = "night"; night.style.height = minToY(startH*60)+"px"; grid.appendChild(night); }
  grid.classList.toggle("addmode", UI.addMode);
  for(let i=0;i<days;i++){
    const d = parseISO(idxDate(i));
    const colEl = document.createElement("div");
    colEl.className = "dayCol"+((d.getDay()===0||d.getDay()===6)?" weekend":"");
    colEl.style.left = i*ppd+"px"; colEl.style.width = ppd+"px";
    grid.appendChild(colEl);
  }
  for(let h=Math.max(HOUR_START+1, startH); h<HOUR_END; h++){
    const l = document.createElement("div"); l.className="hline";
    l.style.top = minToY(h*60)+"px"; grid.appendChild(l);
  }

  /* two layers (RULEBOOK C.3): the plan behind, resting top-left; the actuals in front, bottom-right.
     Each layer packs its own overlaps, so a plan and its own actual never sit side by side. */
  const nowMin = new Date().getHours()*60 + new Date().getMinutes();
  for(let i=0;i<days;i++){
    const dIso = idxDate(i);
    const place = o => { const cw = (ppd - 8 - (o.cols-1)*4)/o.cols; return { x: i*ppd + 4 + o.col*(cw+4), w: cw }; };
    packOverlaps(S.events.filter(ev=>occursOn(ev,dIso)).map(ev=>({ev, s:ev.startMin, e:ev.endMin})))
      .forEach(o=>{ const p = place(o); grid.appendChild(renderEvent(o.ev, dIso, p.x, p.w - ACTUAL_OFFSET, hasActual(S.actuals, o.ev.id, dIso))); });
    packOverlaps(actualsOn(S.actuals, dIso).map(a=>({a, s:a.startMin, e:actualEnd(a, today, nowMin)})))
      .forEach(o=>{ const p = place(o); grid.appendChild(renderActual(o.a, o.e, p.x + ACTUAL_OFFSET, p.w - ACTUAL_OFFSET)); });
  }

  /* overlays */
  const hover = document.createElement("div"); hover.id="hoverLine"; grid.appendChild(hover);
  const now = document.createElement("div"); now.id="nowLine"; grid.appendChild(now);
  body.appendChild(grid);
  inner.appendChild(body);
  $dayInner.replaceChildren(inner);
  updateKW();
}

function isoWeek(d) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfW1 = new Date(jan4);
  startOfW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const daysDiff = Math.floor((d - startOfW1) / 86400000);
  const week = Math.floor(daysDiff / 7) + 1;
  if (week < 1) return isoWeek(new Date(d.getFullYear() - 1, 11, 28));
  if (week > 52) {
    const jan4next = new Date(d.getFullYear() + 1, 0, 4);
    const startOfW1next = new Date(jan4next);
    startOfW1next.setDate(jan4next.getDate() - ((jan4next.getDay() + 6) % 7));
    if (d >= startOfW1next) return 1;
  }
  return week;
}

function updateKW(){
  const el = document.getElementById("kwNum");
  if(!el) return;
  const idx = Math.round($scene.scrollLeft / UI.dayPPD);        // the first day right of the hour rail
  const clamped = Math.max(0, Math.min(idx, UI.range.days - 1));
  el.textContent = isoWeek(parseISO(idxDate(clamped)));
}

/* An event shows as many 16px lines as its height holds (mockup "Detail nach Höhe"):
   the title first (words break at German syllables), then the time, then the todo count.
   Under one line high it is just its colour. */
const ACTUAL_OFFSET = 3;   // px: the plan rests this far toward the top-left, an actual toward the bottom-right (~3 min: below the snap)
const EVENT_LINE = 16, EVENT_PAD_Y = 4, EVENT_NARROW = 80, TIME_W = 66;   // px; TIME_W: "09:00–11:00" at 12px
const EVENT_ICON = {
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="wiederholt"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  bell:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Erinnerung"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
};
function renderEvent(ev, dIso, x, w, outline){
  const top = minToY(ev.startMin);
  const h   = Math.max(minToY(ev.endMin) - top - 2, 18);
  const el = document.createElement("div");
  const todos = todosOf(ev, dIso);                 // this occurrence's todos only
  const allDone = todos.length>0 && todos.every(t=>t.state==="done");
  const narrow = w < EVENT_NARROW;
  el.className = "event" + (allDone ? " complete" : "") + (narrow ? " narrow" : "") + (outline ? " outline" : "");   // outline: it has an actual
  const col = cat(ev.categoryId).color;
  /* the lines: title ≥ 1, then the time (only the start where the range doesn't fit), then todos */
  const lines = Math.floor((h - 2*EVENT_PAD_Y) / EVENT_LINE);
  const fullTime = (w - (narrow ? 12 : 16)) >= TIME_W;
  const showTime = lines >= 2;
  const showTodos = todos.length && lines >= (showTime ? 3 : 2);
  const titleLines = Math.max(1, lines - (showTime ? 1 : 0) - (showTodos ? 1 : 0));
  el.style.cssText = `left:${x}px;top:${top}px;width:${w}px;height:${h}px;background:${outline ? "transparent" : col+"d0"};--cat-fill:${col};--title-lines:${titleLines}`;
  el.dataset.ev = ev.id; el.dataset.date = dIso;
  const done = todos.filter(t=>t.state==="done").length;
  const marks = (ev.repeat&&ev.repeat!=="none" ? EVENT_ICON.repeat : "") + (ev.reminderMin!=null ? EVENT_ICON.bell : "");
  el.innerHTML = (lines >= 1 ? `<span class="et">${esc(ev.title)}</span>` : "") +
    (showTime ? `<span class="em">${fullTime ? `${fmtMin(ev.startMin)}–${fmtMin(ev.endMin)}${marks ? `<span class="marks">${marks}</span>` : ""}` : fmtMin(ev.startMin)}</span>` : "") +
    (showTodos ? `<span class="badge">✓ ${done}/${todos.length}${todos.some(t=>t.state==="postponed") ? " · →" : ""}</span>` : "") +
    `<span class="rezH t"></span><span class="rezH b"></span>`;
  return el;
}
/* an actual: the plan's look, in front, with the plan's title (or its category's name without a plan).
   Not touchable yet: taps reach the plan behind it (correction mode comes next, RULEBOOK B.8). */
function renderActual(a, endMin, x, w){
  const plan = a.eventId && S.events.find(ev=>ev.id===a.eventId);
  const top = minToY(a.startMin) + ACTUAL_OFFSET;
  const h   = Math.max(minToY(endMin) - minToY(a.startMin) - 2, 6);   // the plan's box, moved down and right: its edges stay within ~3 min of the truth
  const el = document.createElement("div");
  const col = cat(a.categoryId).color;
  const lines = Math.floor((h - 2*EVENT_PAD_Y) / EVENT_LINE);
  el.className = "event actual" + (a.endMin == null ? " running" : "") + (w < EVENT_NARROW ? " narrow" : "");
  el.style.cssText = `left:${x}px;top:${top}px;width:${w}px;height:${h}px;background:${col}d0;--title-lines:${Math.max(1, lines - 1)}`;
  el.dataset.actual = a.id;
  const title = plan ? plan.title : cat(a.categoryId).name;
  el.innerHTML = (lines >= 1 ? `<span class="et">${esc(title)}</span>` : "") +
    (lines >= 2 ? `<span class="em">${fmtMin(a.startMin)}–${a.endMin == null ? "läuft" : fmtMin(a.endMin)}</span>` : "");
  return el;
}
function fmtDur(min) {
  if (min < 60) return min + "min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return h + "h";
  if (m === 30) return h + ".5h";
  return h + "h " + m + "min";
}
function positionNowLine(){
  const nl = document.getElementById("nowLine");
  if(!nl) return;
  const now = new Date();
  const min = now.getHours()*60 + now.getMinutes();
  const i = dayIdx(todayISO());
  if(min < HOUR_START*60 || min > HOUR_END*60 || i<0 || i>=UI.range.days){ nl.style.display="none"; return; }
  nl.style.display = "";
  nl.style.top  = minToY(min)+"px";
  nl.style.left = i*UI.dayPPD+"px"; nl.style.width = UI.dayPPD+"px";
}
setInterval(()=>{
  if(runningActual(S.actuals) && !UI.dragLive) renderDays();    // a running actual grows with the time (redrawn first: it makes a new now line)
  positionNowLine();
}, 60000);

