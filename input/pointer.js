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
  const min = snapMin(yToMin(y));
  return { x, y, day, min };
}
/* the day under the pointer: on the timeline view, or on the canvas's rail (the same drawing at the canvas's scale) */
function tlPos(e, inner = $tlInner){
  const r = inner.getBoundingClientRect(), rail = inner === $railInner;
  return clamp(Math.floor((e.clientX - r.left - (rail ? 0 : railW()))/(rail ? CANVAS_CELL : TL_PPD)), 0, UI.range.days-1);
}
function vibrate(ms){ if(navigator.vibrate) try{ navigator.vibrate(ms); }catch(_){} }

/* ---------- edge auto-pan (shared by every drag machine) ----------
   While a drag is live AND the pointer dwells inside the edge padding of the
   #scene viewport, scroll the scene and re-apply the drag at the (stationary)
   pointer so the item keeps extending past the visible cutout. Gated on
   UI.dragLive, so it can NEVER pan unless an edit is actually in progress. */
const PAN_ZONE = 48, PAN_MAX = 16, PAN_DWELL = 140, PAN_BOOST = 4, PAN_BOOST_MS = 3000;   // held longer at the edge, it speeds up to 4× (weeks, not days)
let _pan = null, _panRAF = 0;

function panSpeed(depth, heldMs){ const r = clamp(depth/PAN_ZONE, 0, 1); return PAN_MAX * r * r * (1 + (PAN_BOOST-1) * clamp(heldMs/PAN_BOOST_MS, 0, 1)); }
function panBind(apply, axes, x0, y0){ _pan = { apply, axes, x:x0, y:y0, zoneSince:0 }; $scene.classList.add("panning"); if(!_panRAF) _panRAF = requestAnimationFrame(panFrame); }
function panFollow(x, y){ if(_pan){ _pan.x = x; _pan.y = y; } }
function panRelease(){
  const panned = !!_pan;
  _pan = null; $scene.classList.remove("panning"); if(_panRAF){ cancelAnimationFrame(_panRAF); _panRAF = 0; }   // snapping resumes: the view settles on a day
  if(panned) scheduleExtend();   // a pan may have reached the end of the loaded days: load more now that the drag is over
}

function panFrame(){
  if(!_pan){ _panRAF = 0; return; }
  _panRAF = requestAnimationFrame(panFrame);
  if(!UI.dragLive){ _pan.zoneSince = 0; return; }
  const p = _pan, r = $scene.getBoundingClientRect();
  const dl = PAN_ZONE - (p.x - r.left), dr = PAN_ZONE - (r.right - p.x);
  if(dl <= 0 && dr <= 0){ p.zoneSince = 0; return; }
  if(!p.zoneSince) p.zoneSince = performance.now();
  const held = performance.now() - p.zoneSince - PAN_DWELL;
  if(held < 0) return;
  const dx = dl > 0 ? -panSpeed(dl, held) : panSpeed(dr, held);
  $scene.scrollLeft += dx;
  p.apply({ clientX: p.x, clientY: p.y });
}


/* ---------- one drag for every rectangle (Max, 20 Nov 2026) ----------
   Every item in every view is a rectangle in its view's units, { x, y, w, h }. Creating, moving and resizing are one
   interaction: press, a dashed ghost at the snapped target, commit on release. A view gives only its rules:
     at(e)   the pointer in its units, { x, y }: a day or a row is a cell (an edge goes past the cell under the
             pointer), a time is a line (an edge lands on it), as named by `cells` ("x", "xy" or "")
     rect    the thing ({ x, y, w, h }); creating: the press ({ x, y, w:0, h:0 })
     zone    "move" · the edges dragged ("l" "r" "t" "b", a corner is two) · "new" (from the press to the pointer)
     fix     the axes a new thing keeps from `rect` ("x": a new event stays in its day)
     min     its smallest size { w, h };  bounds  { y:[lo, hi] } it stays within (the day's hours)
     el      takes the pointer; dim: the thing, faded while it is dragged; layer: where the ghost is drawn;
             place(g, r): the ghost's pixels; color: its tint (a ghost wears its thing's colour)
     pan     the week's edge auto-pan, along x, when the drag can change x
     done(r, moved, g)  moved: the snapped rectangle changed. Not moved is a click. Return true to keep the ghost
             (it stays behind the editor until it closes: clearPreview).
   Mouse and pen start at once; touch after a hold (moving LONGPRESS, an edge RESIZE_HOLD; creating at once, as it was
   armed before). A cancel discards: the browser took the gesture (gesture-motion). Returns cancel(). */
function dragRect(e, o){
  const P0 = o.at(e), cell = a => (o.cells || "").includes(a) ? 1 : 0, min = o.min || {};
  const shape = P => {                                             // the rectangle for the pointer at P: the whole rule
    const r = { ...o.rect };
    for(const [a, s, n, lo, hi] of [["x", "x", "w", "l", "r"], ["y", "y", "h", "t", "b"]]){
      const end = o.rect[s] + o.rect[n], m = min[n] || 0;
      if(o.zone === "move") r[s] = o.rect[s] + P[a] - P0[a];
      else if(o.zone === "new"){ if(!(o.fix || "").includes(a)){ r[s] = Math.min(P0[a], P[a]); r[n] = Math.max(P0[a], P[a]) + cell(a) - r[s]; } }
      else if(o.zone.includes(lo)){ r[s] = Math.min(P[a], end - m); r[n] = end - r[s]; }
      else if(o.zone.includes(hi)) r[n] = Math.max(P[a] + cell(a), o.rect[s] + m) - o.rect[s];
      const b = (o.bounds || {})[a];
      if(b){ if(o.zone === "move") r[s] = clamp(r[s], b[0], b[1] - r[n]); else { const e2 = Math.min(r[s] + r[n], b[1]); r[s] = Math.max(r[s], b[0]); r[n] = e2 - r[s]; } }
    }
    return r;
  };
  const r0 = shape(P0), key = r => [r.x, r.y, r.w, r.h].join();
  let r = r0, moved = false, g = null, armed = e.pointerType === "mouse" || e.pointerType === "pen" || o.zone === "new";
  const arm = setTimeout(() => { armed = true; UI.dragLive = true; vibrate(12); }, armed ? 0 : o.zone === "move" ? LONGPRESS : RESIZE_HOLD);
  if(armed) UI.dragLive = true;
  o.el.setPointerCapture(e.pointerId);
  const move = m => {
    if(m.pointerId !== undefined && m.pointerId !== e.pointerId) return;
    if(!armed){ if(Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) > MOVE_THRESHOLD) end(false); return; }   // a scroll, not a hold
    panFollow(m.clientX, m.clientY);
    const n = shape(o.at(m));
    if(key(n) === key(r) && g) return;                             // the same snapped place: nothing to write
    r = n;
    if(!moved && key(r) === key(r0)) return;
    moved = true;
    if(!g){
      g = { el: document.createElement("div"), parts: [] };
      g.el.className = "ghost";
      if(o.color){ g.el.style.borderColor = o.color; g.el.style.background = o.color + "24"; }
      o.layer.append(g.el);
      if(o.dim) o.dim.classList.add("dragging");
    }
    o.place(g, r);
  };
  let over = false;
  const end = commit => {
    if(over) return; over = true;                                  // once: release, cancel or the view's cancel()
    clearTimeout(arm);
    try{ o.el.releasePointerCapture(e.pointerId); }catch(_){}
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
    panRelease();
    UI.dragLive = false;
    if(o.dim) o.dim.classList.remove("dragging");
    const keep = commit && o.done(r, moved, g);
    if(g && !keep) clearPreview(g);
  };
  const up = u => { if(u.pointerId === e.pointerId) end(true); };    // a touch released before its hold: a tap (not moved)
  const cancel = c => { if(c.pointerId === e.pointerId) end(false); };
  if(o.pan && (o.zone === "move" ? true : o.zone === "new" ? !(o.fix || "").includes("x") : /[lr]/.test(o.zone))) panBind(move, "x", e.clientX, e.clientY);
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
  return () => end(false);
}
/* a ghost and its parts (the day view's time labels) go: on release, or when the editor it stood behind closes */
function clearPreview(g){ if(g){ g.el.remove(); g.parts.forEach(p => p.remove()); } }
