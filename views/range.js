// views/range.js — which days are drawn, pixels per day. Moved unchanged from index.html lines 837–878 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   layout — recomputeRange(), lane packing, occurrence expansion
   ════════════════════════════════════════════════════════════ */
/* Time is unbounded — render a generous window around today plus any data
   outside it, and extend either edge when the user scrolls near it. */
const PAST_DAYS = 180, FUTURE_DAYS = 540;
const EDGE_BUFFER_PX = 600, EXTEND_DAYS = 180;

function recomputeRange(){
  let min = todayISO(), max = todayISO();
  const see = d => { if(d){ if(d<min) min=d; if(d>max) max=d; } };
  S.phases.forEach(p=>{ see(p.start); see(p.end); });
  S.exams.forEach(x=>see(x.date));
  S.events.forEach(e=>see(e.date));
  S.categories.forEach(c=>(c.milestones||[]).forEach(m=>see(m.date)));
  S.categories.forEach(c=>{ if(c.start && c.end){ see(c.start); see(c.end); } });

  /* never shrink an existing range — only widen it */
  let startISO = UI.range.start || isoDate(addDays(parseISO(todayISO()), -PAST_DAYS));
  const want = isoDate(addDays(parseISO(min), -14));
  if(want < startISO) startISO = want;
  const sd = parseISO(startISO);
  startISO = isoDate(addDays(sd, -((sd.getDay()+6)%7))); /* snap to Monday */

  let endISO = isoDate(addDays(parseISO(todayISO()), FUTURE_DAYS));
  const dataEnd = isoDate(addDays(parseISO(max), 35));
  if(dataEnd > endISO) endISO = dataEnd;
  if(UI.range.start){
    const prevEnd = isoDate(addDays(parseISO(UI.range.start), UI.range.days));
    if(prevEnd > endISO) endISO = prevEnd;
  }
  UI.range.start = startISO;
  UI.range.days  = diffDays(startISO, endISO);
}
const dayIdx  = d => diffDays(UI.range.start, d);
const idxDate = i => isoDate(addDays(parseISO(UI.range.start), i));
function dayPPD(){
  const vw = document.getElementById("scene").clientWidth || window.innerWidth;
  return Math.max(50, (vw - railW()) / device.density);
}
function railW(){ return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rail-w")) || 68; }

