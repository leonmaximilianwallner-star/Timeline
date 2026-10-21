// input/timeline-drag.js — creating and resizing phases, opening editors on the timeline. Moved from index.html lines 1580–1708 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- timeline pipeline: create phase/milestone, resize phases, open editors ---------- */
$tlWrap.addEventListener("pointermove", e=>{
  if(drag || !UI.addMode) return;
  const th = document.getElementById("tlHover");
  if(th){ th.style.display=""; th.style.left = (tlPos(e)+.5)*TL_PPD+"px"; }
});
$tlWrap.addEventListener("pointerdown", e=>{
  if(e.button!==undefined && e.button!==0) return;

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
      const x = dayIdx(ns)*TL_PPD, w = Math.max((diffDays(ns,ne)+1)*TL_PPD, 26);   // +1: ne is the last day, shown
      ghost.style.left = x+"px"; ghost.style.width = w+"px";
    };
    const move = mv=>{
      panFollow(mv.clientX, mv.clientY);
      if(!armed){ if(Math.hypot(mv.clientX-sx, mv.clientY-sy) > MOVE_THRESHOLD) clearTimeout(armTimer); return; }
      const d = idxDate(tlPos(mv));
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
    panBind(move, "x", e.clientX, e.clientY); 
    window.addEventListener("pointermove",move); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
    return;
  }

  /* expand arrow / edit clicks are handled in the click handler below */
  if(e.target.closest(".ph-exp,.phase,.milestone-chip,.milestone-dot,.projLabel")) return;

  if(UI.addMode){ startPhaseCreate(e, false); return; }   // mouse/touch: add-mode → drag to create

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
});

/* phase / milestone creation drag on the empty timeline (shared by add-mode + long-press) */
function startPhaseCreate(e, fromHold=false){
  const a = tlPos(e);
  /* anchor the ghost in the lane row the user pressed in — gives it the same
     coordinate system as real phase pills (top:4px inside a 34px lane) and lets
     it pan with the content instead of drifting against the viewport */
  const lane = e.target.closest(".laneRow") || e.target.closest(".tlRow") || $tlInner.firstChild;
  $tlWrap.setPointerCapture(e.pointerId); UI.dragLive = true;
  let b = a, ghost = null, moved = false;
  const move = mv=>{
    panFollow(mv.clientX, mv.clientY);
    b = tlPos(mv); if(b!==a) moved = true;
    if(!ghost){ ghost = document.createElement("div"); ghost.className="tlCreate"; lane.appendChild(ghost); }
    const lo = Math.min(a,b), hi = Math.max(a,b);
    ghost.style.left = lo*TL_PPD+"px"; ghost.style.width = (hi-lo+1)*TL_PPD+"px";
  };
  const up = ()=>{
    try{ $tlWrap.releasePointerCapture(e.pointerId); }catch(_){}
    window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); window.removeEventListener("pointercancel",up);
    panRelease(); 
    UI.dragLive = false;
    if(ghost) ghost.remove();
    if(!moved){
      /* hold without drag → milestone on that day; add-mode click without drag → nothing */
      if(fromHold) openEditor({ type:"milestone", initial:{ date:idxDate(a) } });
      return;
    }
    const lo = idxDate(Math.min(a,b)), hi = idxDate(Math.max(a,b));
    if(lo===hi) openEditor({ type:"milestone", initial:{ date:lo } });
    else        openEditor({ type:"phase", initial:{ start:lo, end:dayAfter(hi) } });
  };
  panBind(move, "x", e.clientX, e.clientY);
  window.addEventListener("pointermove",move); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
}

/* click routing on the timeline (expand, edit) */
$tlWrap.addEventListener("click", e=>{
  const exp = e.target.closest("[data-expand]");
  if(exp){
    setDevice(dv=>{ const id = exp.dataset.expand; dv.openPhases = dv.openPhases.includes(id) ? dv.openPhases.filter(x=>x!==id) : [...dv.openPhases, id]; });
    return;
  }
  const phEl = e.target.closest(".phase");
  if(phEl){ const ph = S.phases.find(p=>p.id===phEl.dataset.phase); if(ph) openEditor({ type:"phase", edit:ph }); return; }
  const mEl = e.target.closest("[data-edit-milestone]");
  if(mEl){ const m = S.milestones.find(v=>v.id===mEl.dataset.editMilestone); if(m) openEditor({ type:"milestone", edit:m }); return; }
  const prEl = e.target.closest("[data-edit-project]");
  if(prEl){ toggleSettings(true); }
});
