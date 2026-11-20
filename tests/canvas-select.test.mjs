// Selecting ideas on the canvas (input/canvas-select.js): the marquee, its two modes, Shift + click, Ctrl + marquee, group move.
// Run from the repo root:  node tests/canvas-select.test.mjs
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
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n').slice(0, 16).join(' | ')); }
};
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', e => { failed++; console.error('✗ page error:', e.message); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(APP);
await page.waitForFunction(() => !document.getElementById('bootSnakePill'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(300);
const q = (fn, a) => page.evaluate(fn, a);
assert.equal(await q(() => getComputedStyle(document.getElementById('btnSelect')).display), 'none', 'the select button is the canvas\'s');
await q(() => { morphStart(0); morphRelease(1); });
await page.waitForFunction(() => UI.canvas.active && !morph.on, null, { timeout: 3000 });
/* three ideas: a (3×1), b (2×3), c (3×2), side by side with gaps */
await q(() => mutate(p => { const t = activeCanvasTab().id, d = dayIdx(todayISO());
  p.ideas.push({ id:'a', tabId:t, day:idxDate(d + 2), row:8, w:3, h:1, z:1 }, { id:'b', tabId:t, day:idxDate(d + 6), row:7, w:2, h:3, z:2 },
               { id:'c', tabId:t, day:idxDate(d + 10), row:9, w:3, h:2, z:3 }); }));
await q(() => document.querySelector('.idea[data-idea="b"]').scrollIntoView({ block: 'center', inline: 'center' }));
await page.waitForTimeout(200);
const R = id => q(id => { const r = document.querySelector(`.idea[data-idea="${id}"]`).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const sel = () => q(() => [...UI.selection].sort());
const pos = () => q(() => Object.fromEntries(S.ideas.filter(i => 'abc'.includes(i.id)).map(i => [i.id, [diffDays(todayISO(), i.day), i.row]])));
async function drag(from, to, { steps = 8, mods = [], before } = {}){
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
  if (before) await before();
  await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  await page.waitForTimeout(50);
}
const empty = async () => { const a = await R('a'); return { x: a.l - 30, y: a.t - 30 }; };

await step('touch mode (the default): the marquee selects what it touches, live; not snapped; no fill, wider gaps', async () => {
  assert.equal(await q(() => device.selectMode), 'touch');
  const a = await R('a'), b = await R('b'), from = await empty(), to = { x: b.l + 10, y: a.b + 10 };   // all of a, a corner of b
  let look = null;
  await drag(from, to, { before: async () => { look = await q(() => { const g = document.querySelector('#canvasIdeas .ghost.marquee'), r = g.getBoundingClientRect(), line = g.querySelector('rect');
    return { w: Math.round(r.width), bg: getComputedStyle(g).backgroundColor, border: getComputedStyle(g).borderTopWidth, dash: getComputedStyle(line).strokeDasharray, fill: getComputedStyle(line).fill, live: [...UI.selection].sort() }; }); } });
  assert.equal(look.w, Math.round(to.x - from.x), 'as wide as the drag: not snapped to the cells');
  assert.deepEqual([look.bg, look.border, look.fill], ['rgba(0, 0, 0, 0)', '0px', 'none'], 'no fill; the line is drawn, not a border');
  assert.equal(look.dash, '4.5px, 7.5px', 'gaps wider than the ghost\'s dashes');
  assert.deepEqual(look.live, ['a', 'b'], 'selected while drawing');
  assert.deepEqual(await sel(), ['a', 'b']);
  assert.equal(await q(() => document.querySelectorAll('#canvasIdeas .ghost').length), 0, 'the marquee goes on release');
  assert.equal(await q(() => getComputedStyle(document.querySelector('.idea[data-idea="a"]')).outlineStyle), 'solid', 'a selected idea wears the ring');
});

await step('a click on the empty canvas clears; so does Escape (and the canvas stays)', async () => {
  const e = await empty();
  await page.mouse.click(e.x, e.y);
  assert.deepEqual(await sel(), []);
  await drag(await empty(), { x: (await R('c')).r + 10, y: (await R('b')).b + 10 });
  assert.deepEqual(await sel(), ['a', 'b', 'c']);
  await page.keyboard.press('Escape');
  assert.deepEqual([await sel(), await q(() => UI.canvas.active)], [[], true]);
});

await step('the select button switches to enclose: only what the marquee encloses; its icon and tooltip follow; kept per device', async () => {
  const d0 = await q(() => document.querySelector('#btnSelect .sel').getAttribute('d'));
  await page.click('#btnSelect'); await page.waitForTimeout(600);
  assert.equal(await q(() => device.selectMode), 'enclose');
  assert.notEqual(await q(() => document.querySelector('#btnSelect .sel').getAttribute('d')), d0, 'the closed marquee');
  assert.match(await q(() => document.getElementById('btnSelect').title), /umschließt/);
  assert.equal(await q(() => JSON.parse(localStorage.getItem(DEVICE_KEY)).selectMode), 'enclose');
  const a = await R('a'), b = await R('b');
  await drag(await empty(), { x: b.l + 10, y: b.b + 10 });          // all of a, part of b
  assert.deepEqual(await sel(), ['a']);
  await page.click('#btnSelect'); await page.waitForTimeout(600);
  assert.match(await q(() => document.getElementById('btnSelect').title), /berührt/);
  assert.equal(await q(() => document.querySelector('#btnSelect .sel').getAttribute('d')), d0, 'back to the crossing corners');
});

await step('Shift + click on an idea adds it or takes it away; Shift + drag pans and keeps the selection', async () => {
  await page.mouse.click((await empty()).x, (await empty()).y);
  await page.keyboard.down('Shift');
  await page.mouse.click((await R('a')).x, (await R('a')).y);
  await page.mouse.click((await R('c')).x, (await R('c')).y);
  assert.deepEqual(await sel(), ['a', 'c']);
  await page.mouse.click((await R('a')).x, (await R('a')).y);
  assert.deepEqual(await sel(), ['c']);
  await page.keyboard.up('Shift');
  assert.equal(await q(() => !!UI.editor), false, 'Shift + click opens nothing');
  const s0 = await q(() => $canvasScene.scrollLeft), p0 = await pos();
  await drag(await R('b'), { x: (await R('b')).x - 80, y: (await R('b')).y }, { mods: ['Shift'] });
  assert.equal(await q(() => $canvasScene.scrollLeft) - s0, 80, 'panned');
  assert.deepEqual([await sel(), await pos()], [['c'], p0], 'nothing moved, the selection kept');
});

await step('Ctrl + marquee adds what it hits, or takes it away if already selected', async () => {
  await drag(await empty(), { x: (await R('b')).l + 10, y: (await R('a')).b + 10 }, { mods: ['Control'] });   // a, b; c stays
  assert.deepEqual(await sel(), ['a', 'b', 'c']);
  await drag(await empty(), { x: (await R('a')).r - 10, y: (await R('a')).b + 10 }, { mods: ['Control'] });   // a again: out
  assert.deepEqual(await sel(), ['b', 'c']);
});

await step('a click on an idea opens it and makes it the selection', async () => {
  await page.mouse.click((await R('a')).x, (await R('a')).y);
  assert.deepEqual([await q(() => UI.editor && UI.editor.type), await sel()], ['idea', ['a']]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
});

await step('group move: dragging a selected idea moves all of them, snapped, offsets kept, one ghost each, one undo step', async () => {
  await drag(await empty(), { x: (await R('c')).r + 10, y: (await R('b')).b + 10 });
  assert.deepEqual(await sel(), ['a', 'b', 'c']);
  const p0 = await pos(), b = await R('b');
  let during = null;
  await drag(b, { x: b.x + 2 * 40 + 7, y: b.y - 40 - 5 }, { before: async () => { during = await q(() => [document.querySelectorAll('#canvasIdeas .ghost').length, document.querySelectorAll('.idea.dragging').length]); } });
  assert.deepEqual(during, [3, 3], 'a ghost for each, all three faded');
  const p1 = await pos();
  for (const id of 'abc') assert.deepEqual(p1[id], [p0[id][0] + 2, p0[id][1] + 1], id + ': two days on, one row up (snapped)');
  assert.deepEqual(await sel(), ['a', 'b', 'c'], 'still selected');
  assert.equal(await q(() => !!UI.editor), false);
  await page.keyboard.press('Control+z');
  assert.deepEqual(await pos(), p0, 'one undo step brings all three back');
  await page.keyboard.press('Control+y');
});

await step('pressing an idea that is not selected: it becomes the selection and moves alone; a handle resizes one idea', async () => {
  await drag(await empty(), { x: (await R('b')).l + 10, y: (await R('a')).b + 10 });   // a, b
  const p0 = await pos(), c = await R('c');
  await drag(c, { x: c.x, y: c.y - 40 });
  const p1 = await pos();
  assert.deepEqual([await sel(), p1.a, p1.b, p1.c], [['c'], p0.a, p0.b, [p0.c[0], p0.c[1] + 1]]);
  await drag(await empty(), { x: (await R('b')).l + 10, y: (await R('a')).b + 10 });   // a, b
  const w0 = await q(() => S.ideas.find(i => i.id === 'a').w);
  const h = await q(() => { const r = document.querySelector('.idea[data-idea="a"] .rez[data-rez="r"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await drag(h, { x: h.x + 40, y: h.y });
  const p2 = await pos();
  assert.deepEqual([await q(() => S.ideas.find(i => i.id === 'a').w), p2.b], [w0 + 1, p1.b], 'a wider; b stays');
});

await step('touch: one finger draws the marquee at once; a hold on a selected idea moves the group', async () => {
  const fire = (type, x, y) => q(([type, x, y]) => { const ev = new PointerEvent(type, { pointerId: 31, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, isPrimary: true });
    (type === 'pointerdown' ? document.elementFromPoint(x, y) : window).dispatchEvent(ev); }, [type, x, y]);
  const c = await R('c'), from = { x: (await empty()).x, y: Math.min((await empty()).y, c.t - 30) };   // above all three (c went up a row)
  await fire('pointerdown', from.x, from.y);
  for (let i = 1; i <= 6; i++) await fire('pointermove', from.x + (c.r + 10 - from.x) * i / 6, from.y + ((await R('b')).b + 10 - from.y) * i / 6);
  await fire('pointerup', c.r + 10, (await R('b')).b + 10);
  assert.deepEqual(await sel(), ['a', 'b', 'c']);
  const p0 = await pos(), b = await R('b');
  await fire('pointerdown', b.x, b.y); await page.waitForTimeout(600);          // the hold (LONGPRESS)
  for (let i = 1; i <= 4; i++) await fire('pointermove', b.x + 10 * i, b.y);
  await fire('pointerup', b.x + 40, b.y);
  const p1 = await pos();
  for (const id of 'abc') assert.deepEqual(p1[id], [p0[id][0] + 1, p0[id][1]], id);
});

await step('the selection is view state: never stored, gone with the tab it was on', async () => {
  assert.equal(await q(() => JSON.stringify(S).includes('selection') || localStorage.getItem(DEVICE_KEY).includes('"selection')), false);
  await page.click('#canvasTabs [data-create]'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  assert.deepEqual(await sel(), []);
});

await browser.close(); server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nCanvas-select tests passed.');
