// views/timeline/render.js — draws the timeline view. Moved from index.html lines 954–1082 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- timeline view ---------- */
/* the timeline view's drawing, at any scale: the week's (ppd) and the canvas's rail (CANVAS_CELL).
   One rule for both, not a copy (RULEBOOK B.4). The rail draws no dropdowns and no hover line. */
function buildTimeline(ppd, rail){
  const frag = document.createElement("div");
  frag.style.width = dayX(UI.range.days); frag.style.position = "relative";

  /* month labels */
  const mrow = document.createElement("div"); if(!rail) mrow.id = "monthRow"; mrow.className="tlRow month-row";
  let i = 0;
  while(i < UI.range.days){
    const d0 = parseISO(idxDate(i));
    const monthEnd = new Date(d0.getFullYear(), d0.getMonth()+1, 1);
    const span = Math.min(UI.range.days - i, Math.round((monthEnd - d0)/DAY_MS));
    const el = document.createElement("div");
    el.className = "monthSpan"; el.style.width = dayX(span);
    el.innerHTML = `<span class="monthLabel">${MONTHS[d0.getMonth()]}${d0.getMonth()===0?" "+d0.getFullYear():""}</span>`;
    mrow.appendChild(el); i += span;
  }
  frag.appendChild(mrow);

  /* per-project: spine + milestones, then its phase lanes */
  /* per-project (dated category): spine bounded by start..end, then its phase lanes */
  S.categories.filter(c=>c.start && c.end).forEach(p=>{
    const row = document.createElement("div"); row.className = "tlRow projRow";
    const x = dayX(dayIdx(p.start));
    const w = `max(26px, ${dayX(diffDays(p.start, p.end))})`;
    const spine = document.createElement("div"); spine.className = "projSpine colored";
    spine.style.left = x; spine.style.width = w; spine.style.background = p.color;
    row.appendChild(spine);
    const lw = document.createElement("div"); lw.className="projLabelWrap";
    lw.style.left = x; lw.style.width = w;
    lw.innerHTML = `<span class="projLabel" data-edit-project="${p.id}" style="color:${p.color}">${esc(p.name)}</span>`;
    row.appendChild(lw);
    S.milestones.filter(m=>m.categoryId===p.id).sort((a,b)=>a.date<b.date?-1:1).forEach(m=>{
      const mx = dayX(dayIdx(m.date)+.5);
      const dot = document.createElement("div");
      dot.className = "milestone-dot"+(m.final?" final":"");
      dot.style.left = mx;
      dot.dataset.editMilestone = m.id;
      dot.title = m.title;
      dot.innerHTML = `<span class="milestone-label">${m.final?"★ ":""}${esc(m.title)}</span>`;
      row.appendChild(dot);
    });
    frag.appendChild(row);
    appendPhaseLanes(frag, S.phases.filter(ph=>ph.categoryId===p.id), ppd, rail);
  });

  /* ungrouped: phases tagged with a dateless category, or untagged (frei → grey) */
  const datedIds = new Set(S.categories.filter(c=>c.start && c.end).map(c=>c.id));
  appendPhaseLanes(frag, S.phases.filter(ph=>!ph.categoryId || !datedIds.has(ph.categoryId)), ppd, rail);

  /* milestone chips: every milestone not on a project's spine.
     Colour: its category's; without one, red as before, until colour/category is decided (RULEBOOK B.8). */
  const xr = document.createElement("div"); xr.className="tlRow milestone-row"; if(!rail) xr.id="milestoneRow";
  S.milestones.filter(m=>!datedIds.has(m.categoryId)).forEach(m=>{
    const el = document.createElement("div");
    el.className = "milestone-chip"; el.style.left = dayX(dayIdx(m.date)+.5);
    el.style.background = m.categoryId ? cat(m.categoryId).color : "var(--c-red)";
    el.dataset.editMilestone = m.id;
    el.innerHTML = `<span class="chip-title">${esc(m.title)}</span><span class="chip-note">${esc(m.note||"")}</span>`;
    xr.appendChild(el);
  });
  frag.appendChild(xr);

  /* today line + overlays */
  const tl = document.createElement("div"); tl.className="todayLine";
  tl.style.left = dayX(dayIdx(todayISO())+.5); frag.appendChild(tl);
  if(rail) return frag;
  const hov = document.createElement("div"); hov.className="tlHover"; hov.id="tlHover"; frag.appendChild(hov);

  const tlg = document.createElement("div"); tlg.id="tlGrid";
  frag.insertBefore(tlg, frag.firstChild);
  return frag;
}
function renderTimeline(){
  const frag = buildTimeline(TL_PPD, false);
  $tlInner.replaceChildren(frag);
  $tlInner.style.width = dayX(UI.range.days, railW());
  fitLabels(frag);
}


function appendPhaseLanes(frag, phases, ppd, rail){
  if(!phases.length) return;
  const { count: nLanes, laneOf } = packLanes(phases);
  /* group phases by their packed lane so each lane row owns its own phase dropdown rows */
  const byLane = Array.from({length:nLanes}, ()=>[]);
  phases.forEach(ph => byLane[laneOf.get(ph)].push(ph));

  for(let l = 0; l < nLanes; l++){
    const r = document.createElement("div"); r.className = "tlRow laneRow";
    frag.appendChild(r);

    byLane[l].forEach(ph => {
      const w = Math.max(diffDays(ph.start, ph.end)*ppd, 26);       // at this scale: what fits on the pill
      const color = cat(ph.categoryId).color, { done, total } = phaseProgress(S, ph), isOpen = device.openPhases.includes(ph.id);
      const noDay = stepsOf(S, ph).filter(st => !stepHasEvents(S, st)).length;   // steps not yet on a day
      const el = document.createElement("div");
      el.className = "phase" + (total && done === total ? " done" : "") + (isOpen ? " open" : "");
      el.style.left = dayX(dayIdx(ph.start)); el.style.width = `max(26px, ${dayX(diffDays(ph.start, ph.end))})`;
      el.style.background = washOf(color); el.style.borderColor = color;   // the pill is its wash; the fill is its progress
      el.dataset.phase = ph.id;
      el.innerHTML =
        `<span class="ph-fill" style="width:${total ? done / total * 100 : 0}%;background:${color}"></span>`+
        `<span class="ph-stick"><span class="ph-label">${esc(ph.title)}</span>`+
        `<button class="ph-exp" data-expand="${ph.id}" aria-expanded="${isOpen}" title="Fahrplan">${CHEVRON}</button></span>`+
        (total && w >= 90 ? `<span class="ph-count">${done}/${total}${noDay ? ` · ${noDay} ohne Tag` : ""}</span>` : "")+
        `<span class="ph-handle l" data-rez="l"></span><span class="ph-handle r" data-rez="r"></span>`;
      r.appendChild(el);
    });

    if(rail) continue;                                 // the rail has no dropdowns
    /* the open phase's plan, right under its lane: one cell per day of the phase, on the day columns
       (Max, 10 Nov, "Fahrplan"). Plans that don't overlap sideways share a row (21 Oct) */
    const rows = [];
    byLane[l].filter(ph => device.openPhases.includes(ph.id))
      .sort((a,b) => a.start < b.start ? -1 : 1)
      .forEach(ph => {
        const x = dayIdx(ph.start)*ppd, n = diffDays(ph.start, ph.end);
        let row = rows.find(r => r.right <= x);
        if(!row){
          row = { right: 0, el: document.createElement("div") };
          row.el.className = "tlRow dropdown-row";
          rows.push(row); frag.appendChild(row.el);
        }
        row.right = x + n*ppd;
        const anchor = document.createElement("div"); anchor.className="dropdown-anchor";
        anchor.style.marginLeft = dayX(dayIdx(ph.start));
        const bb = document.createElement("div");
        bb.className = "dropdown plan" + (UI.dropdownOpening===ph.id ? " opening" : "");   // only the one just opened animates
        bb.dataset.dropdown = ph.id;
        bb.innerHTML = planHTML(ph, n, ppd);
        anchor.appendChild(bb); row.el.appendChild(anchor);
      });
  }
}

const CHEVRON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
const PLAN_TODOS = 3;          // open todos shown per event in a cell; the rest is "+n"

/* what falls on which day of a phase: every event under it (straight, or through a step) on that day, by time.
   A head: the step's name (or the event's), done/total of its todos. Past days: heads only, muted.
   Today and later: then its open todos, at most PLAN_TODOS. Done todos never show (the count covers them). */
function planHTML(ph, n, ppd){
  const today = todayISO(), byDay = {};
  [...phaseOccurrences(S, ph), ...stepsOf(S, ph).flatMap(st => stepOccurrences(S, st))]
    .forEach(o => (byDay[o.day] = byDay[o.day] || []).push(o));
  const cells = [];
  for(let i = 0; i < n; i++){
    const d = addDays(parseISO(ph.start), i), day = isoDate(d), past = day < today, rows = [];
    (byDay[day] || []).sort((a, b) => a.ev.startMin - b.ev.startMin).forEach(({ ev }) => {
      const step = ev.parentId !== ph.id && S.steps.find(s => s.id === ev.parentId);
      const all = todosOf(ev, day), counted = all.filter(t => t.state !== "cancelled"), done = eventDone(ev, day);
      rows.push(`<button type="button" class="prow head${past || done ? " muted" : ""}" data-open-event="${ev.id}" data-day="${day}">`+
        `${done ? `<span class="tick">✓</span>` : ""}<span class="prow-text">${esc(step ? step.title : ev.title)}</span>`+
        `<span class="prow-meta">${counted.length ? `${counted.filter(t => t.state === "done").length}/${counted.length}` : ""}</span></button>`);
      if(past) return;
      const open = all.filter(t => t.state === "open");
      open.slice(0, PLAN_TODOS).forEach(t => rows.push(`<div class="prow"><button type="button" class="ring" title="Erledigt" `+
        `data-tick-todo="${t.id}" data-ev="${ev.id}" data-day="${day}"></button><span class="prow-text">${esc(t.text)}</span></div>`));
      if(open.length > PLAN_TODOS) rows.push(`<div class="prow more">+${open.length - PLAN_TODOS}</div>`);
    });
    cells.push({ weekend: d.getDay() === 0 || d.getDay() === 6, rows });
  }
  const h = Math.max(32, 12 + 20 * Math.max(0, ...cells.map(c => c.rows.length)));
  return cells.map(c => `<div class="plan-day${c.weekend ? " weekend" : ""}" style="width:var(--ppd);height:${h}px">${c.rows.join("")}</div>`).join("");
}

/* shrink label font before ever compromising the pill — never the radius */
function fitLabels(scope){
  scope.querySelectorAll(".phase .ph-label").forEach(lab=>{
    const phaseEl = lab.parentElement;
    const avail = phaseEl.clientWidth - 30;
    lab.style.fontSize = "";
    if(lab.scrollWidth > avail) lab.style.fontSize = "11px";
    if(lab.scrollWidth > avail) lab.style.fontSize = "10px";
    if(lab.scrollWidth > avail && avail < 40) lab.style.visibility = "hidden";
  });
}

