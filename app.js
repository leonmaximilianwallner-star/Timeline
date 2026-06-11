/* ============================================================
   app.js — Bootstrap. Lädt, entscheidet Landing-View,
   verdrahtet Toolbar, registriert Service Worker.
   ============================================================ */
'use strict';

function boot() {
  loadFromStorage();
  recomputeRange();
  renderAll();
  initTimelineInput();
  initDailyInput();
  initKeyboard();

  /* Toolbar */
  $('fab').addEventListener('click', () => setAddMode(!addMode));
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnBudget').addEventListener('click', openBudget);
  $('btnSettings').addEventListener('click', () => toggleSettings());
  $('settingsBackdrop').addEventListener('pointerdown', () => toggleSettings(false));
  $('btnSync').addEventListener('click', () => conflict ? resolveConflict() : pullGist(true));

  /* Deterministische Landing-View: Daily wenn Events existieren, sonst Timeline */
  requestAnimationFrame(() => {
    scrollToToday();
    if (S.dailyItems.length) $('dailySection').scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  });

  /* Daily neu layouten bei Resize (Tagesbreite hängt am Container) */
  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(renderDaily, 150); });

  /* Cloud-Pull beim Start (newest-wins), Erinnerungs-Loop */
  pullGist(false);
  setInterval(checkReminders, 30000);
  checkReminders();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function scrollToToday() {
  const t = todayKey();
  if (DAY_IDX[t] === undefined) return;
  const tl = $('tlOuter');
  tl.scrollLeft = Math.max(0, dayX(t) - tl.clientWidth / 2);
  const dOuter = $('dayOuter');
  dOuter.scrollLeft = Math.max(0, RAIL_W + DAY_IDX[t] * dailyDayW() - dOuter.clientWidth / 2);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  dOuter.scrollTop = Math.max(0, minToY(clamp(nowMin, DAY_START_MIN, DAY_END_MIN)) - 120);
}

document.addEventListener('DOMContentLoaded', boot);
