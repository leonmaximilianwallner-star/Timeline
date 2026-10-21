// views/timeline/render.js — draws the timeline view. Moved from index.html lines 954–1082 on 21 Oct 2026; names updated to the dictionary the same day.
"use strict";
/* ---------- timeline view ---------- */
function renderTimeline(){
  const W = UI.range.days * TL_PPD;
  const frag = document.createElement("div");
  frag.style.width = W+"px"; frag.style.position = "relative";

  /* month labels */
  const mrow = document.createElement("div"); mrow.id = "monthRow"; mrow.className="tlRow";
  let i = 0;
  while(i < UI.range.days){
    const d0 = parseISO(idxDate(i));
    const monthEnd = new Date(d0.getFullYear(), d0.getMonth()+1, 1);
    const span = Math.min(UI.range.days - i, Math.round((monthEnd - d0)/DAY_MS));
    const el = document.createElement("div");
    el.className = "monthSpan"; el.style.width = span*TL_PPD+"px";
    el.innerHTML = `<span class="monthLabel">${MONTHS[d0.getMonth()]}${d0.getMonth()===0?" "+d0.getFullYear():""}</span>`;
    mrow.appendChild(el); i += span;
  }
  frag.appendChild(mrow);

  /* per-project: spine + milestones, then its phase lanes */
  /* per-project (dated category): spine bounded by start..end, then its phase lanes */
  S.categories.filter(c=>c.start && c.end).forEach(p=>{
    const row = document.createElement("div"); row.className = "tlRow projRow";
    const x = dayIdx(p.start)*TL_PPD;
    const w = Math.max(diffDays(p.start, p.end)*TL_PPD, 26);
    const spine = document.createElement("div"); spine.className = "projSpine colored";
    spine.style.left = x+"px"; spine.style.width = w+"px"; spine.style.background = p.color;
    row.appendChild(spine);
    const lw = document.createElement("div"); lw.className="projLabelWrap";
    lw.style.left = x+"px"; lw.style.width = w+"px";
    lw.innerHTML = `<span class="projLabel" data-edit-project="${p.id}" style="color:${p.color}">${esc(p.name)}</span>`;
    row.appendChild(lw);
    S.milestones.filter(m=>m.categoryId===p.id).sort((a,b)=>a.date<b.date?-1:1).forEach(m=>{
      const mx = (dayIdx(m.date)+.5)*TL_PPD;
      const dot = document.createElement("div");
      dot.className = "milestone-dot"+(m.final?" final":"");
      dot.style.left = mx+"px";
      dot.dataset.editMilestone = m.id;
      dot.title = m.title;
      dot.innerHTML = `<span class="milestone-label">${m.final?"★ ":""}${esc(m.title)}</span>`;
      row.appendChild(dot);
    });
    frag.appendChild(row);
    appendPhaseLanes(frag, S.phases.filter(ph=>ph.categoryId===p.id), W);
  });

  /* ungrouped: phases tagged with a dateless category, or untagged (frei → grey) */
  const datedIds = new Set(S.categories.filter(c=>c.start && c.end).map(c=>c.id));
  appendPhaseLanes(frag, S.phases.filter(ph=>!ph.categoryId || !datedIds.has(ph.categoryId)), W);

  /* milestone chips: every milestone not on a project's spine.
     Colour: its category's; without one, red as before, until colour/category is decided (RULEBOOK B.8). */
  const xr = document.createElement("div"); xr.className="tlRow"; xr.id="milestoneRow";
  S.milestones.filter(m=>!datedIds.has(m.categoryId)).forEach(m=>{
    const el = document.createElement("div");
    el.className = "milestone-chip"; el.style.left = (dayIdx(m.date)+.5)*TL_PPD+"px";
    el.style.background = m.categoryId ? cat(m.categoryId).color : "var(--c-red)";
    el.dataset.editMilestone = m.id;
    el.innerHTML = `<span class="chip-title">${esc(m.title)}</span><span class="chip-note">${esc(m.note||"")}</span>`;
    xr.appendChild(el);
  });
  frag.appendChild(xr);

  /* today line + overlays */
  const tl = document.createElement("div"); tl.className="todayLine";
  tl.style.left = (dayIdx(todayISO())+.5)*TL_PPD+"px"; frag.appendChild(tl);
  const hov = document.createElement("div"); hov.className="tlHover"; hov.id="tlHover"; frag.appendChild(hov);

  const tlg = document.createElement("div"); tlg.id="tlGrid";
  frag.insertBefore(tlg, frag.firstChild);

  $tlInner.replaceChildren(frag);
  $tlInner.style.width = (W + railW())+"px";
  fitLabels(frag);
}

function appendPhaseLanes(frag, phases, W){
  if(!phases.length) return;
  const { count: nLanes, laneOf } = packLanes(phases);
  /* group phases by their packed lane so each lane row owns its own phase dropdown rows */
  const byLane = Array.from({length:nLanes}, ()=>[]);
  phases.forEach(ph => byLane[laneOf.get(ph)].push(ph));

  for(let l = 0; l < nLanes; l++){
    const r = document.createElement("div"); r.className = "tlRow laneRow";
    frag.appendChild(r);

    byLane[l].forEach(ph => {
      const x = dayIdx(ph.start)*TL_PPD, w = Math.max(diffDays(ph.start, ph.end)*TL_PPD, 26);
      const el = document.createElement("div");
      el.className="phase"; el.style.left=x+"px"; el.style.width=w+"px";
      el.style.background = cat(ph.categoryId).color;
      el.dataset.phase = ph.id;
      el.innerHTML =
        `<span class="ph-stick"><button class="ph-exp" data-expand="${ph.id}" title="Details">${device.openPhases.includes(ph.id)?"▾":"▸"}</button>`+
        `<span class="ph-label">${esc(ph.title)}</span></span>`+
        `<span class="ph-handle l" data-rez="l"></span><span class="ph-handle r" data-rez="r"></span>`;
      r.appendChild(el);
    });

    /* phase dropdown rows for this lane's open phases — inserted immediately
       after the lane row so the dropdown always sits under its phase */
    byLane[l].forEach(ph => {
      if(!device.openPhases.includes(ph.id)) return;
      const x = dayIdx(ph.start)*TL_PPD, w = Math.max(diffDays(ph.start, ph.end)*TL_PPD, 26);
      const br = document.createElement("div"); br.className="tlRow dropdown-row";
      const anchor = document.createElement("div"); anchor.className="dropdown-anchor";
      anchor.style.marginLeft = x+"px"; anchor.style.width = Math.max(w, 340)+"px";
      const bb = document.createElement("div"); bb.className="dropdown";
      bb.style.borderTopColor = cat(ph.categoryId).color;
      bb.innerHTML = sanitize(ph.details||"");
      anchor.appendChild(bb); br.appendChild(anchor);
      frag.appendChild(br);
    });
  }
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

