// The editor on a phone, and what an event shows at each height.
// Run from the repo root:  node tests/editor-phone.test.mjs
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
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.clock.setSystemTime(new Date('2026-10-21T10:00:00+02:00'));
await page.goto(APP); await page.waitForTimeout(500);

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
};
const open = () => page.evaluate(() => { const ev = S.events.find(e => e.repeat === 'none'); openEditor({ type: 'event', edit: ev }); return ev.id; });
const pull = async (dy, ms) => {
  await page.waitForTimeout(300);                                     // the editor has finished rising
  const r = await page.locator('.editor-header').boundingBox();
  const x = r.x + 40, y = r.y + 12;                                   // on the header, clear of its fields and buttons
  await page.mouse.move(x, y); await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x, y + dy * i / steps); await page.waitForTimeout(ms / steps); }
  await page.mouse.up(); await page.waitForTimeout(400);
};

await step('opening an event on a phone does not start typing (no keyboard)', async () => {
  await open();
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'fTitle');
  await page.evaluate(() => closeEditor());
});
await step('a new event on a phone does not start typing either', async () => {
  await page.evaluate(() => openEditor({ type: 'event', initial: { date: todayISO(), startMin: 600, endMin: 660 } }));
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'fTitle');
  await page.evaluate(() => closeEditor());
});
await step('the editor sits at the bottom, full width', async () => {
  await open();
  const r = await page.locator('.editor').boundingBox();
  assert.equal(Math.round(r.width), 390); assert.equal(Math.round(r.y + r.height), 844);
  await page.evaluate(() => closeEditor());
});
await step('pulling the header down closes it without saving', async () => {
  const id = await open();
  const title = await page.evaluate(i => S.events.find(e => e.id === i).title, id);
  await page.fill('#fTitle', 'verworfen');
  await pull(260, 300);
  assert.equal(await page.locator('#editorOverlay').count(), 0, 'closed');
  assert.equal(await page.evaluate(i => S.events.find(e => e.id === i).title, id), title, 'not saved');
});
await step('a short slow pull springs back', async () => {
  await open();
  await pull(40, 600);
  assert.equal(await page.locator('#editorOverlay').count(), 1, 'still open');
  assert.equal(await page.evaluate(() => document.querySelector('.editor').style.transform), '');
  await page.evaluate(() => closeEditor());
});
await step('a quick flick closes it', async () => {
  await open();
  await pull(70, 20);
  assert.equal(await page.locator('#editorOverlay').count(), 0);
});

/* what an event shows at each height (narrow phone column) */
const shows = minutes => page.evaluate(m => {
  const el = renderEvent({ id: 'x', title: 'Betreuungstermin Seminararbeit', date: todayISO(), startMin: 600, endMin: 600 + m, repeat: 'weekly', reminderMin: 15,
    todosByDate: { [todayISO()]: [{ id: 'a', text: 'x', state: 'done' }, { id: 'b', text: 'y', state: 'open' }] } }, todayISO(), 0, 58);
  document.getElementById('dayGrid').appendChild(el);
  const out = { title: !!el.querySelector('.et'), time: !!el.querySelector('.em'), todos: !!el.querySelector('.badge'),
    lines: +getComputedStyle(el).getPropertyValue('--title-lines'), hyphens: el.querySelector('.et') && getComputedStyle(el.querySelector('.et')).hyphens };
  el.remove(); return out;
}, minutes);
await step('15 minutes: just its colour', async () => { assert.deepEqual(await shows(15), { title: false, time: false, todos: false, lines: 1, hyphens: null }); });
await step('30 minutes: the title', async () => { const s = await shows(30); assert.equal(s.title, true); assert.equal(s.time, false); });
await step('1 hour in a narrow column: the title, then the start time', async () => {
  const s = await shows(60); assert.equal(s.time, true); assert.equal(s.lines, 1);
  assert.equal(await page.evaluate(() => { const el = renderEvent({ id:'x', title:'T', date:todayISO(), startMin:600, endMin:660, repeat:'none', reminderMin:null, todosByDate:{} }, todayISO(), 0, 58); return el.querySelector('.em').textContent; }), '10:00'); });
await step('1 hour in a wide column: the title, then the whole time', async () => {
  assert.equal(await page.evaluate(() => { const el = renderEvent({ id:'x', title:'T', date:todayISO(), startMin:600, endMin:660, repeat:'none', reminderMin:null, todosByDate:{} }, todayISO(), 0, 180); return el.querySelector('.em').textContent; }), '10:00–11:00'); });
await step('3 hours: title on several lines, time, todos; words break at syllables', async () => {
  const s = await shows(180); assert.ok(s.lines >= 4, `${s.lines} lines`); assert.equal(s.time, true); assert.equal(s.todos, true); assert.equal(s.hyphens, 'auto'); });

await browser.close(); server.close();
console.log(failed ? `\n${failed} editor-phone test(s) FAILED` : '\nEditor-phone tests passed.');
process.exit(failed ? 1 : 0);
