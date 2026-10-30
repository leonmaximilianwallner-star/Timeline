// data/changes.js — notices what changed, so sync can send only that (ARCHITECTURE.md §5, step 3).
"use strict";
/* ════════════════════════════════════════════════════════════
   Every record (one category, phase, milestone, event, day todo or actual) carries `updatedAt`:
   when it last changed. After each change, stampChanges() compares the data
   before and after, record by record, and stamps what differs.
   A record that disappears is remembered in `deleted` (id → { in, at }),
   so a device that was offline can't bring it back. A record that comes
   back (undo) is stamped again and leaves `deleted`.
   Pure: no screen, no storage. Tested in tests/changes.test.mjs.
   ════════════════════════════════════════════════════════════ */
const RECORD_LISTS = ["categories", "phases", "milestones", "events", "dayTodos", "actuals"];

/* a record's content, without its stamp — two records are "the same" when this matches */
function recordContent(record){
  return JSON.stringify(record, (key, value) => key === "updatedAt" ? undefined : value);
}

function stampChanges(before, after, now){
  after.deleted = after.deleted || {};
  RECORD_LISTS.forEach(list => {
    const old = new Map((before[list] || []).map(r => [r.id, recordContent(r)]));
    const kept = new Set();
    (after[list] || []).forEach(r => {
      kept.add(r.id);
      if(old.get(r.id) !== recordContent(r) || !r.updatedAt) r.updatedAt = now;   // new or changed
      if(after.deleted[r.id]){ delete after.deleted[r.id]; r.updatedAt = now; }   // back again (undo)
    });
    old.forEach((_, id) => { if(!kept.has(id)) after.deleted[id] = { in: list, at: now }; });
  });
}
