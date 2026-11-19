// The canvas's tabs (views/canvas/tabs.js): the first tab from existing data, creating, switching, renaming, reload, two devices.
// Run from the repo root:  node tests/canvas-tabs.test.mjs
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

async function open(context){
  const page = await context.newPage();
  page.on('pageerror', e => { failed++; console.error('✗ page error:', e.message); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(APP);
  await page.waitForFunction(() => !document.getElementById('tl-loader'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return page;
}
const enter = async page => { await page.evaluate(() => { morphStart(0); morphRelease(1); }); await page.waitForFunction(() => UI.canvas.active && !morph.on, null, { timeout: 3000 }); };
const names = page => page.$$eval('#canvasTabs .canvas-tab', els => els.map(e => (e.tagName === 'INPUT' ? e.value : e.textContent) + (e.classList.contains('active') ? '*' : '')));

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await open(context);

await step('existing data (no tabs yet) gets one tab, "Canvas", and keeps everything else', async () => {
  const before = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || JSON.stringify(S));
    delete d.canvasTabs;                                         // as stored by the version before tabs
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
    return RECORD_LISTS.filter(l => l !== 'canvasTabs').map(l => JSON.stringify(d[l] || []));
  });
  await page.reload();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => RECORD_LISTS.filter(l => l !== 'canvasTabs').map(l => JSON.stringify(S[l] || [])));
  assert.deepEqual(after, before, 'every other record unchanged');
  assert.deepEqual(await page.evaluate(() => S.canvasTabs.map(t => t.name)), ['Canvas']);
  await enter(page);
  assert.deepEqual(await names(page), ['Canvas*']);
});

await step('+ creates an empty tab, shows it, and opens its name; Enter on empty keeps "Canvas"', async () => {
  await page.click('#canvasTabs [data-create]');
  assert.equal(await page.evaluate(() => document.activeElement.matches('input.canvas-tab')), true, 'the name is open for typing');
  assert.equal(await page.evaluate(() => document.activeElement.value), '');
  await page.keyboard.press('Enter');
  assert.deepEqual(await names(page), ['Canvas', 'Canvas*']);
  assert.equal(await page.evaluate(() => UI.canvas.active), true);
});

await step('rename the shown tab: Enter saves, Escape cancels (and stays in the canvas), blur saves, empty is "Canvas"', async () => {
  const active = '#canvasTabs .canvas-tab.active';
  await page.click(active); await page.keyboard.type('Thesis'); await page.keyboard.press('Enter');
  assert.deepEqual(await names(page), ['Canvas', 'Thesis*']);
  await page.click(active); await page.keyboard.type('Nope'); await page.keyboard.press('Escape');
  assert.deepEqual(await names(page), ['Canvas', 'Thesis*']);
  assert.equal(await page.evaluate(() => UI.canvas.active && !morph.on), true, 'Escape did not leave the canvas');
  await page.click(active); await page.keyboard.type('Ideen'); await page.mouse.click(700, 500);   // blur
  assert.deepEqual(await names(page), ['Canvas', 'Ideen*']);
  await page.click(active); await page.keyboard.press('Backspace'); await page.keyboard.press('Enter');
  assert.deepEqual(await names(page), ['Canvas', 'Canvas*']);
  await page.click(active); await page.keyboard.type('Ideen'); await page.keyboard.press('Enter');
});

await step('a click on another tab shows it; each keeps its own height, the date stays put', async () => {
  const [first, second] = await page.$$eval('#canvasTabs .canvas-tab', els => els.map(e => e.dataset.id));
  const left = await page.evaluate(() => $canvasScene.scrollLeft);
  await page.evaluate(() => { $canvasScene.scrollTop -= 1200; });               // up, on "Ideen"
  const upHere = await page.evaluate(() => $canvasScene.scrollHeight - $canvasScene.scrollTop);
  await page.click(`[data-id="${first}"]`);
  assert.deepEqual(await names(page), ['Canvas*', 'Ideen']);
  assert.equal(await page.evaluate(() => $canvasScene.scrollTop >= $canvasScene.scrollHeight - $canvasScene.clientHeight - 1), true, 'a tab not seen yet: its floor');
  assert.equal(await page.evaluate(() => $canvasScene.scrollLeft), left, 'no jump in time');
  await page.click(`[data-id="${second}"]`);
  assert.equal(await page.evaluate(() => $canvasScene.scrollHeight - $canvasScene.scrollTop), upHere, 'back where it was');
  assert.equal(await page.evaluate(() => $canvasScene.scrollLeft), left);
  assert.equal(await page.evaluate(() => device.canvasTab), second);
});

await step('undo removes a created tab; the shown tab falls back to the first', async () => {
  await page.click('#canvasTabs [data-create]'); await page.keyboard.press('Enter');
  assert.equal((await names(page)).length, 3);
  await page.evaluate(() => undo());
  assert.deepEqual(await names(page), ['Canvas*', 'Ideen'], 'the shown tab is gone: the first');
  await page.click('#canvasTabs .canvas-tab:nth-child(2)');
});

await step('a reload shows the same tabs, names and shown tab', async () => {
  await page.reload(); await page.waitForTimeout(300); await enter(page);
  assert.deepEqual(await names(page), ['Canvas', 'Ideen*']);
});

await step('the tab bar scrolls sideways on a phone, never wraps', async () => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await open(phone); await enter(p);
  await p.evaluate(() => mutate(plan => { for (let i = 1; i < 9; i++) plan.canvasTabs.push({ id: 't' + i, name: 'Ein langer Name ' + i, order: i }); }));
  const box = await p.$eval('#canvasTabs', el => ({ h: el.offsetHeight, sw: el.scrollWidth, cw: el.clientWidth }));
  assert.equal(box.h, 44);
  assert.ok(box.sw > box.cw, 'overflows sideways');
  assert.equal(await p.$eval('#canvasTabs', el => el.scrollHeight === el.clientHeight), true, 'one line: nothing below it');
  await phone.close();
});

/* two devices: what one sends, the other applies (data/merge.js); the transport itself is tests/sync.test.mjs */
await step('two devices: one first tab between them, and a rename on either reaches the other', async () => {
  const a = await open(await browser.newContext()), b = await open(await browser.newContext());
  const send = (from, to) => from.evaluate(() => rowsToSend(S, null)).then(rows => to.evaluate(rows => { applyRows(S, rows); persist(); renderAll(); }, rows));
  await send(a, b); await send(b, a);
  for (const p of [a, b]) assert.deepEqual(await p.evaluate(() => S.canvasTabs.map(t => t.id + ':' + t.name)), ['canvas:Canvas'], 'one tab, not two');
  await a.evaluate(() => mutate(plan => { plan.canvasTabs[0].name = 'Thesis'; plan.canvasTabs.push({ id: 'x', name: 'Ideen', order: 1 }); }));
  await b.evaluate(() => { localStorage.removeItem(STORE_KEY); });  // b starts the new version later: its default must not win
  await b.reload(); await b.waitForTimeout(300);
  await send(a, b); await send(b, a);
  for (const p of [a, b]) assert.deepEqual(await p.evaluate(() => canvasTabList().map(t => t.name)), ['Thesis', 'Ideen']);
  /* a device joining after another: the server's plan, through today's shape (data/sync.js) */
  const joined = await b.evaluate(() => toCurrentShape(planFromRows([])).canvasTabs.map(t => t.name));
  assert.deepEqual(joined, ['Canvas'], 'a plan from the server without tabs still has one');
});

await browser.close();
server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nCanvas-tab tests passed.');
