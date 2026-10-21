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
  renderDays();
  renderTopdate();
  positionNowLine();
}

function renderTopdate(){
  document.getElementById("topdate").textContent = fmtDateLong(todayISO());
}

