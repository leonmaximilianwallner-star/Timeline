// ui/time-budget.js — time budget. Moved unchanged from index.html lines 2088–2135 on 21 Oct 2026.
"use strict";
/* ════════════════════════════════════════════════════════════
   budget — Zeitbudget donut (actual time per category, 7/30 days)
   fed by occurrences (incl. repeats), not by plans
   ════════════════════════════════════════════════════════════ */
function openBudget(){
  closeBudget();
  UI.budgetOpen = true;
  const ov = document.createElement("div"); ov.className="overlay"; ov.id="budgetPage";
  ov.innerHTML = `<div class="mcard"><div class="mhead"><h2>Zeitbudget</h2>
    <button class="cbtn small" id="bClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="mbody"><div class="seg" id="bSeg">
      <button data-d="7"  class="${UI.budgetDays===7?"on":""}">7 Tage</button>
      <button data-d="30" class="${UI.budgetDays===30?"on":""}">30 Tage</button></div>
      <div id="bBody"></div>
      <div class="thint">Gemessen wird tatsächlich verplante Zeit aus Terminen (inkl. Wiederholungen) — nicht Phasen oder Pläne.</div>
    </div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener("pointerdown", e=>{ if(e.target===ov) closeBudget(); });
  ov.querySelector("#bClose").onclick = closeBudget;
  ov.querySelectorAll("#bSeg button").forEach(b=>b.onclick=()=>{ UI.budgetDays=+b.dataset.d; openBudget(); });
  renderBudgetBody();
}
function closeBudget(){ const o=document.getElementById("budgetPage"); if(o) o.remove(); UI.budgetOpen=false; }
function renderBudgetBody(){
  const N = UI.budgetDays, to = todayISO(), from = isoDate(addDays(parseISO(to), -(N-1)));
  const sums = new Map();
  occurrencesIn(from, to).forEach(({ev})=>{
    sums.set(ev.categoryId, (sums.get(ev.categoryId)||0) + (ev.endMin - ev.startMin));
  });
  const total = [...sums.values()].reduce((a,b)=>a+b,0);
  const box = document.getElementById("bBody");
  if(!total){ box.innerHTML = `<div class="note" style="padding:14px 0">Keine Termine in den letzten ${N} Tagen. Lege Termine an — hier siehst du dann, wohin deine Zeit tatsächlich ging.</div>`; return; }
  const R=66, C=2*Math.PI*R; let off=0, segs="";
  [...sums.entries()].sort((a,b)=>b[1]-a[1]).forEach(([cid,min])=>{
    const frac = min/total, len = frac*C;
    segs += `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${cat(cid).color}" stroke-width="22"
      stroke-dasharray="${len-2} ${C-len+2}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`;
    off += len;
  });
  const hrs = m => (m/60).toFixed(m%60?1:0).replace(".",",")+" h";
  box.innerHTML = `<div class="donutWrap"><svg width="180" height="180" viewBox="0 0 180 180">${segs}
      <text class="donutCenter" x="90" y="88" text-anchor="middle">${hrs(total)}</text>
      <text class="donutSub" x="90" y="104" text-anchor="middle">${N} Tage</text></svg>
    <div class="legend">${[...sums.entries()].sort((a,b)=>b[1]-a[1]).map(([cid,min])=>
      `<div class="legRow"><span class="dot" style="background:${cat(cid).color}"></span>
       <span class="nm">${esc(cat(cid).name)}</span><span class="hrs">${hrs(min)} · ${Math.round(min/total*100)}%</span></div>`).join("")}</div></div>`;
}

