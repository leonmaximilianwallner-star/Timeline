// Todos of a day, without an event: which a day shows, its dots; and that they sync like every record.
// Run from the repo root:  node tests/day-todos.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = { SNAP: 15, HOUR_START: 0, HOUR_END: 24, DATA_VERSION: 6 };
vm.runInNewContext(['core/dates.js', 'core/repeat.js', 'core/todos.js', 'data/changes.js', 'data/merge.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { dayTodosOn, dayTodoCategories, rowsToSend, planFromRows, stampChanges };', box);
const { dayTodosOn, dayTodoCategories, rowsToSend, planFromRows, stampChanges } = box.f;
const ids = list => [...list].map(t => t.id);
const T = '2026-10-29';
const plan = () => ({ dayTodos: [
  { id: 'a', text: 'Folien', state: 'open', date: T, categoryId: 'work' },
  { id: 'b', text: 'Anrufen', state: 'done', date: T, categoryId: 'personal' },
  { id: 'c', text: 'Abgabe vorbereiten', state: 'open', date: '2026-10-27', categoryId: 'seminar' },
  { id: 'd', text: 'Erledigt', state: 'done', date: '2026-10-27', categoryId: null },
  { id: 'e', text: 'Später', state: 'postponed', date: '2026-10-26', categoryId: null },
  { id: 'f', text: 'Morgen', state: 'open', date: '2026-10-30', categoryId: 'work' },
] });

const tests = {
  'a day shows its own todos'() {
    assert.deepEqual(ids(dayTodosOn(plan(), '2026-10-30', T)), ['f']);
    assert.deepEqual(ids(dayTodosOn(plan(), '2026-10-27', T)), ['c', 'd']);   // a past day keeps its own, done or not
  },
  'today also shows the open ones of past days, oldest first; done ones stay behind'() {
    assert.deepEqual(ids(dayTodosOn(plan(), T, T)), ['a', 'b', 'e', 'c']);
  },
  'the dots: the categories of the open todos, once each; frei counts too'() {
    assert.deepEqual([...dayTodoCategories(plan(), T, T)], ['work', null, 'seminar']);
    assert.deepEqual([...dayTodoCategories(plan(), '2026-10-27', T)], ['seminar']);
    assert.deepEqual([...dayTodoCategories(plan(), '2026-10-31', T)], []);
  },
  'a day todo is a record: stamped when changed, sent, deleted like the rest'() {
    const before = { categories: [], phases: [], milestones: [], events: [], dayTodos: [], deleted: {} };
    const after = { ...before, dayTodos: [{ id: 'x', text: 'Neu', state: 'open', date: T, categoryId: null }], deleted: {} };
    stampChanges(before, after, '2026-10-29T10:00:00.000Z');
    assert.equal(after.dayTodos[0].updatedAt, '2026-10-29T10:00:00.000Z');
    const rows = rowsToSend(after, null);
    assert.deepEqual([...rows].map(r => [r.list, r.id]), [['dayTodos', 'x']]);
    assert.equal(planFromRows(rows).dayTodos[0].text, 'Neu');
    const gone = { ...after, dayTodos: [], deleted: {} };
    stampChanges(after, gone, '2026-10-29T11:00:00.000Z');
    assert.equal(gone.deleted.x.in, 'dayTodos');
  },
};
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
}
console.log(failed ? `\n${failed} day-todo test(s) FAILED` : '\nDay-todo tests passed.');
process.exit(failed ? 1 : 0);
