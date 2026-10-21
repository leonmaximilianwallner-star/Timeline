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
  const anchorDate = parseISO(idxDate(0));
  corner.innerHTML = `<span class="dw">KW</span><span class="dn" id="kwNum"></span>`;
  head.appendChild(corner);
  for(let i=0;i<days;i++){
    const dIso = idxDate(i), d = parseISO(dIso);
    const el = document.createElement("div");
    el.className = "dh"+(dIso===today?" today":"")+((d.getDay()===0||d.getDay()===6)?" weekend":"");
    el.style.width = ppd+"px";
    el.innerHTML = `<span class="dw">${WD[d.getDay()]}</span><span class="dn">${d.getDate()}</span>`;
    head.appendChild(el);
  }
  inner.appendChild(head);

  /* body: hour rail + grid */
  const body = document.createElement("div"); body.id="dayBody"; body.style.height = GRID_H+"px";
  const rail = document.createElement("div"); rail.id="hourRail";
  for(let h=HOUR_START; h<=HOUR_END; h++){
    const lab = document.createElement("span"); lab.className="hr-lab";
    lab.style.top = (h-HOUR_START)*HOUR_PX+"px"; lab.textContent = String(h).padStart(2,"0")+":00";
    rail.appendChild(lab);
  }
  const hoverLab = document.createElement("span"); hoverLab.id="hoverLab"; rail.appendChild(hoverLab);
  body.appendChild(rail);

  const grid = document.createElement("div"); grid.id="dayGrid";
  grid.style.width = days*ppd+"px"; grid.style.height = GRID_H+"px";
  grid.classList.toggle("addmode", UI.addMode);
  for(let i=0;i<days;i++){
    const d = parseISO(idxDate(i));
    const colEl = document.createElement("div");
    colEl.className = "dayCol"+((d.getDay()===0||d.getDay()===6)?" weekend":"");
    colEl.style.left = i*ppd+"px"; colEl.style.width = ppd+"px";
    grid.appendChild(colEl);
  }
  for(let h=HOUR_START+1; h<HOUR_END; h++){
    const l = document.createElement("div"); l.className="hline";
    l.style.top = (h-HOUR_START)*HOUR_PX+"px"; grid.appendChild(l);
  }

  /* events, overlapping ones side by side */
  for(let i=0;i<days;i++){
    const dIso = idxDate(i);
    const occ = S.events.filter(ev=>occursOn(ev,dIso))
      .map(ev=>({ev, s:ev.startMin, e:ev.endMin}))
      .sort((a,b)=> a.s-b.s || b.e-a.e);
    /* group events that overlap (directly or via others), assign columns greedily */
    let overlap = [], overlapEnd = -1;
    const flush = ()=>{
      if(!overlap.length) return;
      const colsEnd = [];
      overlap.forEach(o=>{
        let c = colsEnd.findIndex(end=>end <= o.s);
        if(c===-1){ c = colsEnd.length; colsEnd.push(0); }
        colsEnd[c] = o.e; o.col = c;
      });
      const n = colsEnd.length, innerW = ppd - 8;
      overlap.forEach(o=>{
        const cw = (innerW - (n-1)*4)/n;
        grid.appendChild(renderEvent(o.ev, dIso, i*ppd + 4 + o.col*(cw+4), cw));
      });
      overlap = []; overlapEnd = -1;
    };
    occ.forEach(o=>{
      if(overlap.length && o.s >= overlapEnd) flush();
      overlap.push(o); overlapEnd = Math.max(overlapEnd, o.e);
    });
    flush();
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
  const idx = Math.floor(($scene.scrollLeft + railW() + UI.dayPPD) / UI.dayPPD);
  const clamped = Math.max(0, Math.min(idx, UI.range.days - 1));
  el.textContent = isoWeek(parseISO(idxDate(clamped)));
}

function renderEvent(ev, dIso, x, w){
  const top = (ev.startMin - HOUR_START*60)/60*HOUR_PX;
  const h   = Math.max((ev.endMin - ev.startMin)/60*HOUR_PX - 2, 18);
  const el = document.createElement("div");
  const allDone = ev.todos.length>0 && ev.todos.every(t=>t.state==="done");
  el.className = "event" + (allDone ? " complete" : "");
  const col = cat(ev.categoryId).color;
  el.style.cssText = `left:${x}px;top:${top}px;width:${w}px;height:${h}px;background:${col}d0;--cat-fill:${col}`;
  el.dataset.ev = ev.id; el.dataset.date = dIso;
  const open = ev.todos.filter(t=>t.state==="open"||t.state==="postponed").length;
  const done = ev.todos.filter(t=>t.state==="done").length;
  el.innerHTML =
    `<span class="et">${esc(ev.title)}</span>`+
    (h>34?`<span class="em">${fmtMin(ev.startMin)}–${fmtMin(ev.endMin)}${ev.repeat&&ev.repeat!=="none"?" ↻":""}${ev.reminderMin!=null?" 🔔":""}</span>`:"")+
    (ev.todos.length?`<span class="badges"><span class="badge">${done}/${ev.todos.length} ✓${open&&ev.todos.some(t=>t.state==="postponed")?" ·→":""}</span></span>`:"")+
    `<span class="rezH t"></span><span class="rezH b"></span>`;
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
  nl.style.top  = (min - HOUR_START*60)/60*HOUR_PX+"px";
  nl.style.left = i*UI.dayPPD+"px"; nl.style.width = UI.dayPPD+"px";
}
setInterval(positionNowLine, 60000);

