// views/viewport.js — the one scroll container. Moved unchanged from index.html lines 1238–1321 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   scroll — ONE native viewport (#scene), both axes, compositor-driven.

   Horizontal: the timeline band and the daily band share a single scrollLeft
   because they live in one scroll container. There is nothing to sync, so they
   cannot desync. "One map that slides" is now structural, not maintained.

   Vertical: the timeline band sits above the daily band; scrolling down moves
   from planning into execution. #dayHead (sticky-top) and #hourRail
   (sticky-left) pin themselves — the compositor does, for free, the work the
   old routeY()/touch handlers did on the main thread.

   The ONLY JS left here is unbounded-range edge extension, which reads one
   scrollLeft and (rarely) re-anchors it after prepending days. All panning is
   native: no wheel handlers, no touch handlers, no scroll-sync. The unified
   Pointer Events pipeline (next block) is now the sole JS input system.
   ════════════════════════════════════════════════════════════ */
const $scene = document.getElementById("scene");


/* dynamic range extension when scrolling near either horizontal edge */
let _extendT = null;
function scheduleExtend(){
  clearTimeout(_extendT);
  _extendT = setTimeout(()=>{ if(!UI.dragLive) maybeExtendRange(); }, 80);
}
$scene.addEventListener("scroll", () => { updateKW(); scheduleExtend();} , { passive:true });

/* day-snap on scrollend.
   The smooth scrollTo issued below is itself a scroll; if the user starts a
   new gesture mid-animation, the two fight and stutter. We track _snapping
   and abort the in-flight smooth scroll on the next user-initiated input
   (pointerdown or wheel). Re-issuing scrollTo at the current position is the
   standard way to cancel a smooth scroll. */
let _snapping = false;
const _cancelSnap = () => {
  if(!_snapping) return;
  _snapping = false;
  $scene.scrollTo({ left: $scene.scrollLeft, top: $scene.scrollTop });
};
$scene.addEventListener("pointerdown", _cancelSnap, { passive:true });
$scene.addEventListener("wheel",       _cancelSnap, { passive:true });

$scene.addEventListener("scrollend", () => {
  _snapping = false;                                  // any prior snap is now resolved
  if(UI.dragLive) return;
  const ppd = UI.dayPPD; if(!ppd) return;
  const target = Math.round($scene.scrollLeft / ppd) * ppd;
  if(Math.abs(target - $scene.scrollLeft) < 1) return;
  _snapping = true;
  $scene.scrollTo({ left: target, behavior: "smooth" });
}, { passive:true });

function maybeExtendRange(){
  const w = $scene.scrollLeft, max = $scene.scrollWidth - $scene.clientWidth;
  if(w < EDGE_BUFFER_PX){
    /* prepend EXTEND_DAYS — re-anchor scrollLeft so the view doesn't jump */
    UI.range.start = isoDate(addDays(parseISO(UI.range.start), -EXTEND_DAYS));
    UI.range.days += EXTEND_DAYS;
    renderAll();
    $scene.scrollLeft = w + EXTEND_DAYS * TL_PPD;
    return true;
  }
  if(max - w < EDGE_BUFFER_PX){
    UI.range.days += EXTEND_DAYS;
    renderAll();
    return true;
  }
  return false;
}

/* auto-landing: today, around the current hour.
   With one scroller the timeline and the day-grid can't both pin at once, so we
   land in the execution layer (the original behaviour) with the planning band
   one short scroll up. $dayWrap.offsetTop is the timeline band's height, i.e.
   the scrollTop at which #dayHead becomes pinned. */
function scrollToToday(animated){
  const i = dayIdx(todayISO());
  const x = Math.max(0, i*UI.dayPPD);
  const nowMin = new Date().getHours()*60 + new Date().getMinutes();
  const yHour  = clamp((nowMin - HOUR_START*60 - 90)/60*HOUR_PX, 0, GRID_H);
  const y = $dayWrap.offsetTop + yHour;       // past the timeline band, into the grid
  $scene.scrollTo({ left:x, top:y, behavior:animated?"smooth":"auto" });
}
