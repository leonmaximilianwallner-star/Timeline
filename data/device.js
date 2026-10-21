// data/device.js — device state: what belongs to this screen, not to the plan. Never synced (RULEBOOK B.7).
"use strict";
/* ════════════════════════════════════════════════════════════
   theme       dark / light — chosen per device
   density     3 / 5 / 7 days across the day view — a phone wants fewer than a laptop
   openPhases  ids of phases whose dropdown is open on the timeline
   Changes here are not undoable and don't count as changes to the plan.
   ════════════════════════════════════════════════════════════ */
function loadDevice(){
  const fallback = { theme:"dark", density:5, openPhases:[] };
  try{
    const raw = localStorage.getItem(DEVICE_KEY);
    if(raw) return Object.assign(fallback, JSON.parse(raw));
  }catch(e){ console.warn("device load failed", e); }
  return fallback;
}
function saveDevice(){
  try{ localStorage.setItem(DEVICE_KEY, JSON.stringify(device)); }catch(e){ console.warn("device save failed", e); }
}
function setDevice(fn){
  fn(device);
  saveDevice();
  renderAll();
}
