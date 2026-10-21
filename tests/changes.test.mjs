// Tests for data/changes.js — what counts as a change (ARCHITECTURE.md §5, step 3).
// Run from the repo root:  node tests/changes.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// data/changes.js is a classic script; run it in a sandbox and take its function from there.
const box = {};
vm.runInNewContext(readFileSync('data/changes.js', 'utf8') + '\nthis.stampChanges = stampChanges;', box);
const { stampChanges } = box;

const T1 = '2026-10-21T10:00:00.000Z', T2 = '2026-10-21T11:00:00.000Z';
const copy = x => JSON.parse(JSON.stringify(x));
const base = () => ({
  categories: [{ id: 'c1', name: 'Arbeit', updatedAt: T1 }],
  phases: [{ id: 'p1', title: 'Schreiben', updatedAt: T1 }],
  exams: [],
  events: [{ id: 'e1', title: 'Tutorium', todos: [], updatedAt: T1 }, { id: 'e2', title: 'Bachata', todos: [], updatedAt: T1 }],
  deleted: {},
});

const tests = {
  'an unchanged record keeps its stamp'() {
    const before = base(), after = copy(before);
    stampChanges(before, after, T2);
    assert.equal(after.events[0].updatedAt, T1);
    assert.deepEqual(copy(after.deleted), {});
  },
  'a changed record is stamped, its neighbours are not'() {
    const before = base(), after = copy(before);
    after.events[0].title = 'Tutorium (Raum 3)';
    stampChanges(before, after, T2);
    assert.equal(after.events[0].updatedAt, T2);
    assert.equal(after.events[1].updatedAt, T1);
  },
  'a change deep inside a record counts (a ticked todo)'() {
    const before = base();
    before.events[0].todos = [{ id: 't1', text: 'Folien', state: 'open' }];
    const after = copy(before);
    after.events[0].todos[0].state = 'done';
    stampChanges(before, after, T2);
    assert.equal(after.events[0].updatedAt, T2);
  },
  'a new record is stamped'() {
    const before = base(), after = copy(before);
    after.phases.push({ id: 'p2', title: 'Folien' });
    stampChanges(before, after, T2);
    assert.equal(after.phases[1].updatedAt, T2);
  },
  'a deleted record is remembered, with its list and time'() {
    const before = base(), after = copy(before);
    after.events = after.events.filter(e => e.id !== 'e2');
    stampChanges(before, after, T2);
    assert.deepEqual(copy(after.deleted), { e2: { in: 'events', at: T2 } });
  },
  'a record that comes back (undo) is stamped and leaves "deleted"'() {
    const withRecord = base();
    const without = copy(withRecord);
    without.events = without.events.filter(e => e.id !== 'e2');
    without.deleted = { e2: { in: 'events', at: T1 } };
    const restored = copy(withRecord);
    restored.deleted = { e2: { in: 'events', at: T1 } };   // even if the old "deleted" entry came along
    stampChanges(without, restored, T2);
    assert.equal(restored.events[1].updatedAt, T2);
    assert.deepEqual(copy(restored.deleted), {});
  },
  'only the stamp differing is not a change'() {
    const before = base(), after = copy(before);
    after.events[0].updatedAt = '2020-01-01T00:00:00.000Z';
    stampChanges(before, after, T2);
    assert.equal(after.events[0].updatedAt, '2020-01-01T00:00:00.000Z');
  },
  'a milestone inside a category stamps the category'() {
    const before = base();
    before.categories[0].milestones = [{ id: 'm1', label: 'Abgabe', date: '2026-11-01' }];
    const after = copy(before);
    after.categories[0].milestones[0].date = '2026-11-02';
    stampChanges(before, after, T2);
    assert.equal(after.categories[0].updatedAt, T2);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
}
console.log(failed ? `\n${failed} change test(s) FAILED` : '\nChange tests passed.');
process.exit(failed ? 1 : 0);
