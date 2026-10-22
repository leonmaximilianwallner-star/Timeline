// Deleting from a repeating event: one occurrence, or this one and every later one; and moving a series.
// Run from the repo root:  node tests/series.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = { SNAP: 15, HOUR_START: 0, HOUR_END: 24 };
vm.runInNewContext(['core/dates.js', 'core/repeat.js', 'core/todos.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { occursOn, deleteOccurrence, shiftSeries, todosOf };', box);
const { occursOn, deleteOccurrence, shiftSeries, todosOf } = box.f;
const copy = x => JSON.parse(JSON.stringify(x));
/* a weekly Wednesday series from 21 Oct, with todos on two days */
const plan = () => ({ events: [{ id: 'e', title: 'Tutorium', date: '2026-10-21', repeat: 'weekly', startMin: 540, endMin: 660,
  todosByDate: { '2026-10-21': [{ id: 'a', text: 'A', state: 'done' }], '2026-11-04': [{ id: 'b', text: 'B', state: 'open' }] } }] });
const on = (s, d) => occursOn(s.events[0], d);

const tests = {
  'deleting one occurrence leaves out that day only'() {
    const s = plan();
    assert.equal(deleteOccurrence(s, 'e', '2026-10-28', false), 'one');
    assert.deepEqual([on(s, '2026-10-21'), on(s, '2026-10-28'), on(s, '2026-11-04')], [true, false, true]);
    assert.deepEqual(copy(s.events[0].except), ['2026-10-28']);
  },
  'deleting one occurrence drops that day’s todos, not the others'() {
    const s = plan();
    deleteOccurrence(s, 'e', '2026-11-04', false);
    assert.deepEqual(Object.keys(s.events[0].todosByDate), ['2026-10-21']);
  },
  'deleting the same day twice stores it once'() {
    const s = plan();
    deleteOccurrence(s, 'e', '2026-10-28', false); deleteOccurrence(s, 'e', '2026-10-28', false);
    assert.equal(s.events[0].except.length, 1);
  },
  'deleting this and the following ends the series the day before'() {
    const s = plan();
    assert.equal(deleteOccurrence(s, 'e', '2026-11-04', true), 'following');
    assert.equal(s.events[0].end, '2026-11-04');                                // exclusive, as every stored end
    assert.deepEqual([on(s, '2026-10-28'), on(s, '2026-11-04'), on(s, '2026-12-02')], [true, false, false]);
    assert.deepEqual(Object.keys(s.events[0].todosByDate), ['2026-10-21']);       // later todos go with their days
  },
  'this and the following also forgets removed days after the cut'() {
    const s = plan();
    deleteOccurrence(s, 'e', '2026-10-28', false); deleteOccurrence(s, 'e', '2026-11-18', false);
    deleteOccurrence(s, 'e', '2026-11-11', true);
    assert.deepEqual(copy(s.events[0].except), ['2026-10-28']);
  },
  'this and the following from the first occurrence deletes the whole series'() {
    const s = plan();
    assert.equal(deleteOccurrence(s, 'e', '2026-10-21', true), 'all');
    assert.equal(s.events.length, 0);
  },
  'a deleted day does not carry its postponed todos: the carry comes from the occurrence before'() {
    const s = plan();
    s.events[0].todosByDate['2026-10-21'] = [{ id: 'p', text: 'Frage', state: 'postponed' }];
    deleteOccurrence(s, 'e', '2026-10-28', false);
    assert.deepEqual(copy(todosOf(s.events[0], '2026-11-04')).map(t => t.text), ['B']);   // 4 Nov has its own todos
    delete s.events[0].todosByDate['2026-11-04'];
    assert.deepEqual(copy(todosOf(s.events[0], '2026-11-04')).map(t => t.text), ['Frage']); // carried past the deleted day
  },
  'moving a series moves its removed days and its end with it'() {
    const s = plan();
    deleteOccurrence(s, 'e', '2026-10-28', false); deleteOccurrence(s, 'e', '2026-11-18', true);
    shiftSeries(s.events[0], 1);                                                  // to Thursdays
    const e = s.events[0];
    assert.deepEqual([e.date, e.end, copy(e.except)], ['2026-10-22', '2026-11-19', ['2026-10-29']]);
    assert.deepEqual([on(s, '2026-10-29'), on(s, '2026-11-05'), on(s, '2026-11-19')], [false, true, false]);
    assert.deepEqual(Object.keys(e.todosByDate).sort(), ['2026-10-22', '2026-11-05']);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
}
console.log(failed ? `\n${failed} series test(s) FAILED` : '\nSeries tests passed.');
process.exit(failed ? 1 : 0);
