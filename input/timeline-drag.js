// input/timeline-drag.js — creating and resizing phases, opening editors on the timeline. Moved from index.html lines 1580–1708 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- timeline pipeline: create phase/milestone, resize phases, open editors ---------- */
$tlWrap.addEventListener("pointermove", e=>{
  if(UI.dragLive || !UI.addMode) return;
  const th = document.getElementById("tlHover");
  if(th){ th.style.display=""; th.style.left = (tlPos(e)+.5)*TL_PPD+"px"; }
});
/* the timeline view's pointer, and the canvas's rail's: the rail is the same drawing, so the same code (Max, 20 Nov) */
function onTimelinePointerDown(e){
  if(e.button!==undefined && e.button!==0) return;
  const inner = e.target.closest("#rail") ? $railInner : $tlInner, ppd = inner === $railInner ? CANVAS_CELL : TL_PPD;

  /* a phase: its handles resize it, the rest of it moves it (Max, 20 Nov: the same as events and ideas) */
  const phEl = !e.target.closest(".ph-exp") && e.target.closest(".phase"), ph = phEl && S.phases.find(p=>p.id===phEl.dataset.phase);
  if(ph){
    dragRect(e, { at:m=>({ x:tlPos(m, inner), y:0 }), cells:"x", min:{ w:1 }, zone: e.target.closest(".rez")?.dataset.rez || "move",
      rect:{ x:dayIdx(ph.start), y:0, w:diffDays(ph.start, ph.end), h:0 }, el:phEl, dim:phEl, layer:phEl.parentElement,
      pan: inner === $tlInner, color: ph.categoryId ? cat(ph.categoryId).color : null, place:(g, r)=>placeTimelineGhost(g, r, ppd),
      done:(r, moved)=>{ if(moved) mutate(s=>{ const t = s.phases.find(p=>p.id===ph.id); t.start = idxDate(r.x); t.end = idxDate(r.x + r.w); }); } });   // a click: the click handler opens it
    return;
  }

  /* expand arrow / edit clicks are handled in the click handler below */
  if(e.target.closest(".ph-exp,.milestone-chip,.milestone-dot,.projLabel,.dropdown")) return;   // a dropdown is a thing: holding it creates nothing

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

/* the timeline's ghost: in the lane it was pressed in, shaped as a phase there (styles/timeline.css) */
function placeTimelineGhost(g, r, ppd){ g.el.style.left = r.x*ppd+"px"; g.el.style.width = Math.max(r.w*ppd, 26)+"px"; }

/* phase / milestone creation drag on the empty timeline (shared by add-mode + long-press) */
function startPhaseCreate(e, fromHold=false){
  const inner = e.target.closest("#rail") ? $railInner : $tlInner, ppd = inner === $railInner ? CANVAS_CELL : TL_PPD, p = tlPos(e, inner);
  const lane = e.target.closest(".laneRow") || e.target.closest(".tlRow") || inner.firstChild;
  dragRect(e, { at:m=>({ x:tlPos(m, inner), y:0 }), cells:"x", zone:"new", rect:{ x:p, y:0, w:0, h:0 }, el:inner, layer:lane,
    pan: inner === $tlInner, place:(g, r)=>placeTimelineGhost(g, r, ppd),
    done:(r, moved)=>{
      if(UI.drawMode) setDrawMode(false);                          // one thing created ends draw mode, as add mode
      if(!moved){ if(fromHold) openEditor({ type:"milestone", initial:{ date:idxDate(p) } }); return; }   // hold without drag → milestone; a click → nothing
      if(r.w === 1) openEditor({ type:"milestone", initial:{ date:idxDate(r.x) } });
      else          openEditor({ type:"phase", initial:{ start:idxDate(r.x), end:idxDate(r.x + r.w) } });
    } });
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
