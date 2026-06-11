/* ============================================================
   state.js — zentraler State, persist()-Gate, Undo/Redo
   Einzige Stelle, an der gespeichert wird. renderAll() ist
   vollständig von Persistenz entkoppelt.
   ============================================================ */
'use strict';

let S = defaultData();          // wird in sync.js durch geladene Daten ersetzt
let dataDirty = false;          // erst nach erster echter Mutation darf gepusht werden
let conflict = false;           // Konflikt-Guard: remote neuer als lokal

const undoStack = [];
const redoStack = [];

function snap() {               // vor jeder Mutation aufrufen
  undoStack.push(JSON.stringify({
    categories: S.categories, projects: S.projects, phases: S.phases,
    exams: S.exams, dailyItems: S.dailyItems, openPoints: S.openPoints,
  }));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function applySnapshot(json) {
  const d = JSON.parse(json);
  Object.assign(S, d);
  persist();
  renderAll();
}
function currentSnapshot() {
  return JSON.stringify({
    categories: S.categories, projects: S.projects, phases: S.phases,
    exams: S.exams, dailyItems: S.dailyItems, openPoints: S.openPoints,
  });
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(currentSnapshot());
  applySnapshot(undoStack.pop());
  updateUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(currentSnapshot());
  applySnapshot(redoStack.pop());
  updateUndoButtons();
}
function updateUndoButtons() {
  const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

/* Das Mutations-Gate. Jede Änderung läuft hier durch. */
let pushTimer = null;
function persist() {
  dataDirty = true;
  S.savedAt = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { console.warn('localStorage', e); }
  if (S.settings.gistId && S.settings.gistToken && !conflict) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushGist(), 1500);   // debounced push
  }
  updateSyncBadge();
}

function updateSyncBadge() {
  const b = document.getElementById('btnSync');
  if (!b) return;
  if (conflict) { b.textContent = 'Konflikt ⚠'; b.classList.add('conflict'); }
  else { b.textContent = S.settings.gistId ? 'Sync ✓' : 'Sync'; b.classList.remove('conflict'); }
}

/* ---------- bequeme Lookups ---------- */
function cat(id) { return S.categories.find(c => c.id === id) || { name: '?', color: '#90909a' }; }
function catColor(id) { return cat(id).color; }
