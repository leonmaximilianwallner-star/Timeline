// Tests for data/merge.js — how the plan and the server's copy meet.
// Run from the repo root:  node tests/merge.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = {};
vm.runInNewContext(['data/changes.js', 'data/merge.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { toRow, rowsToSend, applyRows, planFromRows };', Object.assign(box, { DATA_VERSION: 5 }));
const { rowsToSend, applyRows, planFromRows } = box.f;
const copy = x => JSON.parse(JSON.stringify(x));
const T1 = '2026-10-21T10:00:00.000Z', T2 = '2026-10-21T11:00:00.000Z', T3 = '2026-10-21T12:00:00.000Z';

const plan = () => ({
  categories: [], phases: [], milestones: [],
  events: [{ id: 'e1', title: 'Tutorium', updatedAt: T2 }],
  deleted: {},
});
const row = (o) => ({ id: 'e1', list: 'events', data: { id: 'e1', title: 'Tutorium (Raum 3)' }, updated_at: T3, deleted: false, ...o });

const tests = {
  'a newer row from the server replaces the local record'() {
    const p = plan();
    assert.equal(applyRows(p, [row()]), true);
    assert.deepEqual(copy(p.events), [{ id: 'e1', title: 'Tutorium (Raum 3)', updatedAt: T3 }]);
  },
  'an older row from the server is ignored (ours goes up next time)'() {
    const p = plan();
    assert.equal(applyRows(p, [row({ updated_at: T1 })]), false);
    assert.equal(p.events[0].title, 'Tutorium');
  },
  'a new record from the server is added'() {
    const p = plan();
    applyRows(p, [row({ id: 'e2', data: { id: 'e2', title: 'Bachata' } })]);
    assert.equal(p.events.length, 2);
  },
  'a deletion from the server removes an older local record and is remembered'() {
    const p = plan();
    applyRows(p, [row({ deleted: true, data: {} })]);
    assert.equal(p.events.length, 0);
    assert.deepEqual(copy(p.deleted), { e1: { in: 'events', at: T3 } });
  },
  'a local record changed after the server-side deletion survives'() {
    const p = plan();
    applyRows(p, [row({ deleted: true, data: {}, updated_at: T1 })]);
    assert.equal(p.events.length, 1);
    assert.deepEqual(copy(p.deleted), {});
  },
  'a record deleted here after the server last changed it does not come back'() {
    const p = plan(); p.events = []; p.deleted = { e1: { in: 'events', at: T3 } };
    applyRows(p, [row({ updated_at: T2 })]);
    assert.equal(p.events.length, 0);
  },
  'a record changed on the server after we deleted it comes back'() {
    const p = plan(); p.events = []; p.deleted = { e1: { in: 'events', at: T1 } };
    applyRows(p, [row({ updated_at: T3 })]);
    assert.equal(p.events.length, 1);
    assert.deepEqual(copy(p.deleted), {});
  },
  'rowsToSend sends what changed after the last send, deletions included'() {
    const p = plan();
    p.phases = [{ id: 'p1', title: 'Schreiben', updatedAt: T1 }];
    p.deleted = { x1: { in: 'milestones', at: T3 } };
    const rows = rowsToSend(p, T1);
    assert.deepEqual(copy(rows.map(r => [r.id, r.deleted])), [['e1', false], ['x1', true]]);
    assert.equal(rows[0].data.updatedAt, undefined);      // the stamp travels as updated_at, not inside data
    assert.equal(rows[0].updated_at, T2);
  },
  'rowsToSend with no last send sends everything'() {
    assert.equal(rowsToSend(plan(), null).length, 1);
  },
  'a round trip keeps a record exactly'() {
    const p = plan();
    p.events[0] = { id: 'e1', title: 'Tutorium', todosByDate: { '2026-10-21': [{ id: 't', text: 'x', state: 'done' }] }, updatedAt: T2 };
    const back = planFromRows(rowsToSend(p, null));
    assert.deepEqual(copy(back.events), copy(p.events));
  },
  'rows of a list this version does not know are left alone'() {
    const p = plan();
    assert.equal(applyRows(p, [row({ list: 'ideas', id: 'i1' })]), false);
    assert.equal(p.ideas, undefined);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
}
console.log(failed ? `\n${failed} merge test(s) FAILED` : '\nMerge tests passed.');
process.exit(failed ? 1 : 0);
