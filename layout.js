/* ============================================================
   layout.js — Bereichsberechnung, Lane-Packing, Geometrie
   Reine Funktionen über S; kein DOM-Schreiben außer Maßen.
   ============================================================ */
'use strict';

let DAYS = [];                  // Array der Day-Keys im sichtbaren Bereich
let DAY_IDX = {};               // key -> index

function recomputeRange() {
  let s = S.settings.rangeStart, e = S.settings.rangeEnd;
  /* Bereich wächst automatisch, falls Daten außerhalb liegen */
  const allDays = [
    ...S.phases.flatMap(p => [p.s, addDays(p.t, -1)]),
    ...S.exams.map(x => x.day),
    ...S.dailyItems.map(d => d.day),
    ...S.projects.flatMap(p => p.milestones.map(m => m.day)),
  ];
  for (const d of allDays) { if (d < s) s = d; if (d > e) e = d; }
  if (diffDays(s, e) < 13) e = addDays(s, 13);
  DAYS = []; DAY_IDX = {};
  for (let k = s; k <= e; k = addDays(k, 1)) { DAY_IDX[k] = DAYS.length; DAYS.push(k); }
}

function dayX(key)  { return (DAY_IDX[key] ?? clampIdx(key)) * TL_DAY_W; }       // Timeline-x
function clampIdx(key) { return key < DAYS[0] ? 0 : DAYS.length; }
function tlWidth()  { return DAYS.length * TL_DAY_W; }

/* Daily-Geometrie: Tagesbreite aus Dichte */
function dailyDayW() {
  const outer = document.getElementById('dayOuter');
  const avail = (outer ? outer.clientWidth : 900) - RAIL_W;
  return Math.max(120, Math.floor(avail / S.settings.density));
}
function minToY(min) { return (min - DAY_START_MIN) / 60 * HOUR_H; }
function yToMin(y)   { return clamp(snapMin(DAY_START_MIN + y / HOUR_H * 60), DAY_START_MIN, DAY_END_MIN); }
function gridH()     { return (DAY_END_MIN - DAY_START_MIN) / 60 * HOUR_H; }

/* Lane-Packing: überlappende Phasen in Reihen verteilen (greedy, stabil) */
function packLanes(items, startOf, endOf) {
  const lanes = [];               // lanes[i] = letztes Ende in dieser Lane
  const out = [];
  const sorted = [...items].sort((a, b) => startOf(a) < startOf(b) ? -1 : 1);
  for (const it of sorted) {
    let lane = lanes.findIndex(end => end <= startOf(it));
    if (lane === -1) { lane = lanes.length; lanes.push(''); }
    lanes[lane] = endOf(it);
    out.push({ item: it, lane });
  }
  return { placed: out, laneCount: lanes.length };
}

/* Überlappungs-Spalten für Daily-Events innerhalb eines Tages */
function packDayColumns(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const cols = [];                // cols[i] = Endzeit
  const out = [];
  for (const it of sorted) {
    let c = cols.findIndex(end => end <= it.start);
    if (c === -1) { c = cols.length; cols.push(0); }
    cols[c] = it.end;
    out.push({ item: it, col: c });
  }
  /* Gruppenbreite: max. gleichzeitige Spalten je Cluster */
  for (const o of out) {
    o.of = 1;
    for (const p of out) {
      if (p.item.start < o.item.end && p.item.end > o.item.start) o.of = Math.max(o.of, p.col + 1);
    }
  }
  return out;
}

/* Alle Vorkommen eines Daily-Items im Bereich (für Budget + Rendering) */
function occurrencesInRange(item, fromK, toK) {
  const res = [];
  for (let k = fromK < item.day ? item.day : fromK; k <= toK; k = addDays(k, 1)) {
    if (occursOn(item, k)) res.push(k);
    if (item.repeat === 'none' || !item.repeat) break;
  }
  return res;
}
