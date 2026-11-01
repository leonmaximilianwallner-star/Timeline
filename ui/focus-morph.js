// ui/focus-morph.js — from the event editor to the focus view in one motion: a container transform (Max, 1 Nov).
"use strict";
/* Every element of the editor either has a counterpart in Fokus, or it leaves; every element of Fokus either
   came from the editor, or it arrives (RULEBOOK C.5 "From the editor to Fokus"):
   - the container: the editor's squircle reshapes into the open event (two plates: its colour, its raised body);
   - shared elements travel along one path from where they were to where they land. The editor's copy fades
     out over the first half, Fokus's fades in over the second, so identical text reads as one thing moving;
   - what only the editor has (repeat, reminder, its buttons) fades out and sinks a little;
   - what only Fokus has (the week, the other events, free time) fades in and rises, staggered from the open event out.
   Measured in place: Fokus is built under the editor first, both are measured, then everything moves at once.
   Plain Web Animations (element.animate): every phone browser, no library. Tunables below. */
const MORPH_MS     = 460;          // the whole transform
const MORPH_LEAVE  = 0.3;          // the share of it over which the editor's own parts leave
const MORPH_ARRIVE = 140;          // ms before Fokus's own parts start to arrive
const MORPH_STAGGER = 180;         // ms: the farthest arriving part starts this much later than the nearest
const MORPH_RISE   = 16;           // px the arriving parts rise, and the leaving ones sink

/* editor → Fokus. The todo rows and the add row are paired by id below. */
const MORPH_PAIRS = [
  ["#fTitle",       ".focus-event.open .fe-title"],
  ["#editorKind",   ".focus-event.open .fe-cat"],
  [".when-big",     ".focus-event.open .fe-times"],
  ["#fLen",         ".focus-event.open .fe-when"],
  [".when-sub",     ".focus-title"],
  ["#editorFocus",  "#focusClose"],
  ["#editorBody .row.add", ".focus-event.open .fe-body .row.add"],
];
const MORPH_LEAVING = "#editorOverlay .editor-grip, #editorOverlay .editor-header .rbtn:not(#editorFocus), #editorOverlay .rbtn-gap, " +
  "#editorOverlay .kind-arrow, #editorBody > .list, #editorBody .part-head, #editorCarryHint";

function morphToFocus(day, eventId){
  const ov = document.getElementById("editorOverlay");
  if(!ov || matchMedia("(prefers-reduced-motion: reduce)").matches){ saveEditor(); openFocus(day, eventId); return; }
  saveEditor({ stay: true });                                   // the changes are kept, as with a tap outside; the editor stays for the motion
  const box = ov.querySelector(".editor"), body = ov.querySelector(".editor-body");
  const colour = getComputedStyle(box).backgroundColor, raised = getComputedStyle(body).backgroundColor;
  const ease = getComputedStyle(document.documentElement).getPropertyValue("--soft").trim() || "ease-out";
  const timing = { duration: MORPH_MS, easing: ease, fill: "both" };

  /* Fokus, built under the editor and measured; nothing of it shows yet */
  openFocus(day, eventId, { morph: true });
  const fv = document.querySelector(".focus-view"), opened = fv.querySelector(".focus-event.open");
  const rect = el => el.getBoundingClientRect();
  const radius = el => getComputedStyle(el).borderRadius;
  const pairs = MORPH_PAIRS.map(([a, b]) => [ov.querySelector(a), fv.querySelector(b)]);
  ov.querySelectorAll("#editorTodos .todoRow").forEach(r => pairs.push([r, opened && opened.querySelector(`.todoRow[data-tid="${r.dataset.tid}"]`)]));
  const shared = pairs.filter(([a, b]) => a && b);
  const anims = [];

  /* the container: two plates, from the editor's squircle and body to the open event and its body */
  const plates = opened ? [[box, opened, colour], [body, opened.querySelector(".fe-body"), raised]].map(([from, to, bg]) => {
    const p = document.createElement("div"), a = rect(from), b = rect(to);
    p.className = "morph-plate"; p.style.background = bg;
    fv.insertBefore(p, fv.querySelector(".focus-inner"));   // in order: the colour under the raised body
    anims.push(p.animate([
      { left:a.left+"px", top:a.top+"px", width:a.width+"px", height:a.height+"px", borderRadius: radius(from) },
      { left:b.left+"px", top:b.top+"px", width:b.width+"px", height:b.height+"px", borderRadius: radius(to) }], timing));
    return p;
  }) : [];
  fv.classList.add("morphing");                                  // the open event's own colours wait under the plates
  box.classList.add("morphing");                                 // the editor's surfaces give way to the plates

  /* shared elements: one path, two copies crossing over */
  shared.forEach(([a, b]) => {
    const ra = rect(a), rb = rect(b);
    const k = (parseFloat(getComputedStyle(b).fontSize) / parseFloat(getComputedStyle(a).fontSize)) || 1;   // text keeps its shape: one scale
    const there = `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px) scale(${k})`;
    const back  = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px) scale(${1 / k})`;
    a.style.transformOrigin = b.style.transformOrigin = "0 0";
    anims.push(a.animate([{ transform:"none", opacity:1 }, { opacity:0, offset:0.5 }, { transform:there, opacity:0 }], timing));
    anims.push(b.animate([{ transform:back, opacity:0 }, { opacity:0, offset:0.35 }, { transform:"none", opacity:1 }], timing));
  });

  /* the editor's own parts leave; the dim layer clears while Fokus's ground fills in */
  ov.querySelectorAll(MORPH_LEAVING).forEach(el => anims.push(el.animate(
    [{ opacity:1, transform:"none" }, { opacity:0, transform:`translateY(${MORPH_RISE / 2}px)` }],
    { duration: MORPH_MS * MORPH_LEAVE, easing:"ease-out", fill:"both" })));
  anims.push(ov.animate([{ backgroundColor: getComputedStyle(ov).backgroundColor }, { backgroundColor:"transparent" }], timing));
  anims.push(fv.animate([{ backgroundColor:"transparent" }, { backgroundColor: getComputedStyle(fv).backgroundColor }], { ...timing, duration: MORPH_MS * 0.7 }));

  /* Fokus's own parts arrive, the nearest to the open event first */
  const centre = opened ? rect(opened).top + rect(opened).height / 2 : innerHeight / 2;
  const arriving = [...fv.querySelectorAll(".focus-head .overline, .focus-pill, .focus-row")].flatMap(el =>
    opened && el.contains(opened) ? [el.querySelector(".focus-time")] : [el]);
  arriving.forEach(el => {
    const r = rect(el), far = Math.min(1, Math.abs(r.top + r.height / 2 - centre) / innerHeight);
    anims.push(el.animate([{ opacity:0, transform:`translateY(${MORPH_RISE}px)` }, { opacity:1, transform:"none" }],
      { duration: MORPH_MS - MORPH_ARRIVE, delay: MORPH_ARRIVE + far * MORPH_STAGGER, easing: ease, fill:"both" }));
  });

  Promise.all(anims.map(an => an.finished)).catch(()=>{}).finally(() => {
    plates.forEach(p => p.remove());
    fv.classList.remove("morphing");
    shared.forEach(([, b]) => { b.style.transformOrigin = ""; });
    anims.forEach(an => { try{ an.cancel(); }catch(_){} });      // every element back to its own style
    closeEditor(true);
  });
}
