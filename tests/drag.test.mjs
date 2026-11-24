// One drag for every rectangle (input/pointer.js dragRect): the week's events and phases, and the canvas's ideas.
// Written first against the drags as they were, so the week behaves exactly as before.
// Run from the repo root:  node tests/drag.test.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = resolve('.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const APP = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n').slice(0, 6).join(' | ')); }
};
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
page.on('pageerror', e => { failed++; console.error('✗ page error:', e.message); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(APP);
await page.waitForFunction(() => !document.getElementById('bootSnakePill'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(300);
const q = (fn, a) => page.evaluate(fn, a);
const box = sel => q(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
async function drag(from, to, opts = {}){
  if (opts.ctrl) await page.keyboard.down('Control');
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8);
  if (opts.before) await opts.before();
  await page.mouse.up();
  if (opts.ctrl) await page.keyboard.up('Control');
  await page.waitForTimeout(50);
}
const closeEditor = async () => { if (await q(() => !!UI.editor)) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); } };

/* a plan to drag: today an event 10:00–11:00, and a phase of a week starting today */
await q(() => mutate(p => {
  p.events.push({ id: 'ev1', title: 'Probe', date: todayISO(), startMin: 600, endMin: 660, repeat: 'none', categoryId: null, todosByDate: {} });
  p.phases.push({ id: 'ph1', title: 'Phase', start: todayISO(), end: idxDate(dayIdx(todayISO()) + 2), categoryId: p.categories[0]?.id || null });
}));
await page.waitForTimeout(200);
await q(() => document.querySelector('.event[data-ev="ev1"]').scrollIntoView({ block: 'center', inline: 'center' }));
await page.waitForTimeout(400);
const slot = () => q(() => minToY(615) - minToY(600));             // px of 15 minutes
const ev = () => q(() => { const e = S.events.find(x => x.id === 'ev1'); return [e.date, e.startMin, e.endMin]; });

await step('day view: a click on an event opens its editor', async () => {
  const b = await box('.event[data-ev="ev1"]');
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  assert.equal(await q(() => UI.editor && UI.editor.type + ':' + UI.editor.edit.id), 'event:ev1');
  await closeEditor();
});

await step('day view: dragging an event moves it by 30 minutes and one day; the ghost follows meanwhile', async () => {
  const b = await box('.event[data-ev="ev1"]'), s = await slot(), d = await q(() => UI.dayPPD);
  const [d0] = await ev();
  let ghost = null;
  await drag({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { x: b.x + b.w / 2 + d, y: b.y + b.h / 2 + 2 * s }, { before: async () => { ghost = await q(() => !!document.querySelector('#dayGrid :is(.ghost, .dragPrev)')); } });
  assert.equal(ghost, true, 'a dashed ghost while dragging');
  assert.deepEqual(await ev(), [await q(d => idxDate(dayIdx(d) + 1), d0), 630, 690]);
  assert.equal(await q(() => document.querySelectorAll('#dayGrid :is(.ghost, .dragPrev)').length), 0, 'no ghost left');
});

await step('day view: the bottom edge resizes, the top edge resizes, never below 15 minutes', async () => {
  let b = await box('.event[data-ev="ev1"]'); const s = await slot();
  await drag({ x: b.x + b.w / 2, y: b.b - 3 }, { x: b.x + b.w / 2, y: b.b - 3 + 2 * s });
  assert.deepEqual((await ev()).slice(1), [630, 720]);
  b = await box('.event[data-ev="ev1"]');
  await drag({ x: b.x + b.w / 2, y: b.y + 3 }, { x: b.x + b.w / 2, y: b.y + 3 - 2 * s });
  assert.deepEqual((await ev()).slice(1), [600, 720]);
  b = await box('.event[data-ev="ev1"]');
  await drag({ x: b.x + b.w / 2, y: b.y + 3 }, { x: b.x + b.w / 2, y: b.b + 6 * s });
  assert.deepEqual((await ev()).slice(1), [705, 720], 'the top stops 15 minutes before the end');
  await q(() => mutate(p => { const e = p.events.find(x => x.id === 'ev1'); e.startMin = 600; e.endMin = 660; }));
});

await step('day view: Ctrl-drag copies the event and leaves the original', async () => {
  const b = await box('.event[data-ev="ev1"]'), s = await slot(), n = await q(() => S.events.length);
  await drag({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h / 2 + 4 * s }, { ctrl: true });
  assert.equal(await q(() => S.events.length), n + 1);
  assert.deepEqual((await ev()).slice(1), [600, 660]);
  assert.deepEqual(await q(() => { const c = S.events.at(-1); return [c.startMin, c.endMin, c.title]; }), [660, 720, 'Probe']);
  await q(() => mutate(p => { p.events.pop(); }));
});

await step('day view, add mode: a drag creates an event; its ghost stays behind the editor', async () => {
  const b = await box('.event[data-ev="ev1"]'), s = await slot();
  await page.click('#fab');
  await drag({ x: b.x + b.w / 2, y: b.b + 4 * s + 2 }, { x: b.x + b.w / 2, y: b.b + 8 * s + 2 });
  assert.deepEqual(await q(() => UI.editor && [UI.editor.type, UI.editor.initial.startMin, UI.editor.initial.endMin]), ['event', 720, 780]);
  assert.equal(await q(() => document.querySelectorAll('#dayGrid :is(.ghost, .dragPrev)').length), 1, 'the ghost stays behind the editor');
  await closeEditor();
  assert.equal(await q(() => document.querySelectorAll('#dayGrid :is(.ghost, .dragPrev)').length), 0);
  if (await q(() => UI.addMode)) await page.click('#fab');
});

await step('day view: a repeating event asks before a drag changes it; Escape leaves all as it was', async () => {
  await q(() => mutate(p => { p.events.push({ id: 'rep', title: 'Serie', date: idxDate(dayIdx(todayISO()) - 1), startMin: 780, endMin: 840, repeat: 'daily', categoryId: null,
    todosByDate: { [todayISO()]: [{ id: 't1', text: 'heute', state: 'open' }], [idxDate(dayIdx(todayISO()) + 1)]: [{ id: 't2', text: 'morgen', state: 'open' }] } }); }));
  await page.waitForTimeout(150);
  const before = await q(() => JSON.stringify(S.events.find(e => e.id === 'rep')));
  const b = await box(`.event[data-ev="rep"][data-date="${await q(() => todayISO())}"]`), s = await slot();
  await drag({ x: b.x + b.w / 2, y: b.b - 3 }, { x: b.x + b.w / 2, y: b.b - 3 + 2 * s });
  assert.deepEqual(await q(() => [...document.querySelectorAll('.choice-menu .row-label')].map(e => e.textContent)), ['Nur diesen Termin', 'Auch alle folgenden']);
  assert.equal(await q(() => document.querySelectorAll('#dayGrid .ghost').length), 1, 'the ghost waits beside the choice');
  assert.equal(await q(() => JSON.stringify(S.events.find(e => e.id === 'rep'))), before, 'nothing changed yet');
  await page.keyboard.press('Escape');
  assert.equal(await q(() => document.querySelectorAll('.choice-menu, #dayGrid .ghost').length), 0);
  assert.equal(await q(() => JSON.stringify(S.events.find(e => e.id === 'rep'))), before, 'Escape: as it was');
});

await step('"Nur diesen Termin": that day leaves the series with its todos; the other days keep their times', async () => {
  const today = await q(() => todayISO()), b = await box(`.event[data-ev="rep"][data-date="${today}"]`), s = await slot();
  await drag({ x: b.x + b.w / 2, y: b.b - 3 }, { x: b.x + b.w / 2, y: b.b - 3 + 2 * s });
  await page.click('.choice-menu .row:first-child');
  const r = await q(t => { const ser = S.events.find(e => e.id === 'rep'), one = S.events.find(e => e.id !== 'rep' && e.title === 'Serie');
    return { except: ser.except, serTimes: [ser.startMin, ser.endMin], serToday: !!ser.todosByDate[t], one: one && [one.date, one.repeat, one.startMin, one.endMin, one.todosByDate[t]?.[0]?.text] }; }, today);
  assert.deepEqual(r, { except: [today], serTimes: [780, 840], serToday: false, one: [today, 'none', 780, 870, 'heute'] });
  assert.equal(await q(() => document.querySelectorAll('.choice-menu, #dayGrid .ghost').length), 0);
});

await step('"Auch alle folgenden": the series ends the day before; from that day on a series of its own', async () => {
  const tom = await q(() => idxDate(dayIdx(todayISO()) + 1)), b = await box(`.event[data-ev="rep"][data-date="${tom}"]`), s = await slot();
  await drag({ x: b.x + b.w / 2, y: b.y + 3 }, { x: b.x + b.w / 2, y: b.y + 3 - 2 * s });
  await page.click('.choice-menu .row:nth-child(2)');
  const r = await q(t => { const ser = S.events.find(e => e.id === 'rep'), next = S.events.find(e => e.id !== 'rep' && e.title === 'Serie' && e.repeat === 'daily');
    return { serEnd: ser.end, serTimes: [ser.startMin, ser.endMin], next: next && [next.date, next.startMin, next.endMin, next.todosByDate[t]?.[0]?.text] }; }, tom);
  assert.deepEqual(r, { serEnd: tom, serTimes: [780, 840], next: [tom, 750, 840, 'morgen'] });
});

await step('from the first day the second row is "Ganze Serie", and changes the series itself', async () => {
  const first = await q(() => S.events.find(e => e.id !== 'rep' && e.title === 'Serie' && e.repeat === 'daily'));
  const b = await box(`.event[data-ev="${first.id}"][data-date="${first.date}"]`), s = await slot();
  await drag({ x: b.x + b.w / 2, y: b.b - 3 }, { x: b.x + b.w / 2, y: b.b - 3 + 2 * s });
  assert.equal(await q(() => document.querySelector('.choice-menu .row:nth-child(2) .row-label').textContent), 'Ganze Serie');
  await page.click('.choice-menu .row:nth-child(2)');
  assert.deepEqual(await q(id => { const e = S.events.find(x => x.id === id); return [e.startMin, e.endMin, e.date]; }, first.id), [750, 870, first.date]);
  await q(() => mutate(p => { p.events = p.events.filter(e => e.title !== 'Serie'); }));
});

const ph = () => q(() => { const p = S.phases.find(x => x.id === 'ph1'); return [dayIdx(p.start), diffDays(p.start, p.end)]; });
await step('timeline: the right handle lengthens a phase by two days, the left shortens it by one', async () => {
  await q(() => { $scene.scrollTop = 0; $scene.scrollLeft = (dayIdx(todayISO()) - 1) * TL_PPD; }); await page.waitForTimeout(400);
  assert.equal(await q(() => { const r = document.querySelector('#tlInner .phase[data-phase="ph1"] .rez[data-rez="r"]').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.className; }), 'rez', 'the handle is on screen');
  const [x0, w0] = await ph(), ppd = await q(() => TL_PPD);
  let h = await box('#tlInner .phase[data-phase="ph1"] .rez[data-rez="r"]');
  await drag({ x: h.x + h.w / 2, y: h.y + h.h / 2 }, { x: h.x + h.w / 2 + 2 * ppd, y: h.y + h.h / 2 });
  assert.deepEqual(await ph(), [x0, w0 + 2]);
  h = await box('#tlInner .phase[data-phase="ph1"] .rez[data-rez="l"]');
  await drag({ x: h.x + h.w / 2, y: h.y + h.h / 2 }, { x: h.x + h.w / 2 + ppd, y: h.y + h.h / 2 });
  assert.deepEqual(await ph(), [x0 + 1, w0 + 1]);
  await closeEditor();
});

await step('timeline, add mode: a drag over three days creates a phase; within one day a milestone', async () => {
  const ppd = await q(() => TL_PPD);
  const { x, y } = await q(() => { const r = $tlInner.getBoundingClientRect(); for (let y = Math.min(r.bottom, innerHeight) - 4; y > Math.max(r.top, 0); y -= 6) { const el = document.elementFromPoint(400, y);
    if (el && $tlInner.contains(el) && !el.closest('.phase,.milestone-chip,.milestone-dot,.projLabel,.dropdown,.ph-exp')) return { x: 400, y }; } });
  await page.click('#fab');
  await drag({ x, y }, { x: x + 2 * ppd, y });
  assert.deepEqual(await q(() => UI.editor && [UI.editor.type, diffDays(UI.editor.initial.start, UI.editor.initial.end)]), ['phase', 3]);
  await closeEditor();
  if (await q(() => UI.addMode)) await page.click('#fab');
});

/* ── new with the one drag ── */
await step('timeline: a phase moves by its body (same length); the ghost is a dashed pill in its colour; a click still opens it', async () => {
  const [x0, w0] = await ph(), ppd = await q(() => TL_PPD);
  const b = await box('#tlInner .phase[data-phase="ph1"]');
  let ghost = null;
  await drag({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { x: b.x + b.w / 2 + 2 * ppd, y: b.y + b.h / 2 }, { before: async () => {
    ghost = await q(() => { const g = document.querySelector('#tlInner .ghost'); const cs = getComputedStyle(g);
      return [cs.borderTopStyle, cs.borderRadius, g.offsetHeight, document.querySelector('#tlInner .phase[data-phase="ph1"]').classList.contains('dragging')]; }); } });
  assert.deepEqual(ghost, ['dashed', '9999px', 24, true]);
  assert.deepEqual(await ph(), [x0 + 2, w0]);
  assert.equal(await q(() => !!UI.editor), false, 'a move opens nothing');
  const c = await box('#tlInner .phase[data-phase="ph1"]');
  await page.mouse.click(Math.min(c.r, 1400) - 40, c.y + c.h / 2);   // clear of its label and arrow
  assert.equal(await q(() => UI.editor && UI.editor.type), 'phase', '');
  await closeEditor();
});

await step('timeline: the ghost\'s first and last day are marked as text in the row of days, as the day view marks times', async () => {
  const ppd = await q(() => TL_PPD);
  const b = await box('#tlInner .phase[data-phase="ph1"]');
  let lit = null, over = null; const x = Math.min(b.r, 1400) - 40;   // clear of its label and arrow
  await drag({ x, y: b.y + b.h / 2 }, { x: x + ppd, y: b.y + b.h / 2 }, { before: async () => {
    over = await q(() => { const l = document.querySelector('#dayHead > .snapLab.x .dn').getBoundingClientRect(), d = [...document.querySelectorAll('#dayHead .dh[data-day] .dn')].map(e => e.getBoundingClientRect()).find(r => Math.abs(r.left + r.width / 2 - l.left - l.width / 2) < r.width);
      return d && [Math.round(l.top - d.top), Math.round(l.left - d.left)]; });
    lit = await q(() => { const ls = [...document.querySelectorAll('#dayHead > .snapLab.x')], g = document.querySelector('#tlInner .ghost').getBoundingClientRect(), ppd = TL_PPD;
      return ls.map(l => { const r = l.getBoundingClientRect(); return [l.textContent, Math.round((r.left + r.width / 2 - g.left) / ppd * 2) / 2]; }).concat([[Math.round(g.width / ppd)]]); }); } });
  const w = lit.pop()[0];
  assert.equal(lit.length, 2, 'two labels');
  assert.deepEqual(over, [0, 0], 'exactly over its day\'s own date');
  assert.deepEqual(lit.map(l => l[1]), [0.5, w - 0.5], 'centred on the first and the last day');
  assert.match(lit[0][0], /^(Mo|Di|Mi|Do|Fr|Sa|So)\d+$/, 'its weekday and date, as its cell');
  assert.equal(await q(() => document.querySelectorAll('.snapLab').length), 0, 'gone on release');
  await q(() => mutate(p => { const t = p.phases.find(x => x.id === 'ph1'); t.start = idxDate(dayIdx(t.start) - 1); t.end = idxDate(dayIdx(t.end) - 1); }));
});

await step('one ghost everywhere: the same class and look in the day view and the timeline', async () => {
  const css = await q(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => /dashed/.test(r.cssText) && /\b(ghost|dragPrev|tlCreate|preview)\b/.test(r.selectorText || '')).map(r => r.selectorText));
  assert.deepEqual(css, ['.ghost'], 'one dashed preview rule in the whole app');
});

await step('touch: a tap on an event still opens its editor', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(APP); await p.waitForTimeout(1200);
  await p.evaluate(() => mutate(s => { s.events.push({ id: 'evT', title: 'Tap', date: todayISO(), startMin: 600, endMin: 720, repeat: 'none', categoryId: null, todosByDate: {} }); }));
  await p.evaluate(() => document.querySelector('.event[data-ev="evT"]').scrollIntoView({ block: 'center', inline: 'center' })); await p.waitForTimeout(500);
  const b = await p.evaluate(() => { const r = document.querySelector('.event[data-ev="evT"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.touchscreen.tap(b.x, b.y); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => UI.editor && UI.editor.edit && UI.editor.edit.id), 'evT');
  await ctx.close();
});

const enter = async () => { await q(() => { morphStart(0); morphRelease(1); }); await page.waitForFunction(() => UI.canvas.active && !morph.on, null, { timeout: 3000 }); };
const idea = id => q(id => { const i = S.ideas.find(x => x.id === id); return [dayIdx(i.day), i.row, i.w, i.h]; }, id);
await step('canvas: one radius, half a row: a one-row idea is a pill, a taller one a pill drawn out', async () => {
  await enter();
  await q(() => { const g = $canvasGrid.getBoundingClientRect(), s = $canvasScene.getBoundingClientRect(), c = Math.floor((s.left + 300 - g.left) / CANVAS_CELL), row = UI.canvas.rows - Math.floor((s.top + 500 - g.top) / CANVAS_CELL);
    mutate(p => p.ideas.push({ id: 'i1', tabId: activeCanvasTab().id, day: idxDate(c), row, w: 4, h: 1 }, { id: 'i2', tabId: activeCanvasTab().id, day: idxDate(c + 6), row: row - 3, w: 3, h: 3 })); });
  const r = await q(() => [...document.querySelectorAll('#canvasIdeas .idea')].map(e => [getComputedStyle(e).borderRadius, e.offsetHeight]));
  assert.deepEqual(r, [['20px', 40], ['20px', 120]]);
});

await step('canvas: an idea moves on both axes, snapped to the cells, with the dashed ghost in its shape', async () => {
  const [x, y, w, h] = await idea('i1');
  const b = await box('.idea[data-idea="i1"]');
  let ghost = null;
  await drag({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { x: b.x + b.w / 2 + 2 * 40 + 9, y: b.y + b.h / 2 - 40 - 7 }, { before: async () => {
    ghost = await q(() => { const g = document.querySelector('#canvasIdeas .ghost'), c = getComputedStyle(g); return [c.borderTopStyle, c.borderRadius, g.offsetWidth, g.offsetHeight]; }); } });
  assert.deepEqual(ghost, ['dashed', '20px', 160, 40]);
  assert.deepEqual(await idea('i1'), [x + 2, y + 1, w, h]);
});

await step('canvas: edges and corners resize, never below one cell; crossing a row turns the pill into a taller one', async () => {
  let b = await box('.idea[data-idea="i1"]'); let [x, y, w, h] = await idea('i1');
  await drag({ x: b.r - 3, y: b.y + b.h / 2 }, { x: b.r - 3 + 80, y: b.y + b.h / 2 });
  assert.deepEqual(await idea('i1'), [x, y, w + 2, h], 'right edge');
  b = await box('.idea[data-idea="i1"]');
  await drag({ x: b.x + b.w / 2, y: b.y + 3 }, { x: b.x + b.w / 2, y: b.y + 3 - 80 });
  assert.deepEqual(await idea('i1'), [x, y, w + 2, h + 2], 'top edge: two rows taller');
  assert.equal(await q(() => getComputedStyle(document.querySelector('.idea[data-idea="i1"]')).borderRadius), '20px');
  b = await box('.idea[data-idea="i1"]');
  const k = 20 - 17 * Math.SQRT1_2;                                // on the corner's arc, 3 px inside
  await drag({ x: b.x + k, y: b.b - k }, { x: b.r + 200, y: b.y - 200 });
  assert.deepEqual(await idea('i1'), [x + w + 1, y + h + 1, 1, 1], 'the corner stops at one cell: ' + JSON.stringify([x, y, w, h]));
});

await step('canvas: in draw mode a drag on an idea moves it; on the empty grid it draws', async () => {
  const n = await q(() => S.ideas.length), [x] = await idea('i2');
  await page.click('#fab');
  const b = await box('.idea[data-idea="i2"]');
  await drag({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { x: b.x + b.w / 2 + 40, y: b.y + b.h / 2 });
  assert.equal((await idea('i2'))[0], x + 1);
  assert.equal(await q(() => S.ideas.length), n);
  assert.equal(await q(() => UI.drawMode), true, 'still drawing');
  await drag({ x: b.x + 20, y: b.y - 200 }, { x: b.x + 140, y: b.y - 200 });
  assert.equal(await q(() => S.ideas.length), n + 1);
});

await browser.close();
server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nDrag tests passed.');
