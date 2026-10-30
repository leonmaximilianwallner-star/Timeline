// Actuals: which planned event "record" means, stopping, and that plan and actual pack in separate layers.
// Run from the repo root:  node tests/actuals.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = { SNAP: 15, HOUR_START: 0, HOUR_END: 24, DATA_VERSION: 7 };
vm.runInNewContext(['core/dates.js', 'core/repeat.js', 'core/actuals.js', 'data/changes.js', 'data/merge.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { runningActual, actualEnd, recordCandidates, newActual, stopActual, actualsOn, hasActual, packOverlaps, stampChanges, rowsToSend, planFromRows, RECORD_LEAD };', box);
const f = box.f;
const T = '2026-10-30';                       // a Friday
const h = (hh, mm = 0) => hh * 60 + mm;
const events = [
  { id: 'write',  title: 'Schreiben', categoryId: 'seminar', date: T, startMin: h(13), endMin: h(14), repeat: 'none' },
  { id: 'tut',    title: 'Tutorium',  categoryId: 'work',    date: '2026-10-23', startMin: h(13, 30), endMin: h(15), repeat: 'weekly' },
  { id: 'other',  title: 'Morgen',    categoryId: null,      date: '2026-10-31', startMin: h(13), endMin: h(14), repeat: 'none' },
];
const ids = list => list.map(x => x.id);

const tests = {
  'record at 13:15: the event that started 15 min ago comes first, an overlapping series occurrence second'() {
    assert.deepEqual(ids(f.recordCandidates(events, T, h(13, 15))), ['write', 'tut']);
  },
  'up to RECORD_LEAD before a start counts; earlier does not'() {
    assert.deepEqual(ids(f.recordCandidates(events, T, h(13) - f.RECORD_LEAD)), ['write']);
    assert.deepEqual(ids(f.recordCandidates(events, T, h(13) - f.RECORD_LEAD - 1)), []);
  },
  'after the planned end, nothing is assumed'() {
    assert.deepEqual(ids(f.recordCandidates(events, T, h(15))), []);
  },
  'other days do not count'() {
    assert.ok(!ids(f.recordCandidates(events, T, h(13, 10))).includes('other'));
  },
  'a new actual names its plan and that day; without a plan, both are null and it is frei'() {
    const a = f.newActual(events[1], T, h(13, 40), 'x');
    assert.deepEqual({ ...a }, { id: 'x', date: T, startMin: h(13, 40), endMin: null, eventId: 'tut', occurrence: T, categoryId: 'work' });
    const b = f.newActual(null, T, h(9), 'y');
    assert.equal(b.eventId, null); assert.equal(b.occurrence, null); assert.equal(b.categoryId, null);
  },
  'stopping ends the running one at now'() {
    const plan = { actuals: [f.newActual(events[0], T, h(13, 15), 'a')] };
    assert.equal(f.stopActual(plan, T, h(14, 20)), 'stopped');
    assert.equal(plan.actuals[0].endMin, h(14, 20));
    assert.equal(f.runningActual(plan.actuals), null);
    assert.equal(f.stopActual(plan, T, h(15)), null);          // nothing running
  },
  'an accidental tap (under a minute) leaves nothing behind'() {
    const plan = { actuals: [f.newActual(null, T, h(10), 'a')] };
    assert.equal(f.stopActual(plan, T, h(10)), 'dropped');
    assert.equal(plan.actuals.length, 0);
  },
  'one left running past midnight ends with its own day'() {
    const plan = { actuals: [f.newActual(null, '2026-10-29', h(23), 'a')] };
    assert.equal(f.actualEnd(plan.actuals[0], T, h(1)), h(24));
    f.stopActual(plan, T, h(1));
    assert.equal(plan.actuals[0].endMin, h(24));
  },
  'a running one is drawn to now, never shorter than a minute'() {
    const a = f.newActual(null, T, h(9), 'a');
    assert.equal(f.actualEnd(a, T, h(9, 42)), h(9, 42));
    assert.equal(f.actualEnd(a, T, h(9)), h(9) + 1);
  },
  'two actuals for one plan (interrupted work); the plan knows it has an actual on that day only'() {
    const list = [{ ...f.newActual(events[1], T, h(13, 40), 'a'), endMin: h(14) }, { ...f.newActual(events[1], T, h(14, 30), 'b'), endMin: h(15) }];
    assert.deepEqual(ids(f.actualsOn(list, T)), ['a', 'b']);
    assert.ok(f.hasActual(list, 'tut', T));
    assert.ok(!f.hasActual(list, 'tut', '2026-11-06'));
    assert.ok(!f.hasActual(list, 'write', T));
  },
  'packing: overlapping things share a group, side by side; separate layers never meet'() {
    const plans = f.packOverlaps([{ s: h(13), e: h(14) }, { s: h(13, 30), e: h(15) }, { s: h(16), e: h(17) }]);
    assert.deepEqual(plans.map(o => [o.col, o.cols]), [[0, 2], [1, 2], [0, 1]]);
    const actuals = f.packOverlaps([{ s: h(13, 15), e: h(14, 20) }]);    // packed alone: full width, not beside its plan
    assert.deepEqual(actuals.map(o => [o.col, o.cols]), [[0, 1]]);
  },
  'an actual is a record: stamped, sent and received like the rest'() {
    const before = { categories: [], phases: [], milestones: [], events: [], dayTodos: [], actuals: [], deleted: {} };
    const after = { ...before, actuals: [f.newActual(null, T, h(9), 'x')], deleted: {} };
    f.stampChanges(before, after, '2026-10-30T10:00:00.000Z');
    assert.equal(after.actuals[0].updatedAt, '2026-10-30T10:00:00.000Z');
    const rows = f.rowsToSend(after, null);
    assert.ok(rows.some(r => r.list === 'actuals' && r.id === 'x'));
    const back = f.planFromRows(rows.map(r => ({ ...r, deleted: false })));
    assert.equal(back.actuals[0].id, 'x');
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok  ', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); }
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
