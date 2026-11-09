// What belongs to what: an event in a phase, the phase's progress, and the link's loose ends.
// Run from the repo root:  node tests/hierarchy.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = { SNAP: 15, HOUR_START: 0, HOUR_END: 24 };
vm.runInNewContext(['core/dates.js', 'core/repeat.js', 'core/todos.js', 'core/hierarchy.js', 'data/changes.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { phaseOf, phaseOccurrences, occurrenceDone, phaseProgress, phaseChoices, freeChildren, carryCategory, stampChanges };', box);
const { phaseOf, phaseOccurrences, occurrenceDone, phaseProgress, phaseChoices, freeChildren, carryCategory, stampChanges } = box.f;

const T = '2026-11-10';   // a Tuesday
const todo = (state) => ({ id: Math.random().toString(36).slice(2), text: 'x', state });
const plan = () => ({
  phases: [
    { id: 'p1', title: 'Schreiben', categoryId: 'seminar', start: '2026-11-09', end: '2026-11-23' },   // two weeks, Mo 9 – So 22
    { id: 'p2', title: 'Folien', categoryId: 'seminar', start: '2026-11-23', end: '2026-12-07' },
    { id: 'old', title: 'Vorbei', categoryId: 'work', start: '2026-10-01', end: '2026-10-15' },
  ],
  events: [
    { id: 'a', title: 'Block', categoryId: 'seminar', date: '2026-11-09', startMin: 780, endMin: 960, repeat: 'none', parentId: 'p1',
      todosByDate: { '2026-11-09': [todo('done'), todo('cancelled')] } },
    { id: 'b', title: 'Lesen', categoryId: 'seminar', date: '2026-11-12', startMin: 600, endMin: 660, repeat: 'none', parentId: 'p1',
      todosByDate: { '2026-11-12': [todo('done'), todo('open')] } },
    { id: 'w', title: 'Weekly', categoryId: 'seminar', date: '2026-11-02', startMin: 540, endMin: 600, repeat: 'weekly', parentId: 'p1', todosByDate: {} },
    { id: 'free', title: 'Zahnarzt', categoryId: null, date: '2026-11-10', startMin: 480, endMin: 540, repeat: 'none', todosByDate: {} },
    { id: 'gone', title: 'Waise', categoryId: 'seminar', date: '2026-11-10', startMin: 480, endMin: 540, repeat: 'none', parentId: 'deleted-elsewhere', todosByDate: {} },
  ],
});

const tests = {
  'an event knows its phase; none, or a link to a deleted phase, reads as none'() {
    const p = plan();
    assert.equal(phaseOf(p, p.events[0]).id, 'p1');
    assert.equal(phaseOf(p, p.events[3]), null);
    assert.equal(phaseOf(p, p.events[4]), null);
  },
  'a phase lists its events by day and time; a series only on its days inside the span'() {
    const occ = [...phaseOccurrences(plan(), plan().phases[0])].map(o => o.ev.id + '@' + o.day);
    assert.deepEqual(occ, ['w@2026-11-09', 'a@2026-11-09', 'b@2026-11-12', 'w@2026-11-16']);   // weekly Mondays 9 and 16, not 2 or 23
  },
  'an occurrence is done when its counted todos are; cancelled ones do not count'() {
    const p = plan();
    assert.equal(occurrenceDone(p.events[0], '2026-11-09', T), true);    // done + cancelled
    assert.equal(occurrenceDone(p.events[1], '2026-11-12', T), false);   // one open
  },
  'without todos it is done once its day is over'() {
    const w = plan().events[2];
    assert.equal(occurrenceDone(w, '2026-11-09', T), true);
    assert.equal(occurrenceDone(w, '2026-11-10', T), false);   // today: not yet
    assert.equal(occurrenceDone(w, '2026-11-16', T), false);
  },
  'the phase progress: equal weight per occurrence'() {
    assert.deepEqual({ ...phaseProgress(plan(), plan().phases[0], T) }, { done: 2, total: 4 });
    assert.deepEqual({ ...phaseProgress(plan(), plan().phases[1], T) }, { done: 0, total: 0 });
  },
  'the editor offers the phases on the day first, then those not over; the current one always'() {
    const c = phaseChoices(plan(), '2026-11-10', T, null);
    assert.deepEqual([...c.onDay].map(p => p.id), ['p1']);
    assert.deepEqual([...c.later].map(p => p.id), ['p2']);
    assert.deepEqual([...phaseChoices(plan(), '2026-11-10', T, 'old').later].map(p => p.id), ['old', 'p2']);
  },
  'deleting a phase frees its events and deletes none of them'() {
    const p = plan(); freeChildren(p, 'p1');
    assert.equal(p.events.length, 5);
    assert.equal(p.events.filter(e => e.parentId === 'p1').length, 0);
  },
  'a recoloured phase takes its events along; others stay'() {
    const p = plan(); carryCategory(p, 'p1', 'work');
    assert.deepEqual(p.events.map(e => e.categoryId), ['work', 'work', 'work', null, 'seminar']);
  },
  'the link is a change like any other: linking stamps the event, so it syncs'() {
    const before = { categories: [], phases: [], milestones: [], events: [{ id: 'e', title: 't', date: T, todosByDate: {} }], deleted: {} };
    const after = JSON.parse(JSON.stringify(before)); after.events[0].parentId = 'p1';
    stampChanges(before, after, '2026-11-10T10:00:00.000Z');
    assert.equal(after.events[0].updatedAt, '2026-11-10T10:00:00.000Z');
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall hierarchy tests pass');
