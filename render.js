/* ============================================================
   render.js — renderAll() und alle Sub-Renderer.
   Liest S, schreibt DOM. Persistiert NIE.
   ============================================================ */
'use strict';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

const expandedPhases = new Set();    // UI-State, nicht persistiert

function renderAll() {
  recomputeRange();
  renderTimeline();
  renderDaily();
  renderOpenPoints();
  updateUndoButtons();
  updateSyncBadge();
}

/* ============================ TIMELINE ============================ */
function renderTimeline() {
  const inner = $('tlInner');
  inner.innerHTML = '';
  inner.style.width = tlWidth() + 'px';

  /* Wochenraster */
  const grid = el('div', 'tl-grid');
  for (const k of DAYS) if (pd(k).getDay() === 1)
    grid.append(Object.assign(el('div', 'wk'), { style: `left:${dayX(k)}px` }));
  inner.append(grid);

  /* Monatslabels — sticky-left je Spanne */
  const months = el('div', 'tl-months');
  let i = 0;
  while (i < DAYS.length) {
    const d0 = pd(DAYS[i]); let j = i;
    while (j < DAYS.length && pd(DAYS[j]).getMonth() === d0.getMonth()) j++;
    const seg = el('div', 'tl-month');
    seg.style.width = (j - i) * TL_DAY_W + 'px';
    seg.append(el('span', null, MONTHS[d0.getMonth()]));
    months.append(seg);
    i = j;
  }
  inner.append(months);

  /* Datumszeile: jeden Montag + Bereichsenden */
  const dates = el('div', 'tl-dates');
  dates.id = 'tlDates';
  for (const k of DAYS) if (pd(k).getDay() === 1 || k === DAYS[0] || k === DAYS.at(-1)) {
    const lab = el('span', 'tl-date mono', fmtDM(k));
    lab.dataset.day = k;
    lab.style.left = (dayX(k) + TL_DAY_W / 2) + 'px';
    dates.append(lab);
  }
  inner.append(dates);

  /* Projekt-Spines mit Milestones */
  const projWrap = el('div', 'tl-projects');
  for (const p of S.projects) {
    const row = el('div', 'tl-spine-row');
    row.append(el('span', 'tl-proj-name', p.name));
    const ms = [...p.milestones].sort((a, b) => a.day < b.day ? -1 : 1);
    if (ms.length) {
      const x0 = dayX(ms[0].day) + TL_DAY_W / 2, x1 = dayX(ms.at(-1).day) + TL_DAY_W / 2;
      const spine = el('div', 'tl-spine');
      spine.style.cssText = `left:${x0}px;width:${Math.max(2, x1 - x0)}px;background:${catColor(p.categoryId)}`;
      row.append(spine);
    }
    for (const m of ms) {
      const node = el('div', 'tl-ms' + (m.end ? ' end' : ''));
      node.style.left = (dayX(m.day) + TL_DAY_W / 2) + 'px';
      node.innerHTML = (m.end ? `<div class="star">★</div>` : '') +
        `<div class="dot" style="background:${m.end ? 'var(--ok)' : catColor(p.categoryId)}"></div>` +
        `<div class="lbl">${esc(m.label)}</div>`;
      node.style.cursor = 'pointer';
      node.addEventListener('click', () => openMilestoneModal(p, m));
      row.append(node);
    }
    projWrap.append(row);
  }
  inner.append(projWrap);

  /* Phasen-Lanes: zuerst projektgebundene, dann freie */
  const lanesWrap = el('div', 'tl-lanes');
  lanesWrap.id = 'tlLanes';
  const projCats = new Set(S.projects.map(p => p.categoryId));
  const bound = S.phases.filter(ph => projCats.has(ph.categoryId));
  const free  = S.phases.filter(ph => !projCats.has(ph.categoryId));
  let y = 4;
  for (const group of [bound, free]) {
    if (!group.length) continue;
    const { placed, laneCount } = packLanes(group, ph => ph.s, ph => ph.t);
    for (const { item: ph, lane } of placed) y = renderPhase(lanesWrap, ph, y, lane);
    const used = laneCount * 32;
    lanesWrap.lastY = (lanesWrap.lastY || 0);
    y = baseY(group, placed) + used + 8;
  }
  /* simpler: Höhe aus Bars ermitteln */
  lanesWrap.style.height = (maxPhaseBottom(lanesWrap) + 12) + 'px';
  inner.append(lanesWrap);

  /* Exam-Chips */
  const chips = el('div', 'tl-chips');
  for (const x of S.exams) {
    const c = el('div', 'chip');
    c.style.left = (dayX(x.day) + TL_DAY_W / 2) + 'px';
    c.style.background = catColor(x.categoryId) + 'D8';
    c.style.border = `0.5px solid ${catColor(x.categoryId)}38`;
    c.innerHTML = `<b>${esc(x.label)}</b>` + (x.points ? `<i>${esc(String(x.points))} Pkt</i>` : '');
    c.addEventListener('click', () => openExamModal(x));
    const tick = el('div', 'chip-tick');
    tick.style.left = (dayX(x.day) + TL_DAY_W / 2) + 'px';
    tick.style.top = '-10px';
    chips.append(tick, c);
  }
  inner.append(chips);

  /* Heute-Linie */
  const t = todayKey();
  if (DAY_IDX[t] !== undefined) {
    const line = el('div', 'today-line');
    line.style.left = (dayX(t) + TL_DAY_W / 2) + 'px';
    inner.append(line);
  }
}

function baseY(group, placed) { return 4; }
function maxPhaseBottom(wrap) {
  let m = 40;
  wrap.querySelectorAll('.phase').forEach(b => m = Math.max(m, b.offsetTop + 30 || parseFloat(b.style.top) + 30));
  wrap.querySelectorAll('.ph-detail').forEach(b => m = Math.max(m, parseFloat(b.style.top) + b.offsetHeight + 6 || 0));
  return m;
}

function renderPhase(wrap, ph, _y, lane) {
  const x = dayX(ph.s), w = Math.max(TL_DAY_W, dayX(ph.t) - x);
  const top = 4 + lane * 32 + (wrap.groupOffset || 0);
  const bar = el('div', 'phase');
  bar.dataset.id = ph.id;
  bar.style.cssText = `left:${x}px;width:${w}px;top:${top}px;` +
    `background:${catColor(ph.categoryId)}D8;border:0.5px solid ${catColor(ph.categoryId)}38;`;
  const arrow = el('button', 'ph-arrow', expandedPhases.has(ph.id) ? '▾' : '▸');
  arrow.addEventListener('pointerdown', e => e.stopPropagation());
  arrow.addEventListener('click', e => {
    e.stopPropagation();
    expandedPhases.has(ph.id) ? expandedPhases.delete(ph.id) : expandedPhases.add(ph.id);
    renderTimeline();
  });
  bar.append(arrow, el('span', 'ph-label', esc(ph.name)),
             el('div', 'ph-edge l'), el('div', 'ph-edge r'));
  wrap.append(bar);

  if (expandedPhases.has(ph.id)) {
    const det = el('div', 'ph-detail');
    det.style.cssText = `left:${x}px;top:${top + 30}px;min-width:${Math.min(w, 200)}px;max-width:${Math.max(w, 340)}px`;
    det.append(el('div', 'ph-detail-inner', sanitizeHTML(ph.details) || '<span style="color:var(--muted)">Keine Beschreibung</span>'));
    wrap.append(det);
  }
  return top + 32;
}

/* ============================ DAILY ============================ */
function renderDaily() {
  const inner = $('dayInner');
  inner.innerHTML = '';
  const W = dailyDayW();
  const totalW = RAIL_W + DAYS.length * W;
  inner.style.width = totalW + 'px';
  const t = todayKey();

  /* Sticky Tagesleiste */
  const stick = el('div', 'day-stick');
  stick.append(el('div', 'rail-corner'));
  for (const k of DAYS) {
    const d = pd(k);
    const h = el('div', 'day-head' + (k === t ? ' today' : ''));
    h.style.width = W + 'px';
    h.innerHTML = `<div class="wd">${WD_SHORT[d.getDay()]}</div><div class="dn">${fmtDM(k)}</div>`;
    stick.append(h);
  }
  inner.append(stick);

  /* Körper */
  const body = el('div', 'day-body');
  body.style.height = gridH() + 'px';
  const rail = el('div', 'hour-rail');
  rail.id = 'hourRail';
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) {
    const lab = el('div', 'hour-lbl mono', fmtTime(m));
    lab.style.top = minToY(m) + 'px';
    rail.append(lab);
  }
  body.append(rail);

  const cols = el('div', 'day-cols');
  cols.id = 'dayCols';
  for (const k of DAYS) {
    const col = el('div', 'day-col' + (k === t ? ' today-col' : ''));
    col.dataset.day = k;
    col.style.width = W + 'px';
    for (let m = DAY_START_MIN + 60; m < DAY_END_MIN; m += 60) {
      const hl = el('div', 'hline');
      hl.style.top = minToY(m) + 'px';
      col.append(hl);
    }
    /* Events dieses Tages (inkl. Wiederholungen) */
    const occ = S.dailyItems.filter(it => occursOn(it, k));
    for (const { item, col: c, of } of packDayColumns(occ)) {
      col.append(buildEventCard(item, k, c, of, W));
    }
    if (k === t) {
      const line = el('div', 'today-line-day');
      line.style.cssText = `left:0;height:${gridH()}px`;
      col.append(line);
    }
    cols.append(col);
  }
  body.append(cols);
  inner.append(body);
}

function buildEventCard(item, dayK, c, of, W) {
  const gutter = 4;
  const cw = (W - gutter * (of + 1)) / of;
  const card = el('div', 'evt');
  card.dataset.id = item.id;
  card.dataset.day = dayK;
  const h = Math.max(14, minToY(item.end) - minToY(item.start) - 2);
  card.style.cssText =
    `top:${minToY(item.start)}px;height:${h}px;` +
    `left:${gutter + c * (cw + gutter)}px;width:${cw}px;` +
    `background:${catColor(item.categoryId)}D0;border:0.4px solid ${catColor(item.categoryId)}38;`;
  card.innerHTML = `<b>${esc(item.title)}</b>` +
    (h > 30 ? `<span class="tm">${fmtTime(item.start)}–${fmtTime(item.end)}</span>` : '');
  card.append(el('div', 'edge t'), el('div', 'edge b'));

  const todos = item.todos || [];
  if (todos.length) {
    const done = todos.every(td => td.state === 'done');
    const cancelled = todos.every(td => td.state === 'cancelled');
    if (done) card.classList.add('all-done');
    else if (cancelled) card.classList.add('all-cancelled');
  }
  return card;
}

/* Event-Popup mit Todos (öffnet bei Klick ohne Drag) */
let openPop = null;
function openEventPopup(item, anchor) {
  closeEventPopup();
  const pop = el('div', 'evt-pop');
  pop.dataset.itemId = item.id;
  const renderPop = () => {
    pop.innerHTML =
      `<h4>${esc(item.title)}</h4>` +
      `<div class="tm">${fmtDM(item.day)} · ${fmtTime(item.start)}–${fmtTime(item.end)}` +
      (item.repeat && item.repeat !== 'none' ? ` · ↻ ${repeatLabel(item.repeat)}` : '') + `</div>` +
      (item.details ? `<div class="detail-html">${sanitizeHTML(item.details)}</div>` : '');
    const list = el('div');
    for (const td of (item.todos || [])) {
      const row = el('div', 'todo-row');
      row.dataset.state = td.state;
      const dot = el('button', 'todo-dot', td.state === 'done' ? '✓' : td.state === 'cancelled' ? '✕' : td.state === 'postponed' ? '→' : '');
      dot.addEventListener('click', () => { snap(); cycleTodo(td); persist(); renderDaily(); flashIfAllDone(item); renderPop(); });
      dot.addEventListener('contextmenu', e => {
        e.preventDefault();
        snap(); td.state = td.state === 'postponed' ? 'open' : 'postponed';
        persist(); renderDaily(); renderPop();
      });
      const delBtn = el('button', 'todo-del', '✕');
      delBtn.addEventListener('click', () => {
        snap(); item.todos = item.todos.filter(x => x !== td); persist(); renderDaily(); renderPop();
      });
      row.append(dot, el('span', 'todo-txt', esc(td.text)), delBtn);
      list.append(row);
    }
    pop.append(list);
    const add = el('div', 'todo-new');
    const inp = el('input'); inp.placeholder = 'Todo hinzufügen…';
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && inp.value.trim()) {
        snap();
        (item.todos = item.todos || []).push({ id: uid(), text: inp.value.trim(), state: 'open' });
        persist(); renderDaily(); renderPop();
      }
      e.stopPropagation();
    });
    add.append(inp);
    pop.append(add);
    const actions = el('div', 'pop-actions');
    const edit = el('button', 'btn grow', 'Bearbeiten');
    edit.addEventListener('click', () => { closeEventPopup(); openEventModal(item); });
    const del = el('button', 'btn danger', 'Löschen');
    del.addEventListener('click', () => {
      snap(); S.dailyItems = S.dailyItems.filter(x => x.id !== item.id);
      persist(); renderDaily(); closeEventPopup();
    });
    actions.append(edit, del);
    pop.append(actions);
  };
  renderPop();
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = 300;
  pop.style.left = clamp(r.right + 8, 8, innerWidth - pw - 8) + 'px';
  pop.style.top = clamp(r.top, 8, innerHeight - 60) + 'px';
  if (r.right + pw + 16 > innerWidth) pop.style.left = Math.max(8, r.left - pw - 8) + 'px';
  openPop = pop;
  setTimeout(() => document.addEventListener('pointerdown', popOutside, true));
}
function popOutside(e) {
  if (openPop && !openPop.contains(e.target)) closeEventPopup();
}
function closeEventPopup() {
  if (openPop) { openPop.remove(); openPop = null; document.removeEventListener('pointerdown', popOutside, true); }
}
function cycleTodo(td) {
  td.state = td.state === 'open' ? 'done' : td.state === 'done' ? 'cancelled' : 'open';
}
function flashIfAllDone(item) {
  if ((item.todos || []).length && item.todos.every(t => t.state === 'done')) {
    const card = document.querySelector(`.evt[data-id="${item.id}"]`);
    if (card) { card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 750); }
  }
}
function repeatLabel(r) {
  return { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', weekdays: 'werktags' }[r] || r;
}

/* ============================ OPEN POINTS ============================ */
function renderOpenPoints() {
  const wrap = $('opWrap');
  wrap.innerHTML = '';
  for (const g of S.openPoints) {
    const box = el('div', 'op-group');
    const h = el('h4', null, esc(g.title));
    const addB = el('button', 'op-add', '+');
    addB.title = 'Punkt hinzufügen';
    addB.addEventListener('click', () => {
      const txt = prompt('Neuer Punkt:');
      if (txt && txt.trim()) { snap(); g.items.push({ id: uid(), text: txt.trim(), state: 'open' }); persist(); renderOpenPoints(); }
    });
    h.append(addB);
    box.append(h);
    for (const it of g.items) {
      const row = el('div', 'todo-row');
      row.dataset.state = it.state;
      const dot = el('button', 'todo-dot', it.state === 'done' ? '✓' : it.state === 'cancelled' ? '✕' : '');
      dot.addEventListener('click', () => { snap(); cycleTodo(it); persist(); renderOpenPoints(); });
      const delBtn = el('button', 'todo-del', '✕');
      delBtn.addEventListener('click', () => { snap(); g.items = g.items.filter(x => x !== it); persist(); renderOpenPoints(); });
      row.append(dot, el('span', 'todo-txt', esc(it.text)), delBtn);
      box.append(row);
    }
    wrap.append(box);
  }
}

/* ============================ ZEITBUDGET ============================ */
function openBudget() {
  const days = 7;
  showBudget(days);
}
function showBudget(days) {
  const to = todayKey(), from = addDays(to, -(days - 1));
  const mins = {};
  for (const it of S.dailyItems) {
    for (const k of occurrencesInRange(it, from, to)) {
      mins[it.categoryId] = (mins[it.categoryId] || 0) + (it.end - it.start);
      void k;
    }
  }
  const entries = Object.entries(mins).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  let svg = `<svg width="170" height="170" viewBox="0 0 170 170">`;
  let acc = 0;
  const R = 62, CX = 85, CY = 85, TAU = Math.PI * 2;
  for (const [cid, v] of entries) {
    const a0 = acc / total * TAU - TAU / 4; acc += v;
    const a1 = acc / total * TAU - TAU / 4;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    svg += `<path d="M ${CX + R * Math.cos(a0)} ${CY + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${CX + R * Math.cos(a1)} ${CY + R * Math.sin(a1)}"
            stroke="${catColor(cid)}" stroke-width="22" fill="none"/>`;
  }
  if (!total) svg += `<circle cx="${CX}" cy="${CY}" r="${R}" stroke="var(--surface2)" stroke-width="22" fill="none"/>`;
  svg += `<text x="${CX}" y="${CY - 2}" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="700">${(total / 60).toFixed(1)}h</text>
          <text x="${CX}" y="${CY + 16}" text-anchor="middle" fill="var(--text2)" font-size="10">${days} Tage</text></svg>`;

  const legend = entries.map(([cid, v]) =>
    `<div><span class="sw" style="background:${catColor(cid)}"></span>${esc(cat(cid).name)}
     <span class="mono">${(v / 60).toFixed(1)}h</span></div>`).join('') ||
    '<div style="color:var(--muted)">Keine Daten im Zeitraum</div>';

  openModal(`
    <h3>Zeitbudget <button class="x" data-close>×</button></h3>
    <div class="seg" style="margin-bottom:14px">
      <button data-days="7"  class="${days === 7 ? 'on' : ''}">7 Tage</button>
      <button data-days="30" class="${days === 30 ? 'on' : ''}">30 Tage</button>
    </div>
    <div class="budget-grid">${svg}<div class="budget-legend">${legend}</div></div>
  `, m => {
    m.querySelectorAll('[data-days]').forEach(b =>
      b.addEventListener('click', () => { closeModal(); showBudget(Number(b.dataset.days)); }));
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
