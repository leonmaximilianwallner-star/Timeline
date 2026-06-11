/* ============================================================
   input.js — EIN Pointer-Events-Pipeline für Maus/Touch/Pen.
   Drag-Maschinen: create (Timeline & Daily), move, resize, copy.
   Add-Mode (FAB), Long-Press, Escape-Stack, Tastatur.
   ============================================================ */
'use strict';

let addMode = false;
let drag = null;                 // aktive Drag-Maschine oder null
let longPressTimer = null;

/* Ein passiver:false-Listener — nur preventDefault während Drag lebt */
document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });

function setAddMode(on) {
  addMode = on;
  document.body.classList.toggle('addmode', on);
  $('fab').classList.toggle('on', on);
  if (!on) clearHoverLines();
}

/* ---------- Hover-Indikatoren (verschwinden bei Dragstart!) ---------- */
let hoverV = null, hoverH = null;
function clearHoverLines() {
  hoverV?.remove(); hoverV = null;
  hoverH?.remove(); hoverH = null;
}

/* ====================== TIMELINE-Pipeline ====================== */
function initTimelineInput() {
  const inner = $('tlInner');

  inner.addEventListener('pointermove', e => {
    if (drag || !addMode) return;
    const x = tlLocalX(e);
    const day = Math.floor(x / TL_DAY_W);
    if (!hoverV) { hoverV = el('div', 'hover-line-v'); inner.append(hoverV); }
    hoverV.style.left = (day * TL_DAY_W) + 'px';
  });
  inner.addEventListener('pointerleave', () => { if (!drag) clearHoverLines(); });

  inner.addEventListener('pointerdown', e => {
    if (e.button === 2 || modalEl) return;
    const phaseEl = e.target.closest('.phase');
    if (phaseEl) {
      const ph = S.phases.find(p => p.id === phaseEl.dataset.id);
      if (!ph) return;
      const edge = e.target.classList.contains('ph-edge') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
      startPhaseDrag(e, ph, phaseEl, edge);
      return;
    }
    if (!addMode) return;
    e.preventDefault();
    clearHoverLines();                              // Fix v1-Bug #1: Hover-Linie weg bei Dragstart
    const inner2 = $('tlInner');
    const startDay = clamp(Math.floor(tlLocalX(e) / TL_DAY_W), 0, DAYS.length - 1);
    const lineA = el('div', 'drag-line-v'), lineB = el('div', 'drag-line-v');
    const bp = el('div', 'blueprint');
    inner2.append(lineA, lineB, bp);                // z-index 1: HINTER den Bars (Fix #3)
    drag = {
      kind: 'tl-create', startDay, curDay: startDay, lineA, lineB, bp,
      update() {
        const a = Math.min(this.startDay, this.curDay), b = Math.max(this.startDay, this.curDay);
        lineA.style.left = a * TL_DAY_W + 'px';
        lineB.style.left = (b + 1) * TL_DAY_W + 'px';
        bp.style.cssText = `left:${a * TL_DAY_W}px;width:${(b - a + 1) * TL_DAY_W}px;top:${tlLanesTop()}px;height:24px;`;
        highlightDates(DAYS[a], DAYS[b]);           // Fix #2: bestehende Labels highlighten
      },
    };
    drag.update();
    inner.setPointerCapture(e.pointerId);
  });

  inner.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.kind === 'tl-create') {
      drag.curDay = clamp(Math.floor(tlLocalX(e) / TL_DAY_W), 0, DAYS.length - 1);
      drag.update();
    } else if (drag.kind === 'ph-move' || drag.kind === 'ph-resize') {
      phaseDragMove(e);
    }
  });

  inner.addEventListener('pointerup', e => {
    if (!drag) return;
    if (drag.kind === 'tl-create') finishTimelineCreate();
    else finishPhaseDrag(e);
  });
  inner.addEventListener('pointercancel', () => cancelDrag());
}

function tlLocalX(e) {
  const r = $('tlInner').getBoundingClientRect();
  return e.clientX - r.left;
}
function tlLanesTop() {
  const lanes = $('tlLanes');
  return lanes ? lanes.offsetTop + 4 : 80;
}
function highlightDates(fromK, toK) {
  document.querySelectorAll('.tl-date').forEach(l => {
    l.classList.toggle('hl', !!fromK && l.dataset.day >= fromK && l.dataset.day <= toK);
  });
}

function finishTimelineCreate() {
  const a = Math.min(drag.startDay, drag.curDay), b = Math.max(drag.startDay, drag.curDay);
  const bp = drag.bp;
  drag.lineA.remove(); drag.lineB.remove();
  drag = null;
  setAddMode(false);                                 // Auto-Exit nach Erstellung
  const cleanup = () => { bp.remove(); highlightDates(null); };
  if (b > a) {
    const ph = { id: uid(), name: '', categoryId: S.categories[0].id, s: DAYS[a], t: addDays(DAYS[b], 1), details: '' };
    openPhaseModal(ph, true, cleanup);               // Blueprint bleibt hinterm Modal sichtbar
  } else {
    const x = { id: uid(), label: '', day: DAYS[a], points: null, categoryId: 'red' };
    openExamModal(x, true, cleanup);
  }
}

/* Phase verschieben / Kante ziehen */
function startPhaseDrag(e, ph, elx, edge) {
  e.preventDefault();
  closeEventPopup();
  const x0 = tlLocalX(e);
  drag = {
    kind: edge ? 'ph-resize' : 'ph-move', ph, elx, edge, x0,
    s0: ph.s, t0: ph.t, moved: false, snapped: false,
  };
  $('tlInner').setPointerCapture(e.pointerId);
}
function phaseDragMove(e) {
  const dx = tlLocalX(e) - drag.x0;
  if (Math.abs(dx) < 5 && !drag.moved) return;       // 5px-Schwelle: Klick vs. Drag
  if (!drag.snapped) { snap(); drag.snapped = true; }
  drag.moved = true;
  const dDays = Math.round(dx / TL_DAY_W);
  const ph = drag.ph;
  if (drag.kind === 'ph-move') {
    ph.s = addDays(drag.s0, dDays); ph.t = addDays(drag.t0, dDays);
  } else if (drag.edge === 'l') {
    ph.s = addDays(drag.s0, dDays);
    if (ph.s >= ph.t) ph.s = addDays(ph.t, -1);
  } else {
    ph.t = addDays(drag.t0, dDays);
    if (ph.t <= ph.s) ph.t = addDays(ph.s, 1);
  }
  const x = dayX(ph.s), w = Math.max(TL_DAY_W, dayX(ph.t) - x);
  drag.elx.style.left = x + 'px'; drag.elx.style.width = w + 'px';
  highlightDates(ph.s, addDays(ph.t, -1));
}
function finishPhaseDrag() {
  const moved = drag.moved, ph = drag.ph;
  highlightDates(null);
  drag = null;
  if (moved) { persist(); renderAll(); }
  else openPhaseModal(ph, false);                    // Klick ohne Drag = bearbeiten
}

/* ====================== DAILY-Pipeline ====================== */
function initDailyInput() {
  const inner = $('dayInner');

  inner.addEventListener('pointermove', e => {
    if (drag) { dailyDragMove(e); return; }
    if (!addMode) return;
    const col = e.target.closest('.day-col');
    if (!col) { hoverH?.remove(); hoverH = null; return; }
    const min = yToMin(colLocalY(e, col));
    if (!hoverH) { hoverH = el('div', 'hover-line-h'); }
    col.append(hoverH);
    hoverH.style.cssText = `top:${minToY(min)}px;left:0;right:0;`;
  });
  inner.addEventListener('pointerleave', () => { if (!drag) { hoverH?.remove(); hoverH = null; } });

  inner.addEventListener('pointerdown', e => {
    if (e.button === 2 || modalEl) return;
    const card = e.target.closest('.evt');
    const col = e.target.closest('.day-col');
    if (card) { startEventDrag(e, card); return; }
    if (!col) return;

    if (addMode) {
      e.preventDefault();
      startDailyCreate(e, col);
    } else if (e.pointerType !== 'mouse') {
      /* Long-Press auf leerer Fläche: direkt erstellen (Locked Spec 4.4) */
      const day = col.dataset.day, min = yToMin(colLocalY(e, col));
      longPressTimer = setTimeout(() => {
        navigator.vibrate?.(12);
        const item = blankEvent(day, min);
        openEventModal(item, true);
        setAddMode(false);
      }, 500);
      const cancelLP = () => { clearTimeout(longPressTimer); inner.removeEventListener('pointerup', cancelLP); inner.removeEventListener('pointermove', lpMove); };
      const lpMove = ev => { if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 8) cancelLP(); };
      inner.addEventListener('pointerup', cancelLP, { once: true });
      inner.addEventListener('pointermove', lpMove);
    }
  });

  inner.addEventListener('pointerup', e => { if (drag) finishDailyDrag(e); });
  inner.addEventListener('pointercancel', () => cancelDrag());
}

function colLocalY(e, col) {
  return e.clientY - col.getBoundingClientRect().top;
}
function blankEvent(day, startMin) {
  return { id: uid(), title: '', day, start: startMin, end: Math.min(DAY_END_MIN, startMin + 60),
           categoryId: S.categories[0].id, repeat: 'none', reminder: null, todos: [], details: '' };
}

/* Erstellen per Drag */
function startDailyCreate(e, col) {
  clearHoverLines();                                 // Hover-Linie weg bei Dragstart
  const min0 = yToMin(colLocalY(e, col));
  const bp = el('div', 'blueprint-evt');
  const lt = el('div', 'drag-line-h'), lb = el('div', 'drag-line-h');
  col.append(bp, lt, lb);
  const labT = railSnapLabel(min0), labB = railSnapLabel(min0);
  drag = {
    kind: 'day-create', col, day: col.dataset.day, min0, min1: min0, bp, lt, lb, labT, labB,
    update() {
      const a = Math.min(this.min0, this.min1), b = Math.max(this.min0, this.min1, a + SNAP_MIN);
      bp.style.cssText = `top:${minToY(a)}px;height:${minToY(b) - minToY(a)}px;left:4px;right:4px;`;
      lt.style.cssText = `top:${minToY(a)}px;left:0;right:0;`;
      lb.style.cssText = `top:${minToY(b)}px;left:0;right:0;`;
      labT.textContent = fmtTime(a); labT.style.top = minToY(a) + 'px';
      labB.textContent = fmtTime(b); labB.style.top = minToY(b) + 'px';
    },
  };
  drag.update();
  $('dayInner').setPointerCapture(e.pointerId);
}
function railSnapLabel(min) {
  const lab = el('div', 'hour-lbl mono snap', fmtTime(min));
  lab.style.top = minToY(min) + 'px';
  $('hourRail').append(lab);
  return lab;
}

/* Bestehende Events: Move / Resize / Copy / Klick */
function startEventDrag(e, card) {
  const item = S.dailyItems.find(x => x.id === card.dataset.id);
  if (!item) return;
  const isEdge = e.target.classList.contains('edge');
  const edge = isEdge ? (e.target.classList.contains('t') ? 't' : 'b') : null;
  const begin = () => {
    closeEventPopup();
    drag = {
      kind: edge ? 'ev-resize' : 'ev-move', item, card, edge,
      x0: e.clientX, y0: e.clientY, s0: item.start, e0: item.end, day0: card.dataset.day,
      copy: e.ctrlKey || e.metaKey, moved: false, snapped: false,
    };
    card.classList.add('dragging');
    $('dayInner').setPointerCapture(e.pointerId);
  };
  if (e.pointerType === 'mouse' || isEdge) {
    e.preventDefault();
    begin();
  } else {
    /* Touch/Pen: Long-Press startet Move, sonst Klick=Popup */
    longPressTimer = setTimeout(() => { navigator.vibrate?.(12); begin(); drag.moved = false; }, 500);
    const clear = () => clearTimeout(longPressTimer);
    card.addEventListener('pointerup', ev => {
      clear();
      if (!drag) openEventPopup(item, card);
    }, { once: true });
    card.addEventListener('pointermove', function lpm(ev) {
      if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 8) { clear(); card.removeEventListener('pointermove', lpm); }
    });
  }
}

function dailyDragMove(e) {
  if (drag.kind === 'day-create') {
    drag.min1 = yToMin(colLocalY(e, drag.col));
    drag.update();
    return;
  }
  if (drag.kind !== 'ev-move' && drag.kind !== 'ev-resize') return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;   // 5px-Schwelle
  if (!drag.snapped) {
    snap(); drag.snapped = true;
    if (drag.copy) {
      const clone = JSON.parse(JSON.stringify(drag.item));
      clone.id = uid(); clone.todos?.forEach(t => t.id = uid());
      S.dailyItems.push(clone);
      drag.item = clone;
    }
  }
  drag.moved = true;
  const dMin = snapMin(dy / HOUR_H * 60);
  const it = drag.item, dur = drag.e0 - drag.s0;
  if (drag.kind === 'ev-resize') {
    if (drag.edge === 't') it.start = clamp(snapMin(drag.s0 + dMin), DAY_START_MIN, it.end - SNAP_MIN);
    else it.end = clamp(snapMin(drag.e0 + dMin), it.start + SNAP_MIN, DAY_END_MIN);
  } else {
    it.start = clamp(snapMin(drag.s0 + dMin), DAY_START_MIN, DAY_END_MIN - dur);
    it.end = it.start + dur;
    /* horizontal: Tag wechseln */
    const W = dailyDayW();
    const dDay = Math.round(dx / W);
    it.day = addDays(drag.day0, dDay);
  }
  /* Live-Feedback ohne Voll-Rerender */
  drag.card.style.top = minToY(it.start) + 'px';
  drag.card.style.height = Math.max(14, minToY(it.end) - minToY(it.start) - 2) + 'px';
}

function finishDailyDrag(e) {
  if (drag.kind === 'day-create') {
    const a = Math.min(drag.min0, drag.min1);
    const b = Math.max(drag.min0, drag.min1, a + SNAP_MIN);
    const { bp, lt, lb, labT, labB, day } = drag;
    lt.remove(); lb.remove();
    drag = null;
    setAddMode(false);                               // Auto-Exit
    const cleanup = () => { bp.remove(); labT.remove(); labB.remove(); };
    const item = blankEvent(day, a); item.end = b;
    openEventModal(item, true, cleanup);             // Blueprint persistiert hinterm Modal
    return;
  }
  const { item, card, moved } = drag;
  card.classList.remove('dragging');
  drag = null;
  if (moved) { persist(); renderDaily(); }
  else if (card.isConnected) openEventPopup(item, card);
}

function cancelDrag() {
  if (!drag) return;
  ['bp', 'lt', 'lb', 'labT', 'labB', 'lineA', 'lineB'].forEach(k => drag[k]?.remove?.());
  drag.card?.classList.remove('dragging');
  highlightDates(null);
  drag = null;
  renderAll();
}

/* ====================== Tastatur + Escape-Stack ====================== */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) ||
                   document.activeElement.isContentEditable;
    if (e.key === 'Escape') {
      /* topmost zuerst: Modal > Popup > Settings > Add-Mode > Drag */
      if (modalEl) { closeModal(); return; }
      if (openPop) { closeEventPopup(); return; }
      if ($('settingsPanel').classList.contains('open')) { toggleSettings(false); return; }
      if (addMode) { setAddMode(false); return; }
      if (drag) { cancelDrag(); return; }
      return;
    }
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) setAddMode(!addMode);
  });
}

/* ====================== Erinnerungen ====================== */
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}
function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const k = todayKey();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let fired;
  try { fired = JSON.parse(localStorage.getItem(NOTIF_STORE) || '{}'); } catch { fired = {}; }
  for (const it of S.dailyItems) {
    if (it.reminder === null || it.reminder === undefined) continue;
    if (!occursOn(it, k)) continue;
    const fireAt = it.start - it.reminder;
    const key = `${it.id}:${k}`;
    if (nowMin >= fireAt && nowMin < it.start + 1 && !fired[key]) {
      fired[key] = 1;
      new Notification(it.title || 'Ereignis', { body: `${fmtTime(it.start)}–${fmtTime(it.end)}`, icon: 'icon-192.png' });
    }
  }
  localStorage.setItem(NOTIF_STORE, JSON.stringify(fired));
}
