// What belongs to what: an event in a phase, the phase's progress, and the link's loose ends.
// Run from the repo root:  node tests/hierarchy.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = { SNAP: 15, HOUR_START: 0, HOUR_END: 24 };
vm.runInNewContext(['core/dates.js', 'core/repeat.js', 'core/todos.js', 'core/hierarchy.js', 'data/changes.js', 'data/merge.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { shiftSeries, parentOf, phaseOf, stepsOf, nextStepOrder, phaseOccurrences, stepOccurrences, eventDone, todosDone, tickEvent, stepDone, tickStep, phaseProgress, parentChoices, deleteStep, deletePhase, carryCategory, stampChanges, rowsToSend, RECORD_LISTS };', box);
const { shiftSeries, parentOf, phaseOf, stepsOf, nextStepOrder, phaseOccurrences, stepOccurrences, eventDone, todosDone, tickEvent, stepDone, tickStep, phaseProgress, parentChoices, deleteStep, deletePhase, carryCategory, stampChanges, rowsToSend, RECORD_LISTS } = box.f;

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

const withSteps = () => {
  const p = plan();
  p.steps = [
    { id: 's2', title: 'Quellen', parentId: 'p1', order: 2 },
    { id: 's1', title: 'Gliederung', parentId: 'p1', order: 1 },
  ];
  p.events.push({ id: 's1e', title: 'Gliederung', categoryId: 'seminar', date: '2026-11-11', startMin: 540, endMin: 600, repeat: 'none', parentId: 's1',
    todosByDate: { '2026-11-11': [todo('open')] } });
  return p;
};

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
  'an occurrence with todos is done when every counted one is; cancelled ones do not count'() {
    const p = plan();
    assert.equal(eventDone(p.events[0], '2026-11-09'), true);    // done + cancelled
    assert.equal(eventDone(p.events[1], '2026-11-12'), false);   // one open
  },
  'without todos to count it is ticked by hand, per occurrence; a past day alone is not done'() {
    const w = plan().events[2];
    assert.equal(eventDone(w, '2026-11-09'), false);             // over, but nobody said so
    tickEvent(w, '2026-11-09', true);
    assert.equal(eventDone(w, '2026-11-09'), true);
    assert.equal(eventDone(w, '2026-11-16'), false);             // next week's stays open
    tickEvent(w, '2026-11-09', false);
    assert.equal(w.doneByDate, undefined, 'unticked: nothing left stored');
  },
  'all todos cancelled counts as none: the hand tick decides'() {
    assert.equal(todosDone([todo('cancelled')]), null);
    assert.equal(todosDone([]), null);
    assert.equal(todosDone([todo('done'), todo('postponed')]), false);
  },
  'with todos to count, a hand tick is ignored: the children decide'() {
    const b = plan().events[1]; tickEvent(b, '2026-11-12', true);
    assert.equal(eventDone(b, '2026-11-12'), false);
  },
  'the phase progress: equal weight per occurrence'() {
    const p = plan();
    assert.deepEqual({ ...phaseProgress(p, p.phases[0]) }, { done: 1, total: 4 });
    tickEvent(p.events[2], '2026-11-09', true);
    assert.deepEqual({ ...phaseProgress(p, p.phases[0]) }, { done: 2, total: 4 });
    assert.deepEqual({ ...phaseProgress(p, p.phases[1]) }, { done: 0, total: 0 });
  },
  'a moved series takes its hand ticks along'() {
    const w = plan().events[2]; tickEvent(w, '2026-11-09', true);
    shiftSeries(w, 1);
    assert.deepEqual({ ...w.doneByDate }, { '2026-11-10': true });
  },



  'a step belongs to its phase; an event under a step sits in that phase too'() {
    const p = withSteps();
    assert.equal(parentOf(p, p.events.find(e => e.id === 's1e')).id, 's1');
    assert.equal(phaseOf(p, p.events.find(e => e.id === 's1e')).id, 'p1');
    assert.deepEqual([...stepsOf(p, p.phases[0])].map(x => x.id), ['s1', 's2'], 'in their order');
    assert.equal(nextStepOrder(p, 'p1'), 3);
  },
  'a step is done by its events; without any, by its hand tick'() {
    const p = withSteps(), s1 = p.steps.find(x => x.id === 's1'), s2 = p.steps.find(x => x.id === 's2');
    assert.equal(stepDone(p, s1), false);                        // its event has an open todo
    p.events.find(e => e.id === 's1e').todosByDate['2026-11-11'][0].state = 'done';
    assert.equal(stepDone(p, s1), true);
    assert.equal(stepDone(p, s2), false);
    tickStep(s2, true); assert.equal(stepDone(p, s2), true);
    tickStep(s2, false); assert.equal(s2.done, undefined);
  },
  'a step scheduled again is open again until the new event is done (B.2)'() {
    const p = withSteps(); p.events.find(e => e.id === 's1e').todosByDate['2026-11-11'][0].state = 'done';
    p.events.push({ id: 'again', title: 'Gliederung', date: '2026-11-13', startMin: 600, endMin: 660, repeat: 'none', parentId: 's1', todosByDate: {} });
    const s1 = p.steps.find(x => x.id === 's1');
    assert.equal(stepDone(p, s1), false);
    tickEvent(p.events.find(e => e.id === 'again'), '2026-11-13', true);
    assert.equal(stepDone(p, s1), true);
  },
  'phase progress counts its children the same: steps, and the occurrences straight under it'() {
    const p = withSteps(); tickStep(p.steps.find(x => x.id === 's2'), true);
    assert.deepEqual({ ...phaseProgress(p, p.phases[0]) }, { done: 2, total: 6 });   // s2 + event a; of s1, s2 and 4 occurrences
  },
  'the editor offers each phase with its steps under it; on the day first; the current parent always'() {
    const p = withSteps();
    const c = parentChoices(p, '2026-11-10', T, null);
    assert.deepEqual([...c.onDay].map(x => x.phase.id + ':' + [...x.steps].map(s => s.id).join(',')), ['p1:s1,s2']);
    assert.deepEqual([...c.later].map(x => x.phase.id), ['p2']);
    p.steps.push({ id: 'olds', title: 'alt', parentId: 'old', order: 1 });
    assert.deepEqual([...parentChoices(p, '2026-11-10', T, 'olds').later].map(x => x.phase.id), ['old', 'p2'], 'a past phase stays offered while a step of it is chosen');
  },
  'deleting a step frees its events'() {
    const p = withSteps(); deleteStep(p, 's1');
    assert.equal(p.steps.length, 1);
    assert.equal(p.events.find(e => e.id === 's1e').parentId, undefined);
  },
  'deleting a phase deletes its steps and frees every event under it, none deleted'() {
    const p = withSteps(), n = p.events.length; deletePhase(p, 'p1');
    assert.equal(p.phases.find(x => x.id === 'p1'), undefined);
    assert.equal(p.steps.length, 0);
    assert.equal(p.events.length, n);
    assert.equal(p.events.filter(e => e.parentId === 'p1' || e.parentId === 's1').length, 0);
  },
  'a recoloured phase takes along everything under it, through its steps too'() {
    const p = withSteps(); carryCategory(p, 'p1', 'work');
    assert.deepEqual(p.events.map(e => e.categoryId), ['work', 'work', 'work', null, 'seminar', 'work']);
  },
  'steps are records: stamped, sent and deleted like the rest'() {
    assert.ok([...RECORD_LISTS].includes('steps'));
    const before = { categories: [], phases: [], steps: [{ id: 'x', title: 'a', parentId: 'p1', order: 1 }], milestones: [], events: [], deleted: {} };
    const after = JSON.parse(JSON.stringify(before)); after.steps = []; after.deleted = {};
    stampChanges(before, after, '2026-11-10T10:00:00.000Z');
    assert.equal(after.deleted.x.in, 'steps');
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
