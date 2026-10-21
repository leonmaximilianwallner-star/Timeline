// input/pointer.js — pointer helpers and edge auto-pan. Moved from index.html lines 1325–1374 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ════════════════════════════════════════════════════════════
   input — unified Pointer Events pipeline, drag machines
   one pipeline for mouse / touch / pen; branch on pointerType only
   ════════════════════════════════════════════════════════════ */
const MOVE_THRESHOLD = 5, LONGPRESS = 500, EDGE = 7, RESIZE_HOLD = 140;

/* single passive:false touchmove — suppresses native scroll while a drag is live */
window.addEventListener("touchmove", e=>{ if(UI.dragLive) e.preventDefault(); }, { passive:false });

function gridPos(e){
  const g = document.getElementById("dayGrid").getBoundingClientRect();
  const x = e.clientX - g.left, y = e.clientY - g.top;
  const day = clamp(Math.floor(x / UI.dayPPD), 0, UI.range.days-1);
  const min = snapMin(HOUR_START*60 + y/HOUR_PX*60);
  return { x, y, day, min };
}
function tlPos(e){
  const r = $tlInner.getBoundingClientRect();
  return clamp(Math.floor((e.clientX - r.left - railW())/TL_PPD), 0, UI.range.days-1);
}
function vibrate(ms){ if(navigator.vibrate) try{ navigator.vibrate(ms); }catch(_){} }

/* ---------- edge auto-pan (shared by every drag machine) ----------
   While a drag is live AND the pointer dwells inside the edge padding of the
   #scene viewport, scroll the scene and re-apply the drag at the (stationary)
   pointer so the item keeps extending past the visible cutout. Gated on
   UI.dragLive, so it can NEVER pan unless an edit is actually in progress. */
const PAN_ZONE = 48, PAN_MAX = 16, PAN_DWELL = 140;
let _pan = null, _panRAF = 0;

function panSpeed(depth){ const r = clamp(depth/PAN_ZONE, 0, 1); return PAN_MAX * r * r; }
function panBind(apply, axes, x0, y0){ _pan = { apply, axes, x:x0, y:y0, zoneSince:0 }; if(!_panRAF) _panRAF = requestAnimationFrame(panFrame); }
function panFollow(x, y){ if(_pan){ _pan.x = x; _pan.y = y; } }
function panRelease(){ _pan = null; if(_panRAF){ cancelAnimationFrame(_panRAF); _panRAF = 0; } }

function panFrame(){
  if(!_pan){ _panRAF = 0; return; }
  _panRAF = requestAnimationFrame(panFrame);
  if(!UI.dragLive){ _pan.zoneSince = 0; return; }
  const p = _pan, r = $scene.getBoundingClientRect();
  let dx = 0;
  const dl = PAN_ZONE - (p.x - r.left), dr = PAN_ZONE - (r.right - p.x);
  if(dl > 0) dx = -panSpeed(dl); else if(dr > 0) dx = panSpeed(dr);
  if(!dx){ p.zoneSince = 0; return; }
  if(!p.zoneSince) p.zoneSince = performance.now();
  if(performance.now() - p.zoneSince < PAN_DWELL) return;
  $scene.scrollLeft += dx;
  p.apply({ clientX: p.x, clientY: p.y });
}

