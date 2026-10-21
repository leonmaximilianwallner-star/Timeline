// data/merge.js — how the plan and the server's copy meet (ARCHITECTURE.md §5, step 4).
"use strict";
/* ════════════════════════════════════════════════════════════
   The server keeps one row per record:
     { id, list, data, updated_at, deleted }
   `data` is the record itself; `updated_at` is its stamp; `deleted` marks a deletion.
   The rule everywhere: the newer stamp wins. Pure: no screen, no storage, no network.
   Tested in tests/merge.test.mjs.
   ════════════════════════════════════════════════════════════ */

/* a record or a deletion → the row the server stores */
function toRow(list, record){
  const { updatedAt, ...data } = record;
  return { id: record.id, list, data, updated_at: updatedAt, deleted: false };
}
function deletionRow(id, gone){
  return { id, list: gone.in, data: {}, updated_at: gone.at, deleted: true };
}

/* everything changed on this device after `since` (a stamp; null = everything) */
function rowsToSend(plan, since){
  const rows = [];
  RECORD_LISTS.forEach(list => (plan[list] || []).forEach(r => {
    if(!since || r.updatedAt > since) rows.push(toRow(list, r));
  }));
  Object.entries(plan.deleted || {}).forEach(([id, gone]) => {
    if(!since || gone.at > since) rows.push(deletionRow(id, gone));
  });
  return rows;
}

/* applies rows from the server to the plan, in place. Returns true if anything changed. */
function applyRows(plan, rows){
  let changed = false;
  plan.deleted = plan.deleted || {};
  rows.forEach(row => {
    if(!RECORD_LISTS.includes(row.list)) return;          // a list this version doesn't know: leave it on the server
    const list = plan[row.list] = plan[row.list] || [];
    const i = list.findIndex(r => r.id === row.id);
    const local = i >= 0 ? list[i] : null;
    const goneHere = plan.deleted[row.id];
    if(row.deleted){
      if(local && local.updatedAt <= row.updated_at){ list.splice(i, 1); changed = true; }
      if(!local || local.updatedAt <= row.updated_at){
        if(!goneHere || goneHere.at < row.updated_at){ plan.deleted[row.id] = { in: row.list, at: row.updated_at }; changed = true; }
      }
      return;
    }
    if(local && local.updatedAt >= row.updated_at) return;  // ours is as new or newer: it goes up next time
    if(!local && goneHere && goneHere.at >= row.updated_at) return;   // we deleted it later
    const record = { ...row.data, id: row.id, updatedAt: row.updated_at };
    if(local) list[i] = record; else list.push(record);
    if(goneHere) delete plan.deleted[row.id];
    changed = true;
  });
  return changed;
}

/* the plan as the server has it — for a device that joins after another one already synced */
function planFromRows(rows){
  const plan = { version: DATA_VERSION, deleted: {} };
  RECORD_LISTS.forEach(list => { plan[list] = []; });
  applyRows(plan, rows);
  return plan;
}
