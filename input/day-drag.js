// input/day-drag.js — creating, moving and resizing events by drag. Moved from index.html lines 1392–1579 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- day grid pipeline ---------- */
let lpTimer = null;

$dayWrap.addEventListener("pointermove", e=>{
  if(UI.dragLive) return;
  if(!UI.addMode){ hideHover(); return; }
  const grid = document.getElementById("dayGrid");
  if(!grid) return;
  const r = grid.getBoundingClientRect();
  if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom){ hideHover(); return; }
  const p = gridPos(e);
  const y = minToY(p.min);
  const hl = document.getElementById("hoverLine"), lab = document.getElementById("hoverLab");
  hl.style.display=""; hl.style.top = y+"px";
  lab.style.display=""; lab.style.top = y+"px"; lab.textContent = fmtMin(p.min);
  /* timeline hover mirror */
  const th = document.getElementById("tlHover");
  th.style.display=""; th.style.left = (p.day+.5)*TL_PPD+"px";
});
$dayWrap.addEventListener("pointerleave", ()=>{ if(!UI.dragLive) hideHover(); });

$dayWrap.addEventListener("pointerdown", e=>{
  if(e.button!==undefined && e.button!==0) return;
  const grid = document.getElementById("dayGrid"); if(!grid) return;
  const eventEl = e.target.closest(".event");
  if(eventEl && eventEl.dataset.actual) return;              // an actual: a tap opens it (below); no drag yet
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

/* an actual in front of its plan: a tap opens the actual's editor, not the plan's (Max, 1 Nov) */
$dayWrap.addEventListener("click", e=>{
  const el = e.target.closest(".event.actual"); if(!el) return;
  const a = S.actuals.find(x=>x.id===el.dataset.actual);
  if(a) openEditor({ type:"actual", edit:a });
});

/* the day view's rules for the one drag (input/pointer.js dragRect): x a day (a cell), y minutes (lines, 15 apart),
   within the day's hours; an event resizes by its top and bottom edges. Its ghost shows its times on the hour rail */
const dayAt = e => { const p = gridPos(e); return { x:p.day, y:p.min }; };
const DAY_RULES = { at:dayAt, cells:"x", min:{ h:SNAP }, bounds:{ y:[HOUR_START*60, HOUR_END*60] } };
function placeDayGhost(g, r){
  const y1 = minToY(r.y), y2 = minToY(r.y + r.h);
  Object.assign(g.el.style, { left:r.x*UI.dayPPD+4+"px", width:UI.dayPPD-8+"px", top:y1+"px", height:Math.max(y2-y1, 4)+"px" });
  if(!g.parts.length) g.parts = [0, 1].map(() => { const l = document.createElement("span"); l.className = "snapLab"; document.getElementById("hourRail").append(l); return l; });
  [[y1, r.y], [y2, r.y + r.h]].forEach(([y, m], i) => { g.parts[i].style.top = y+"px"; g.parts[i].textContent = fmtMin(m); });
}

function startCreateDrag(e, p, fromHold=false){
  const grid = document.getElementById("dayGrid");
  dragRect(e, { ...DAY_RULES, zone:"new", fix:"x", rect:{ x:p.day, y:p.min, w:1, h:0 }, el:grid, layer:grid, place:placeDayGhost,
    done:(r, moved, g)=>{
      if(!moved || !r.h){                                          // hold without drag → default-length item; add-mode click → nothing
        if(fromHold){ const s = snapMin(p.min); openEditor({ type:"event", initial:{ date:idxDate(p.day), startMin:s, endMin:clamp(s+60, s+SNAP, HOUR_END*60) } }); }
        return false;
      }
      openEditor({ type:"event", initial:{ date:idxDate(r.x), startMin:r.y, endMin:r.y + r.h }, preview:g });
      return true;                                                 // the ghost stays behind the editor
    } });
}

/* ---------- existing event: move / resize / copy-move ---------- */
function eventPointerDown(e, eventEl){
  const ev = S.events.find(x=>x.id===eventEl.dataset.ev); if(!ev) return;
  const dateISO = eventEl.dataset.date, zone = e.target.closest(".rez")?.dataset.rez || "move";   // its handles: top, bottom
  const copy = e.ctrlKey || e.metaKey, grid = document.getElementById("dayGrid");
  dragRect(e, { ...DAY_RULES, zone, rect:{ x:dayIdx(dateISO), y:ev.startMin, w:1, h:ev.endMin - ev.startMin },
    el:eventEl, dim: copy ? null : eventEl, layer:grid, pan:true, color: ev.categoryId ? cat(ev.categoryId).color : null,
    place:(g, r)=>{
      placeDayGhost(g, r);
      if(!copy) return;                                            // copy: a solid duplicate floats above the dashed ghost
      if(g.parts.length < 3){ const f = eventEl.cloneNode(true); f.classList.add("floatCopy"); f.removeAttribute("data-ev"); grid.append(f); g.parts.push(f); }
      Object.assign(g.parts[2].style, { left:parseFloat(g.el.style.left)+6+"px", top:parseFloat(g.el.style.top)-6+"px", width:g.el.style.width, height:g.el.style.height });
    },
    done:(r, moved)=>{
      if(!moved){ openEditor({ type:"event", edit:ev, occurrence:dateISO }); return; }   // a plain click opens the editor
      const day = idxDate(r.x), dayDelta = r.x - dayIdx(dateISO);
      if(copy){
        mutate(s=>{ s.events.push({ ...structuredClone(ev), id:uid(), repeat:"none", date:day, startMin:r.y, endMin:r.y + r.h,
          todosByDate:{ [day]: todosOf(ev, dateISO).map(t=>({...t, id:uid()})) } }); });   // the copied day's todos
        toast("Kopie erstellt");
      } else mutate(s=>{
        const t = s.events.find(x=>x.id===ev.id);
        t.startMin = r.y; t.endMin = r.y + r.h;
        if(dayDelta) shiftSeries(t, dayDelta);                     // series shifts as a whole: each day's todos, removed days and end with it
      });
    } });
}
