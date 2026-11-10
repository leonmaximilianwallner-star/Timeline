// ui/canvas-morph.js — the motions between the week and the canvas: the timeline becomes the rail and back (Max, 10 Nov 2026).
"use strict";
document.documentElement.style.setProperty("--morph-ms", MORPH_MS + "ms");   // the labels' fades take the motion's length (styles/canvas.css)
/* The grammar of the Fokus motions (ui/focus-morph.js), one shared thing: the timeline.
   In:  the week sinks to the bottom of the screen; on its way its timeline closes up sideways to the canvas's scale
        and becomes the rail (the old copy fades over the first half, the rail in over the second, from 0.35);
        the canvas comes down with it, its floor on the timeline's top edge; the day view leaves.
   Out: the same, reversed (RULEBOOK C.5): the rail opens up sideways into the timeline as the week rises into place.
   Only transform and opacity move: the compositor runs it, nothing is laid out while it plays.
   Text keeps its shape (as in the Fokus motions): the shapes stretch, their labels don't. The leaving view's
   labels fade at once; the arriving view's appear once the shapes have nearly landed (styles/canvas.css).
   The rail lands open (the same rows as the timeline, so nothing is squeezed upright), then closes unless hovered. */

/* the week → the canvas, from a pull of `give` px (input/canvas-pull.js) */
function morphToCanvas(give = 0){
  const A = $views.clientHeight, floor = A - UI.canvas.railOpenH;
  const f = weekLeftDay(), k = CANVAS_CELL / TL_PPD;
  if(!UI.canvas.shown) showCanvas();
  canvasScrollToDay(f);
  const finish = () => {
    UI.canvas.active = true; UI.canvas.moving = false;
    $views.classList.remove("morphing", "to-canvas");
    document.documentElement.dataset.view = "canvas";
    [$scene, $canvasView, $tlWrap, $railInner].forEach(el => { el.style.transform = ""; el.style.transformOrigin = ""; });
    if(!UI.canvas.hover) openRail(false);
  };
  if(reducedMotion()){ finish(); return; }

  UI.canvas.moving = true;
  $views.classList.add("morphing", "to-canvas");                 // the week over the canvas, its ground clear (styles/canvas.css)
  [$scene, $canvasView].forEach(el => { el.style.transform = ""; });   // the animations take over from the pull's transforms
  const timing = { duration: MORPH_MS, easing: morphEase(), fill: "both" };
  $tlWrap.style.transformOrigin = `${$scene.scrollLeft + railW()}px 0`;   // the day at the left edge stays where it is
  $railInner.style.transformOrigin = `${f * CANVAS_CELL}px 0`;
  const anims = [
    $scene.animate([{ transform:`translateY(${give}px)` }, { transform:`translateY(${floor}px)` }], timing),
    $canvasView.animate([{ transform:`translateY(${give - floor}px)` }, { transform:"none" }], timing),
    $tlWrap.animate([{ transform:"none", opacity:1 }, { opacity:0, offset:0.5 }, { transform:`scaleX(${k})`, opacity:0 }], timing),
    $railInner.animate([{ transform:`scaleX(${1 / k})`, opacity:0 }, { opacity:0, offset:0.35 }, { transform:"none", opacity:1 }], timing),
    $dayWrap.animate([{ opacity:1 }, { opacity:0 }], { duration: MORPH_MS * MORPH_LEAVE, easing:"ease-out", fill:"both" }),
  ];
  morphDone(anims, finish);
}

/* the canvas → the week, from the rail as it is (open, maybe grown by a pull) */
function morphToWeek(){
  const A = $views.clientHeight, railTop = A - $rail.offsetHeight;
  const fc = canvasLeftDay(), fs = Math.round(fc), k = CANVAS_CELL / TL_PPD;
  UI.canvas.moving = true;
  /* the week, put in place under the motion: the canvas's day at the left edge (whole days: the week snaps to them), at its top */
  delete document.documentElement.dataset.view;
  $views.classList.add("morphing", "to-week");
  $scene.scrollTop = 0;
  $scene.scrollLeft = fs * TL_PPD;
  const finish = () => {
    UI.canvas.moving = false;
    $views.classList.remove("morphing", "to-week");
    [$scene, $canvasView, $tlWrap, $railInner].forEach(el => { el.style.transform = ""; el.style.transformOrigin = ""; });
    openRail(false); setRailHeight();
    hideCanvas();
  };
  if(reducedMotion()){ finish(); return; }

  const timing = { duration: MORPH_MS, easing: morphEase(), fill: "both" };
  $tlWrap.style.transformOrigin = `${$scene.scrollLeft + railW()}px 0`;
  $railInner.style.transformOrigin = `${fc * CANVAS_CELL}px 0`;
  const anims = [
    $scene.animate([{ transform:`translateY(${railTop}px)` }, { transform:"none" }], timing),
    $canvasView.animate([{ transform:"none" }, { transform:`translateY(${-railTop}px)` }], timing),
    $tlWrap.animate([{ transform:`translateX(${(fs - fc) * CANVAS_CELL}px) scaleX(${k})`, opacity:0 }, { opacity:0, offset:0.35 },
                     { transform:"none", opacity:1 }], timing),
    $railInner.animate([{ transform:"none", opacity:1 }, { opacity:0, offset:0.5 },
                        { transform:`translateX(${(fc - fs) * TL_PPD}px) scaleX(${1 / k})`, opacity:0 }], timing),
    $dayWrap.animate([{ opacity:0 }, { opacity:1 }], { duration: MORPH_MS - MORPH_ARRIVE, delay: MORPH_ARRIVE, easing: timing.easing, fill:"both" }),
  ];
  morphDone(anims, finish);
}
