// The focus view's rules: what one day shows, which event is open, where the free time is.
// Run from the repo root:  node tests/focus.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const box = {};
vm.runInNewContext(['core/dates.js', 'core/repeat.js', 'core/focus.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.f = { focusDay, focusOpen, focusGaps, weekOf, FOCUS_GAP_MIN };', box);
const f = box.f;
const T = '2026-11-02';                     // a Monday
const h = (hh, mm = 0) => hh * 60 + mm;
const ev = (id, s, e, more = {}) => ({ id, title: id, date: T, startMin: s, endMin: e, repeat: 'none', ...more });
const events = [ev('late', h(13, 30), h(15)), ev('early', h(8, 30), h(10)), ev('tut', h(9), h(11), { date: '2026-10-26', repeat: 'weekly' }), ev('other', h(9), h(10), { date: '2026-11-03' })];
const ids = day => day.map(o => o.ev.id);

const tests = {
  'a day shows its events (series included) in order of time'() {
    assert.deepEqual(ids(f.focusDay(events, T)), ['early', 'tut', 'late']);
  },
  'today: the event running now is open'() {
    assert.equal(f.focusOpen(f.focusDay(events, T), true, h(14)), 'late');
  },
  'today between events: the next one; after the last: the last'() {
    assert.equal(f.focusOpen(f.focusDay(events, T), true, h(12)), 'late');
    assert.equal(f.focusOpen(f.focusDay(events, T), true, h(20)), 'late');
    assert.equal(f.focusOpen(f.focusDay(events, T), true, h(7)), 'early');
  },
  'two running at once: the one that started first'() {
    assert.equal(f.focusOpen(f.focusDay(events, T), true, h(9, 30)), 'early');
  },
  'another day: its first event; an empty day: none'() {
    assert.equal(f.focusOpen(f.focusDay(events, T), false, h(14)), 'early');
    assert.equal(f.focusOpen(f.focusDay(events, '2026-11-05'), true, h(14)), null);
  },
  'free time: between events only, overlaps counted as one block, short pauses left out'() {
    assert.equal(JSON.stringify(f.focusGaps(f.focusDay(events, T)).map(g => [g.s, g.e])), JSON.stringify([[h(11), h(13, 30)]]));
    const tight = [ev('a', h(9), h(10)), ev('b', h(10) + f.FOCUS_GAP_MIN - 1, h(12))];
    assert.equal(f.focusGaps(f.focusDay(tight, T)).length, 0);
  },
  'the week strip: Monday to Sunday around the day, also from a Sunday'() {
    assert.equal(f.weekOf('2026-11-04').join(), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].join());
    assert.equal(f.weekOf('2026-11-08')[0], '2026-11-02');
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok  ', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); }
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nFocus tests passed.');
