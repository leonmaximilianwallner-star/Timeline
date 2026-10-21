// Tests for supabase/functions/send-reminders — when a push goes out, and that it goes out once.
// Run from the repo root:  node --experimental-strip-types tests/reminders.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { occursOn, localTimeToUtc, dueReminders, run, addDaysISO } from '../supabase/functions/send-reminders/index.ts';

const VIE = 'Europe/Vienna';
const at = iso => new Date(iso).getTime();
const ev = o => ({ id: 'e1', title: 'Tutorium', date: '2026-10-21', startMin: 9 * 60, endMin: 11 * 60, repeat: 'none', reminderMin: 15, ...o });

/* the app's own rule, loaded as the browser loads it */
const app = {};
vm.runInNewContext(['core/dates.js', 'core/repeat.js'].map(f => readFileSync(f, 'utf8')).join('\n') +
  '\nthis.occursOn = occursOn;', app);

/* a fake database: what the function would read and write on Supabase */
function fakeDb(devices, eventsByUser){
  const sent = new Set(), removed = [];
  return { sent, removed,
    devices: async () => devices.filter(d => !removed.includes(d.endpoint)),
    events: async () => eventsByUser,
    claim: async (endpoint, keys) => keys.filter(k => !sent.has(endpoint + '|' + k) && sent.add(endpoint + '|' + k)),
    removeDevice: async endpoint => { removed.push(endpoint); },
    forgetSentBefore: async () => {},
  };
}
const phone = { endpoint: 'https://push.example/phone', user_id: 'u1', p256dh: 'x', auth: 'y', time_zone: VIE };

const tests = {
  'occursOn matches the app (core/repeat.js) for every repeat over two years'() {
    const kinds = ['none', 'daily', 'weekly', 'weekdays', 'monthly'];
    const starts = ['2026-01-31', '2026-02-28', '2026-03-29', '2026-10-25', '2026-12-31'];
    for (const repeat of kinds) for (const date of starts) {
      for (let i = -3; i < 730; i++) {
        const day = addDaysISO(date, i);
        assert.equal(occursOn({ date, repeat }, day), app.occursOn({ date, repeat }, day), `${repeat} from ${date} on ${day}`);
      }
    }
  },
  'Vienna local time becomes the right moment in summer and winter'() {
    assert.equal(localTimeToUtc('2026-10-21', 9 * 60, VIE), at('2026-10-21T07:00:00Z'));   // summer time, +2
    assert.equal(localTimeToUtc('2026-12-01', 9 * 60, VIE), at('2026-12-01T08:00:00Z'));   // winter time, +1
  },
  'the clock-change days are right (29 Mar, 25 Oct 2026)'() {
    assert.equal(localTimeToUtc('2026-03-29', 9 * 60, VIE), at('2026-03-29T07:00:00Z'));
    assert.equal(localTimeToUtc('2026-10-25', 9 * 60, VIE), at('2026-10-25T08:00:00Z'));
    assert.equal(localTimeToUtc('2026-10-25', 0, VIE), at('2026-10-24T22:00:00Z'));       // midnight, still summer time
  },
  'another time zone works too'() {
    assert.equal(localTimeToUtc('2026-10-21', 9 * 60, 'America/New_York'), at('2026-10-21T13:00:00Z'));
  },
  'a reminder is due from its moment until 10 minutes later, not before'() {
    const e = [ev()];                                                     // 09:00 local, 15 min before → 06:45 UTC
    assert.equal(dueReminders(e, at('2026-10-21T06:44:59Z'), VIE).length, 0);
    assert.equal(dueReminders(e, at('2026-10-21T06:45:00Z'), VIE).length, 1);
    assert.equal(dueReminders(e, at('2026-10-21T06:54:59Z'), VIE).length, 1);
    assert.equal(dueReminders(e, at('2026-10-21T06:55:00Z'), VIE).length, 0);
  },
  'the message says when and what'() {
    const [r] = dueReminders([ev()], at('2026-10-21T06:45:00Z'), VIE);
    assert.deepEqual({ ...r }, { key: 'e1@2026-10-21', eventId: 'e1', day: '2026-10-21', title: 'Tutorium', body: 'In 15 min · 09:00–11:00' });
    const texts = [0, 5, 60, 1440].map(m => dueReminders([ev({ reminderMin: m })], at('2026-10-21T07:00:00Z') - m * 60000, VIE)[0].body);
    assert.deepEqual(texts, ['Jetzt · 09:00–11:00', 'In 5 min · 09:00–11:00', 'In 1 h · 09:00–11:00', 'Morgen · 09:00–11:00']);
  },
  'a one-day-ahead reminder fires the evening before'() {
    const due = dueReminders([ev({ date: '2026-10-22', reminderMin: 1440 })], at('2026-10-21T07:00:00Z'), VIE);
    assert.equal(due.length, 1);
    assert.equal(due[0].key, 'e1@2026-10-22');
  },
  'a reminder just after midnight in Vienna is found on the right day'() {
    const due = dueReminders([ev({ date: '2026-10-22', startMin: 10, reminderMin: 30 })], at('2026-10-21T21:40:00Z'), VIE);
    assert.equal(due.length, 1);                                          // 21:40 UTC = 23:40 Vienna, event at 00:10
  },
  'repeating events remind on each occurrence, and only then'() {
    const weekly = [ev({ repeat: 'weekly' })];                          // 28 Oct is winter time: 09:00 = 08:00 UTC
    assert.equal(dueReminders(weekly, at('2026-10-28T07:50:00Z'), VIE)[0].key, 'e1@2026-10-28');
    assert.equal(dueReminders(weekly, at('2026-10-27T07:50:00Z'), VIE).length, 0);
  },
  'events without a reminder are skipped'() {
    assert.equal(dueReminders([ev({ reminderMin: null })], at('2026-10-21T07:00:00Z'), VIE).length, 0);
  },
  async 'a reminder goes out once, even if the next minute still sees it as due'() {
    const db = fakeDb([phone], { u1: [ev()] }), pushed = [];
    const push = async (d, m) => { pushed.push(m); };
    await run({ db, push, nowMs: at('2026-10-21T06:45:00Z') });
    await run({ db, push, nowMs: at('2026-10-21T06:46:00Z') });
    assert.equal(pushed.length, 1);
    assert.deepEqual(pushed[0], { title: 'Tutorium', body: 'In 15 min · 09:00–11:00', tag: 'e1@2026-10-21', day: '2026-10-21' });
  },
  async 'each device gets its own push'() {
    const laptop = { ...phone, endpoint: 'https://push.example/laptop' };
    const db = fakeDb([phone, laptop], { u1: [ev()] }), pushed = [];
    const r = await run({ db, push: async d => { pushed.push(d.endpoint); }, nowMs: at('2026-10-21T06:45:00Z') });
    assert.deepEqual(pushed.sort(), [laptop.endpoint, phone.endpoint].sort());
    assert.equal(r.sent, 2);
  },
  async 'a device that unsubscribed is removed'() {
    const db = fakeDb([phone], { u1: [ev()] });
    const r = await run({ db, push: async () => { throw { gone: true }; }, nowMs: at('2026-10-21T06:45:00Z') });
    assert.deepEqual(db.removed, [phone.endpoint]);
    assert.equal(r.removed, 1);
  },
  async 'one failing push does not stop the others'() {
    const db = fakeDb([phone], { u1: [ev(), ev({ id: 'e2', title: 'Bachata' })] }), pushed = [];
    const errors = console.error; console.error = () => {};
    try {
      await run({ db, push: async (d, m) => { if (m.tag.startsWith('e1')) throw new Error('timeout'); pushed.push(m.title); }, nowMs: at('2026-10-21T06:45:00Z') });
    } finally { console.error = errors; }
    assert.deepEqual(pushed, ['Bachata']);
  },
  async 'no devices: nothing is read'() {
    let read = false;
    const r = await run({ db: { devices: async () => [], events: async () => { read = true; } }, push: async () => {}, nowMs: 0 });
    assert.equal(read, false);
    assert.equal(r.sent, 0);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
}
console.log(failed ? `\n${failed} reminder test(s) FAILED` : '\nReminder tests passed.');
process.exit(failed ? 1 : 0);
