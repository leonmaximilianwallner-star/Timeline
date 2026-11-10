// views/render-all.js — draws everything (renderAll). Moved unchanged from index.html lines 930–953 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   render — renderAll() and all sub-renderers
   ════════════════════════════════════════════════════════════ */
const $tlWrap  = document.getElementById("tlWrap");
const $tlInner = document.getElementById("tlInner");
const $dayWrap = document.getElementById("dayWrap");
const $dayInner= document.getElementById("dayInner");

function renderAll(){
  document.documentElement.dataset.theme = device.theme;
  recomputeRange();
  TL_PPD = dayPPD();                       // same grid in both views
  $tlInner.style.paddingLeft = railW()+"px";
  document.documentElement.style.setProperty("--tl-ppd", TL_PPD+"px");
  renderTimeline();
  renderCanvas();                          // the canvas's grid and rail, while it is shown (views/canvas/render.js)
  renderDays();
  renderTopdate();
  positionNowLine();
  showRecording();
  renderFocus();                           // the focus view, if open (views/focus/render.js), redraws with the plan                         // the add button's recording sign (ui/recording.js): another device may have started or stopped one
}

function renderTopdate(){
  document.getElementById("topdate").textContent = fmtDateLong(todayISO());
}

