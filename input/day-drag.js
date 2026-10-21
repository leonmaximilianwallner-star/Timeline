// input/day-drag.js — creating, moving and resizing events by drag. Moved from index.html lines 1392–1579 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- day grid pipeline ---------- */
let drag = null;   // { kind, ... } the live drag machine
let lpTimer = null;

$dayWrap.addEventListener("pointermove", e=>{
  if(drag) return;
  if(!UI.addMode){ hideHover(); return; }
  const grid = document.getElementById("dayGrid");
  if(!grid) return;
  const r = grid.getBoundingClientRect();
  if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom){ hideHover(); return; }
  const p = gridPos(e);
  const y = (p.min - HOUR_START*60)/60*HOUR_PX;
  const hl = document.getElementById("hoverLine"), lab = document.getElementById("hoverLab");
  hl.style.display=""; hl.style.top = y+"px";
  lab.style.display=""; lab.style.top = y+"px"; lab.textContent = fmtMin(p.min);
  /* timeline hover mirror */
  const th = document.getElementById("tlHover");
  th.style.display=""; th.style.left = (p.day+.5)*TL_PPD+"px";
});
$dayWrap.addEventListener("pointerleave", ()=>{ if(!drag) hideHover(); });

$dayWrap.addEventListener("pointerdown", e=>{
  if(e.button!==undefined && e.button!==0) return;
  const grid = document.getElementById("dayGrid"); if(!grid) return;
  const eventEl = e.target.closest(".event");
  if(eventEl){ eventPointerDown(e, eventEl); return; }
  if(!grid.contains(e.target) && e.target!==grid) return;

  const p = gridPos(e);
  if(UI.addMode){
    startCreateDrag(e, p);
  } else if(e.pointerType !== "mouse"){
    /* touch/pen: hold to arm a create-drag, then drag to size, release → editor.
       (No add-mode needed.) Moving before the hold completes cancels it. */
    const sx=e.clientX, sy=e.clientY;
    const teardown = ()=>{ clearTimeout(lpTimer); window.removeEventListener("pointermove",cancel); window.removeEventListener("pointerup",off); window.removeEventListener("pointercancel",off); };
    lpTimer = setTimeout(()=>{ teardown(); vibrate(12); startCreateDrag(e, p, true); }, LONGPRESS);
    const cancel = ev=>{ if(Math.hypot(ev.clientX-sx, ev.clientY-sy) > MOVE_THRESHOLD) teardown(); };
    const off = ()=> teardown();
    window.addEventListener("pointermove", cancel);
    window.addEventListener("pointerup", off); window.addEventListener("pointercancel", off);
  }
});

function startCreateDrag(e, p, fromHold=false){
  const grid = document.getElementById("dayGrid");
  grid.setPointerCapture(e.pointerId);
  UI.dragLive = true;
  drag = { kind:"create", day:p.day, a:p.min, b:p.min, moved:false, prev:null, labs:[] };
  const move = ev=>{
    const q = gridPos(ev);
    if(Math.abs(q.min - drag.a) >= SNAP) drag.moved = true;
    drag.b = q.min;
    drawCreatePreview(grid, drag);
  };
  const up = ()=>{
    grid.releasePointerCapture(e.pointerId);
    window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); window.removeEventListener("pointercancel",up);
    UI.dragLive = false;
    const d = drag; drag = null;
    if(!d.moved){
      clearPreview(d);
      /* hold without drag → default-length item; add-mode click without drag → nothing */
      if(fromHold){
        const s = snapMin(d.a);
        openEditor({ type:"event", initial:{ date:idxDate(d.day), startMin:s, endMin:clamp(s+60, s+SNAP, HOUR_END*60) } });
      }
      return;
    }
    const s = Math.min(d.a,d.b), en = Math.max(d.a,d.b);
    openEditor({ type:"event", initial:{ date:idxDate(d.day), startMin:s, endMin:Math.max(en, s+SNAP) }, preview:d });
  };
  window.addEventListener("pointermove",move); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
}
function drawCreatePreview(grid, d){
  if(!d.prev){
    d.prev = document.createElement("div"); d.prev.className="dragPrev"; grid.appendChild(d.prev);
    const rail = document.getElementById("hourRail");
    d.labs = [0,1].map(()=>{ const s=document.createElement("span"); s.className="snapLab"; rail.appendChild(s); return s; });
    /* optional category tint — set once on creation; falls back to the neutral default */
    if(d.color){
      d.prev.style.borderColor = d.color;
      d.prev.style.background  = d.color + "24";   // ~14% alpha — enough to read, not muddy
    }
  }
  const s = Math.min(d.a,d.b), e = Math.max(d.a,d.b);
  const y1 = (s-HOUR_START*60)/60*HOUR_PX, y2 = (e-HOUR_START*60)/60*HOUR_PX;
  d.prev.style.cssText += `;left:${d.day*UI.dayPPD+4}px;width:${UI.dayPPD-8}px;top:${y1}px;height:${Math.max(y2-y1,4)}px`;
  /* cssText reset wipes inline border/background — re-apply if colored */
  if(d.color){
    d.prev.style.borderColor = d.color;
    d.prev.style.background  = d.color + "24";
  }
  d.labs[0].style.top=y1+"px"; d.labs[0].textContent=fmtMin(s);
  d.labs[1].style.top=y2+"px"; d.labs[1].textContent=fmtMin(e);
}
function clearPreview(d){
  if(d && d.prev) d.prev.remove();
  if(d && d.labs) d.labs.forEach(l=>l.remove());
}

/* ---------- existing event: move / resize / copy-move ---------- */
function eventPointerDown(e, eventEl){
  const ev = S.events.find(x=>x.id===eventEl.dataset.ev); if(!ev) return;
  const dateISO = eventEl.dataset.date;
  const rect = eventEl.getBoundingClientRect();
  const zone = (e.clientY - rect.top) <= EDGE ? "t" : (rect.bottom - e.clientY) <= EDGE ? "b" : "move";
  const copy = e.ctrlKey || e.metaKey;
  const startP = gridPos(e);
  let armed = e.pointerType === "mouse" || e.pointerType === "pen";
  let armTimer = null;

  if(!armed){ /* touch: move needs a long-press; resize needs only a short deliberate dwell */
    const hold = zone==="move" ? LONGPRESS : RESIZE_HOLD;
    armTimer = setTimeout(()=>{ armed = true; UI.dragLive = true; vibrate(12); if(zone==="move") eventEl.classList.add("dragging"); }, hold);
  }
  eventEl.setPointerCapture(e.pointerId);
  const st = { moved:false, day:startP.day,
               s:ev.startMin, en:ev.endMin, grabOff: startP.min - ev.startMin };
  const evColor = ev.categoryId ? cat(ev.categoryId).color : null;
  const pv = { day:startP.day, a:ev.startMin, b:ev.endMin, prev:null, labs:[], color: evColor };
  /* copy-mode: a solid duplicate of the event floats above the dashed ghost */
  let floatEl = null;
  const positionFloat = ()=>{
    if(!floatEl || !pv.prev) return;
    const r = pv.prev;
    floatEl.style.left   = (parseFloat(r.style.left) + 6) + "px";   // offset right
    floatEl.style.top    = (parseFloat(r.style.top)  - 6) + "px";   // offset up
    floatEl.style.width  = r.style.width;
    floatEl.style.height = r.style.height;
  };

  const move = mv=>{
    const q = gridPos(mv);
    if(!armed){
      if(Math.hypot(mv.clientX-e.clientX, mv.clientY-e.clientY) > MOVE_THRESHOLD) clearTimeout(armTimer);
      return;
    }
    if(!st.moved && Math.hypot(mv.clientX-e.clientX, mv.clientY-e.clientY) <= MOVE_THRESHOLD && zone==="move") return;
    if(!st.moved){ st.moved=true; UI.dragLive=true; if(!copy) eventEl.classList.add("dragging"); }
    if(zone==="move"){
      const dur = ev.endMin - ev.startMin;
      st.s  = clamp(snapMin(q.min - st.grabOff), HOUR_START*60, HOUR_END*60 - dur);
      st.en = st.s + dur; st.day = q.day;
    } else if(zone==="t"){ st.s = Math.min(snapMin(q.min), ev.endMin - SNAP); }
    else { st.en = Math.max(snapMin(q.min), ev.startMin + SNAP); }
    pv.day = st.day; pv.a = st.s; pv.b = st.en;
    drawCreatePreview(document.getElementById("dayGrid"), pv);
    /* copy-mode: lazily build the floating duplicate, then follow the ghost */
    if(copy){
      if(!floatEl){
        floatEl = eventEl.cloneNode(true);
        floatEl.classList.add("floatCopy");
        floatEl.removeAttribute("data-ev");
        document.getElementById("dayGrid").appendChild(floatEl);
      }
      positionFloat();
    }
  };
  const up = ()=>{
    clearTimeout(armTimer);
    try{ eventEl.releasePointerCapture(e.pointerId); }catch(_){}
    window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); window.removeEventListener("pointercancel",up);
    eventEl.classList.remove("dragging");
    UI.dragLive = false;
    clearPreview(pv);
    if(floatEl){ floatEl.remove(); floatEl = null; }
    if(!st.moved){ openTodoPanel(ev, dateISO, eventEl); return; }   // plain click → todo panel
    const dayDelta = st.day - dayIdx(dateISO);
    if(copy){
      mutate(s=>{
        s.events.push({ ...structuredClone(ev), id:uid(), repeat:"none",
          date: idxDate(st.day), startMin: st.s, endMin: st.en,
          todos: ev.todos.map(t=>({...t, id:uid()})) });
      });
      toast("Kopie erstellt");
    } else {
      mutate(s=>{
        const t = s.events.find(x=>x.id===ev.id);
        t.startMin = st.s; t.endMin = st.en;
        if(dayDelta) t.date = isoDate(addDays(parseISO(t.date), dayDelta));  // series shifts as a whole
      });
    }
  };
  window.addEventListener("pointermove",move); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
}

