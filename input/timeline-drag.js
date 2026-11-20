// input/timeline-drag.js — creating and resizing phases, opening editors on the timeline. Moved from index.html lines 1580–1708 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- timeline pipeline: create phase/milestone, resize phases, open editors ---------- */
$tlWrap.addEventListener("pointermove", e=>{
  if(drag || !UI.addMode) return;
  const th = document.getElementById("tlHover");
  if(th){ th.style.display=""; th.style.left = (tlPos(e)+.5)*TL_PPD+"px"; }
});
/* the timeline view's pointer, and the canvas's rail's: the rail is the same drawing, so the same code (Max, 20 Nov) */
function onTimelinePointerDown(e){
  if(e.button!==undefined && e.button!==0) return;
  const inner = e.target.closest("#rail") ? $railInner : $tlInner, ppd = inner === $railInner ? CANVAS_CELL : TL_PPD;

  /* resize handles on phase pills */
  const handle = e.target.closest(".ph-handle");
  if(handle){
    const phEl = handle.closest(".phase");
    const ph = S.phases.find(p=>p.id===phEl.dataset.phase); if(!ph) return;
    const side = handle.dataset.rez;
    const sx = e.clientX, sy = e.clientY;
    let armed = e.pointerType === "mouse" || e.pointerType === "pen";
    let armTimer = null;
    phEl.setPointerCapture(e.pointerId);
    if(armed){ UI.dragLive = true; }
    else { armTimer = setTimeout(()=>{ armed = true; UI.dragLive = true; vibrate(12); }, RESIZE_HOLD); }
    const last = lastDay(ph.end);                       /* the drag works in shown days: start .. last day */
    let ns = ph.start, ne = last;
    /* dashed ghost in the same lane row; original pill stays put visually until commit */
    const lane = phEl.parentElement;
    const phColor = ph.categoryId ? cat(ph.categoryId).color : null;
    let ghost = null;
    const drawGhost = ()=>{
      if(!ghost){
        ghost = document.createElement("div"); ghost.className="tlCreate";
        if(phColor){ ghost.style.borderColor = phColor; ghost.style.background = phColor + "24"; }
        lane.appendChild(ghost);
      }
      const x = dayIdx(ns)*ppd, w = Math.max((diffDays(ns,ne)+1)*ppd, 26);   // +1: ne is the last day, shown
      ghost.style.left = x+"px"; ghost.style.width = w+"px";
    };
    const move = mv=>{
      panFollow(mv.clientX, mv.clientY);
      if(!armed){ if(Math.hypot(mv.clientX-sx, mv.clientY-sy) > MOVE_THRESHOLD) clearTimeout(armTimer); return; }
      const d = idxDate(tlPos(mv, inner));
      if(side==="l") ns = d <= last ? d : last; else ne = d >= ph.start ? d : ph.start;
      drawGhost();
    };
    const up = ()=>{
      clearTimeout(armTimer);
      try{ phEl.releasePointerCapture(e.pointerId); }catch(_){}
      window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); window.removeEventListener("pointercancel",up);
      panRelease();
      UI.dragLive = false;
      if(ghost) ghost.remove();
      if(ns!==ph.start || ne!==last) mutate(s=>{ const t=s.phases.find(p=>p.id===ph.id); t.start=ns; t.end=dayAfter(ne); });
    };
    if(inner === $tlInner) panBind(move, "x", e.clientX, e.clientY);   // edge pan scrolls the week's scroller: not from the rail
    window.addEventListener("pointermove",move); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
    return;
  }

  /* expand arrow / edit clicks are handled in the click handler below */
  if(e.target.closest(".ph-exp,.phase,.milestone-chip,.milestone-dot,.projLabel,.dropdown")) return;   // a dropdown is a thing: holding it creates nothing

  if(UI.addMode || UI.drawMode){ startPhaseCreate(e, false); return; }   // add mode (the week) or draw mode on the rail (the canvas) → drag to create

  if(e.pointerType !== "mouse"){
    /* touch/pen: hold to arm phase creation, then drag across days, release → editor */
    const sx=e.clientX, sy=e.clientY;
    const teardown = ()=>{ clearTimeout(lpTimer); window.removeEventListener("pointermove",cancel); window.removeEventListener("pointerup",off); window.removeEventListener("pointercancel",off); };
    lpTimer = setTimeout(()=>{ teardown(); vibrate(12); startPhaseCreate(e, true); }, LONGPRESS);
    const cancel = ev=>{ if(Math.hypot(ev.clientX-sx, ev.clientY-sy) > MOVE_THRESHOLD) teardown(); };
    const off = ()=> teardown();
    window.addEventListener("pointermove", cancel);
    window.addEventListener("pointerup", off); window.addEventListener("pointercancel", off);
  }
}
$tlWrap.addEventListener("pointerdown", onTimelinePointerDown);

/* phase / milestone creation drag on the empty timeline (shared by add-mode + long-press) */
function startPhaseCreate(e, fromHold=false){
  const inner = e.target.closest("#rail") ? $railInner : $tlInner, ppd = inner === $railInner ? CANVAS_CELL : TL_PPD;
  const a = tlPos(e, inner);
  /* anchor the ghost in the lane row the user pressed in — gives it the same
     coordinate system as real phase pills (top:4px inside a 34px lane) and lets
     it pan with the content instead of drifting against the viewport */
  const lane = e.target.closest(".laneRow") || e.target.closest(".tlRow") || inner.firstChild;
  inner.setPointerCapture(e.pointerId); UI.dragLive = true;
  let b = a, ghost = null, moved = false;
  const move = mv=>{
    panFollow(mv.clientX, mv.clientY);
    b = tlPos(mv, inner); if(b!==a) moved = true;
    if(!ghost){ ghost = document.createElement("div"); ghost.className="tlCreate"; lane.appendChild(ghost); }
    const lo = Math.min(a,b), hi = Math.max(a,b);
    ghost.style.left = lo*ppd+"px"; ghost.style.width = (hi-lo+1)*ppd+"px";
  };
  const up = ()=>{
    try{ inner.releasePointerCapture(e.pointerId); }catch(_){}
    window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); window.removeEventListener("pointercancel",up);
    panRelease(); 
    UI.dragLive = false;
    if(ghost) ghost.remove();
    if(UI.drawMode) setDrawMode(false);                          // one thing created ends draw mode, as add mode
    if(!moved){
      /* hold without drag → milestone on that day; add-mode click without drag → nothing */
      if(fromHold) openEditor({ type:"milestone", initial:{ date:idxDate(a) } });
      return;
    }
    const lo = idxDate(Math.min(a,b)), hi = idxDate(Math.max(a,b));
    if(lo===hi) openEditor({ type:"milestone", initial:{ date:lo } });
    else        openEditor({ type:"phase", initial:{ start:lo, end:dayAfter(hi) } });
  };
  if(inner === $tlInner) panBind(move, "x", e.clientX, e.clientY);
  window.addEventListener("pointermove",move); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
}

/* click routing on the timeline (expand, edit) */
/* a click on the timeline view, or on the canvas's rail (input/canvas-pull.js): it opens what it hits */
function onTimelineClick(e){
  const exp = e.target.closest("[data-expand]");
  if(exp){
    const id = exp.dataset.expand, isOpen = device.openPhases.includes(id);
    if(!isOpen){
      UI.dropdownOpening = id;                                   // it opens with the animation; one phase open at a time
      setDevice(dv=>{ dv.openPhases = [id]; });
      UI.dropdownOpening = null;
      return;
    }
    const close = ()=>setDevice(dv=>{ dv.openPhases = dv.openPhases.filter(x=>x!==id); });
    const dd = document.querySelector(`.dropdown[data-dropdown="${id}"]`);
    if(!dd || matchMedia("(prefers-reduced-motion: reduce)").matches) return close();
    dd.classList.remove("opening"); dd.classList.add("closing");   // …and closes with the same animation, reversed (Max, 22 Oct)
    let done = false; const once = ()=>{ if(!done){ done = true; close(); } };
    dd.addEventListener("animationend", once, { once:true }); setTimeout(once, 400);   // closed even if the motion's end goes unnoticed
    return;
  }
  /* in an open phase's plan: a todo's ring ticks it; a head opens its event */
  const tickEl = e.target.closest("[data-tick-todo]");
  if(tickEl){
    const { tickTodo: id, ev: evId, day } = tickEl.dataset;
    mutate(st => { const ev = st.events.find(x => x.id === evId); if(ev) setTodosOf(ev, day, todosOf(ev, day).map(t => t.id === id ? { ...t, state:"done" } : t)); });
    return;
  }
  const evEl = e.target.closest("[data-open-event]");
  if(evEl){ const ev = S.events.find(x=>x.id===evEl.dataset.openEvent); if(ev) openEditor({ type:"event", edit:ev, occurrence:evEl.dataset.day }); return; }
  const phEl = e.target.closest(".phase");
  if(phEl){ const ph = S.phases.find(p=>p.id===phEl.dataset.phase); if(ph) openEditor({ type:"phase", edit:ph }); return; }
  const mEl = e.target.closest("[data-edit-milestone]");
  if(mEl){ const m = S.milestones.find(v=>v.id===mEl.dataset.editMilestone); if(m) openEditor({ type:"milestone", edit:m }); return; }
  const prEl = e.target.closest("[data-edit-project]");
  if(prEl){ toggleSettings(true, { name:"colour", id:prEl.dataset.editProject }); }   // the project's own page
}
$tlWrap.addEventListener("click", onTimelineClick);
