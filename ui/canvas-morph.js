// ui/canvas-morph.js — the motions between the week and the canvas: the timeline becomes the rail and back (Max, 10 Nov 2026).
"use strict";
/* A cover, not a show (Max, 10 Nov: "never longer than a button", "like a magic trick"):
   In:  the timeline band sinks to the bottom of the screen and closes up sideways into the rail (the band fades over
        the first half, the rail in over the second); the canvas comes down with it, its floor on the band's top edge;
        the day view fades. Out: the same, reversed (RULEBOOK C.5).
   Cheap by construction (measured, 10 Nov): only the timeline band, the canvas and the rail move, and the day view
   fades. The week's scroller never moves: moving it repaints all of it (a 117 ms stall at 4× slower CPU).
   Only transform and opacity: the compositor runs it. Text keeps its shape: labels fade out, the shapes travel,
   the rail's labels fade back in as it lands (styles/canvas.css). */
const SWITCH_MS = 280;         // the whole switch: about the length of any view change

const switchTiming = () => ({ duration: SWITCH_MS, easing: morphEase(), fill: "both" });
function switchDone(anims, cls, then){
  $views.classList.add(cls);
  UI.canvas.moving = true;
  morphDone(anims, () => {
    [$tlWrap, $canvasView, $railInner].forEach(el => { el.style.transform = ""; el.style.transformOrigin = ""; });
    $views.classList.remove(cls);
    UI.canvas.moving = false;
    then();
  });
}

/* the week → the canvas, from a pull of `give` px (input/canvas-pull.js) */
function morphToCanvas(give = 0){
  const floor = $views.clientHeight - UI.canvas.railOpenH;       // where the rail's top lands
  const f = weekLeftDay(), k = CANVAS_CELL / TL_PPD;
  if(!UI.canvas.shown) showCanvas();
  canvasScrollToDay(f);
  const land = () => {
    UI.canvas.active = true;
    document.documentElement.dataset.view = "canvas";
    if(!UI.canvas.hover) openRail(false);
  };
  if(reducedMotion()){ $tlWrap.style.transform = $canvasView.style.transform = ""; land(); return; }
  const t = switchTiming();
  $tlWrap.style.transformOrigin = `${$scene.scrollLeft + railW()}px 0`;   // the day at the left edge stays where it is
  $railInner.style.transformOrigin = `${f * CANVAS_CELL}px 0`;
  switchDone([
    $tlWrap.animate([{ transform:`translateY(${give}px)`, opacity:1 }, { opacity:0, offset:0.5 },
                     { transform:`translateY(${floor}px) scaleX(${k})`, opacity:0 }], t),
    $canvasView.animate([{ transform:`translateY(${give - floor}px)` }, { transform:"none" }], t),
    $railInner.animate([{ transform:`scaleX(${1 / k})`, opacity:0 }, { opacity:0, offset:0.35 }, { transform:"none", opacity:1 }], t),
    $dayWrap.animate([{ opacity:1 }, { opacity:0 }], { ...t, duration: SWITCH_MS * 0.5 }),
  ], "to-canvas", land);
}

/* the canvas → the week, from the rail as it is (open, maybe grown by a pull) */
function morphToWeek(){
  const top = $views.clientHeight - $rail.offsetHeight;           // where the rail's top is now
  const fc = canvasLeftDay(), fs = Math.round(fc), k = CANVAS_CELL / TL_PPD;
  /* the week, put in place under the motion: the canvas's day at the left edge (whole days: it snaps to them), at its top */
  $scene.scrollTop = 0;
  $scene.scrollLeft = fs * TL_PPD;
  const land = () => { openRail(false, true); setRailHeight(); hideCanvas(); };
  if(reducedMotion()){ delete document.documentElement.dataset.view; land(); return; }
  const t = switchTiming();
  $tlWrap.style.transformOrigin = `${$scene.scrollLeft + railW()}px 0`;
  $railInner.style.transformOrigin = `${fc * CANVAS_CELL}px 0`;
  const anims = [
    $tlWrap.animate([{ transform:`translateY(${top}px) translateX(${(fs - fc) * CANVAS_CELL}px) scaleX(${k})`, opacity:0 },
                     { opacity:0, offset:0.35 }, { transform:"none", opacity:1 }], t),
    $canvasView.animate([{ transform:"none" }, { transform:`translateY(${-top}px)` }], t),
    $railInner.animate([{ transform:"none", opacity:1 }, { opacity:0, offset:0.5 },
                        { transform:`translateX(${(fc - fs) * TL_PPD}px) scaleX(${1 / k})`, opacity:0 }], t),
    $dayWrap.animate([{ opacity:0 }, { opacity:0, offset:0.3 }, { opacity:1 }], t),
  ];
  delete document.documentElement.dataset.view;                    // the week over the canvas again; its parts start unseen (fill)
  switchDone(anims, "to-week", land);
}
