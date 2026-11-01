// ui/focus-morph.js — the motions into and out of the focus view: container transforms (Max, 1 Nov).
"use strict";
/* Two motions, one grammar (RULEBOOK C.5): every element either travels, leaves or arrives.
   - the container: a squircle reshapes into its counterpart (drawn by plates that carry its colours);
   - shared elements travel along one path. The old copy fades out over the first half, the new one fades in
     over the second, so identical text reads as one thing moving;
   - what only the old view has fades out and sinks a little; what only the new one has fades in and rises,
     the nearest to the centre of the motion first.
   In:  the event editor → Fokus (morphToFocus). Out: Fokus → the week (morphFromFocus).
   Measured in place: the new view is put in place under the old one, both are measured, then everything moves
   at once. Plain Web Animations (element.animate): every phone browser, no library. Tunables below. */
const MORPH_MS      = 460;         // the whole transform
const MORPH_ROUND   = 0.4;         // the share of it over which corners take their new shape (a squircle doesn't wait)
const MORPH_LEAVE   = 0.3;         // the share of it over which the old view's own parts leave
const MORPH_ARRIVE  = 140;         // ms before the new view's own parts start to arrive
const MORPH_STAGGER = 180;         // ms: the farthest arriving part starts this much later than the nearest
const MORPH_RISE    = 16;          // px the arriving parts rise, and the leaving ones sink

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const morphEase = () => getComputedStyle(document.documentElement).getPropertyValue("--soft").trim() || "ease-out";
const rectOf = el => el.getBoundingClientRect();

/* the parts of a motion; each returns its animations */
function morphPlate(layer, from, to, bgFrom, bgTo, timing){
  const p = document.createElement("div"), a = rectOf(from), b = rectOf(to);
  p.className = "morph-plate";
  layer.insertBefore(p, layer.querySelector(".focus-inner"));   // in order: later plates over earlier ones, all under the content
  const r = el => getComputedStyle(el).borderRadius;
  return [p, [
    p.animate([{ left:a.left+"px", top:a.top+"px", width:a.width+"px", height:a.height+"px", backgroundColor:bgFrom },
               { left:b.left+"px", top:b.top+"px", width:b.width+"px", height:b.height+"px", backgroundColor:bgTo }], timing),
    p.animate([{ borderRadius:r(from) }, { borderRadius:r(to) }], { ...timing, duration: timing.duration * MORPH_ROUND }),
  ]];
}
function morphTravel(a, b, timing){
  const ra = rectOf(a), rb = rectOf(b);
  const k = (parseFloat(getComputedStyle(b).fontSize) / parseFloat(getComputedStyle(a).fontSize)) || 1;   // text keeps its shape: one scale
  a.style.transformOrigin = b.style.transformOrigin = "0 0";
  return [
    a.animate([{ transform:"none", opacity:1 }, { opacity:0, offset:0.5 },
               { transform:`translate(${rb.left - ra.left}px, ${rb.top - ra.top}px) scale(${k})`, opacity:0 }], timing),
    b.animate([{ transform:`translate(${ra.left - rb.left}px, ${ra.top - rb.top}px) scale(${1 / k})`, opacity:0 }, { opacity:0, offset:0.35 },
               { transform:"none", opacity:1 }], timing),
  ];
}
function morphLeave(els){
  return [...els].map(el => el.animate([{ opacity:1, transform:"none" }, { opacity:0, transform:`translateY(${MORPH_RISE / 2}px)` }],
    { duration: MORPH_MS * MORPH_LEAVE, easing:"ease-out", fill:"both" }));
}
function morphArrive(els, centre, ease){
  return [...els].map(el => {
    const r = rectOf(el), far = Math.min(1, Math.abs(r.top + r.height / 2 - centre) / innerHeight);
    return el.animate([{ opacity:0, transform:`translateY(${MORPH_RISE}px)` }, { opacity:1, transform:"none" }],
      { duration: MORPH_MS - MORPH_ARRIVE, delay: MORPH_ARRIVE + far * MORPH_STAGGER, easing: ease, fill:"both" });
  });
}
function morphDone(anims, then){
  Promise.all(anims.map(an => an.finished)).catch(()=>{}).finally(() => {
    anims.forEach(an => { try{ an.cancel(); }catch(_){} });      // every element back to its own style
    then();
  });
}

/* ── in: the event editor → Fokus ─────────────────────────────── */
const MORPH_IN_PAIRS = [
  ["#fTitle",       ".focus-event.open .fe-title"],
  ["#editorKind",   ".focus-event.open .fe-cat"],
  [".when-big",     ".focus-event.open .fe-times"],
  ["#fLen",         ".focus-event.open .fe-when"],
  [".when-sub",     ".focus-title"],
  ["#editorFocus",  "#focusClose"],
  ["#editorBody .row.add", ".focus-event.open .fe-body .row.add"],
];
const MORPH_IN_LEAVING = "#editorOverlay .editor-grip, #editorOverlay .editor-header .rbtn:not(#editorFocus), #editorOverlay .rbtn-gap, " +
  "#editorOverlay .kind-arrow, #editorBody > .list, #editorBody .part-head, #editorCarryHint";

function morphToFocus(day, eventId){
  const ov = document.getElementById("editorOverlay");
  if(!ov || reducedMotion()){ saveEditor(); openFocus(day, eventId); return; }
  saveEditor({ stay: true });                                   // the changes are kept, as with a tap outside; the editor stays for the motion
  const box = ov.querySelector(".editor"), body = ov.querySelector(".editor-body");
  const colour = getComputedStyle(box).backgroundColor, raised = getComputedStyle(body).backgroundColor;
  const ease = morphEase(), timing = { duration: MORPH_MS, easing: ease, fill: "both" };

  openFocus(day, eventId, { morph: true });                     // built under the editor and measured; nothing of it shows yet
  const fv = document.querySelector(".focus-view"), opened = fv.querySelector(".focus-event.open");
  const pairs = MORPH_IN_PAIRS.map(([a, b]) => [ov.querySelector(a), fv.querySelector(b)]);
  ov.querySelectorAll("#editorTodos .todoRow").forEach(r => pairs.push([r, opened && opened.querySelector(`.todoRow[data-tid="${r.dataset.tid}"]`)]));
  const shared = pairs.filter(([a, b]) => a && b), anims = [], plates = [];

  if(opened) [[box, opened, colour], [body, opened.querySelector(".fe-body"), raised]].forEach(([from, to, bg]) => {
    const [p, a] = morphPlate(fv, from, to, bg, bg, timing); plates.push(p); anims.push(...a);
  });
  fv.classList.add("morphing");                                  // the open event's own colours wait under the plates
  box.classList.add("morphing");                                 // the editor's surfaces give way to the plates
  shared.forEach(([a, b]) => anims.push(...morphTravel(a, b, timing)));
  anims.push(...morphLeave(ov.querySelectorAll(MORPH_IN_LEAVING)));
  anims.push(ov.animate([{ backgroundColor: getComputedStyle(ov).backgroundColor }, { backgroundColor:"transparent" }], timing));
  anims.push(fv.animate([{ backgroundColor:"transparent" }, { backgroundColor: getComputedStyle(fv).backgroundColor }], { ...timing, duration: MORPH_MS * 0.7 }));
  const centre = opened ? rectOf(opened).top + rectOf(opened).height / 2 : innerHeight / 2;
  anims.push(...morphArrive([...fv.querySelectorAll(".focus-head .overline, .focus-pill, .focus-row")].flatMap(el =>
    opened && el.contains(opened) ? [el.querySelector(".focus-time")] : [el]), centre, ease));

  morphDone(anims, () => {
    plates.forEach(p => p.remove());
    fv.classList.remove("morphing");
    shared.forEach(([, b]) => { b.style.transformOrigin = ""; });
    closeEditor(true);
  });
}

/* ── out: Fokus → the week ─────────────────────────────────────── */
/* fv: the focus layer, already closed for the app (closeFocus). The week is put in place under it first:
   scrolled to that day, at the open event's hour, so the events have somewhere to land. */
function morphFromFocus(fv, day, openId){
  const ease = morphEase(), timing = { duration: MORPH_MS, easing: ease, fill: "both" };
  const i = dayIdx(day), ev = S.events.find(x => x.id === openId);
  if(i >= 0 && i < UI.range.days){
    UI.dragLive = true;                                          // no range extension or redraw under the motion (views/viewport.js)
    $scene.scrollTo({ left: i * UI.dayPPD, top: $dayWrap.offsetTop + clamp(minToY(Math.max(0, (ev ? ev.startMin : 8*60) - 60)), 0, gridHeight()), behavior:"auto" });
  }
  const grid = document.getElementById("dayGrid"), head = document.getElementById("dayHead");
  const anims = [], plates = [], shared = [], landed = new Set(), cleared = [];
  /* a target counts only where it can be seen: below the day header, on the screen; the rest leaves or arrives */
  const below = head ? rectOf(head).bottom : 0;
  const inView = el => { const r = rectOf(el); return r.width > 0 && r.top >= below && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; };
  const shown = el => el && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden" && rectOf(el).width > 0;

  /* each event: its squircle reshapes into the event in the grid; its title (and the open one's time) travel */
  fv.querySelectorAll(".focus-event").forEach(el => {
    const id = el.dataset.ev || el.dataset.open;
    const to = grid && grid.querySelector(`.event[data-ev="${id}"][data-date="${day}"]`);
    if(!to || !inView(to)) return;
    landed.add(el); landed.add(to);
    const [p, a] = morphPlate(fv, el, to, getComputedStyle(el).backgroundColor, getComputedStyle(to).backgroundColor, timing);
    plates.push(p); anims.push(...a);
    cleared.push([to, to.style.background]); to.style.background = "transparent";   // the plate carries its colour until it lands
    [[".fe-title", ".et"], [".fe-times", ".em"]].forEach(([a, b]) => { const x = el.querySelector(a), y = to.querySelector(b); if(x && y) shared.push([x, y]); });
    anims.push(...morphArrive(to.querySelectorAll(".badge, .marks"), rectOf(to).top, ease));
  });
  /* the week: each pill's weekday and date travel into the day header; the date into the app's header */
  fv.querySelectorAll(".focus-pill").forEach(pill => {
    const cell = head && head.querySelector(`.dh[data-day="${pill.dataset.day}"]`);
    if(!shown(cell) || rectOf(cell).right > innerWidth) return;
    [[".fp-wd", ".dw"], [".fp-dn", ".dn"]].forEach(([a, b]) => shared.push([pill.querySelector(a), cell.querySelector(b)]));
  });
  const top = document.getElementById("topdate");
  if(shown(top) && parseFloat(getComputedStyle(top).opacity) > 0) shared.push([fv.querySelector(".focus-title"), top]);

  fv.classList.add("morphing", "morphing-out");
  shared.forEach(([a, b]) => anims.push(...morphTravel(a, b, timing)));
  /* Fokus's own parts leave; its ground clears and the week shows; the week's other events arrive */
  const travels = new Set(shared.map(([a]) => a));             // what has no place in the week leaves, like the rest of Fokus
  anims.push(...morphLeave([...fv.querySelectorAll(".focus-title, .fp-wd, .fp-dn")].filter(el => !travels.has(el))));
  anims.push(...morphLeave(fv.querySelectorAll(".focus-head .overline, #focusClose, .focus-time, .focus-gap, .fe-body, .fe-when, .fe-cat, .fe-dot, .fe-meta, .fp-dots")));
  anims.push(...[...fv.querySelectorAll(".focus-event")].filter(el => !landed.has(el)).flatMap(el => morphLeave([el])));
  fv.querySelectorAll(".focus-pill").forEach(p => anims.push(p.animate([{ backgroundColor: getComputedStyle(p).backgroundColor }, { backgroundColor:"transparent" }],
    { duration: MORPH_MS * MORPH_LEAVE, easing:"ease-out", fill:"both" })));
  anims.push(fv.animate([{ backgroundColor: getComputedStyle(fv).backgroundColor }, { backgroundColor:"transparent" }], { ...timing, duration: MORPH_MS * 0.7 }));
  const centre = plates.length ? rectOf(plates[0]).top : innerHeight / 2;
  if(grid) anims.push(...morphArrive([...grid.querySelectorAll(".event")].filter(el => !landed.has(el) && rectOf(el).bottom > below && rectOf(el).top < innerHeight), centre, ease));

  morphDone(anims, () => {
    cleared.forEach(([el, bg]) => { el.style.background = bg; });
    shared.forEach(([, b]) => { b.style.transformOrigin = ""; });
    UI.dragLive = false;
    fv.remove();
  });
}
