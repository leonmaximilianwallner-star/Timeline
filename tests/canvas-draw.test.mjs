// The add button in every view, and draw mode on the canvas (input/canvas-draw.js).
// Run from the repo root:  node tests/canvas-draw.test.mjs
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
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', e => { failed++; console.error('✗ page error:', e.message); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(APP);
await page.waitForFunction(() => !document.getElementById('tl-loader'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(300);
const q = (fn, a) => page.evaluate(fn, a);
const enter = async () => { await q(() => { morphStart(0); morphRelease(1); }); await page.waitForFunction(() => UI.canvas.active && !morph.on, null, { timeout: 3000 }); };
const ideas = () => q(() => S.ideas.map(({ w, h, row, day, tabId }) => ({ w, h, row, day, tabId })));
/* the centre of a cell, in the window: columns from the left edge of the view, rows up from a line well above the rail */
const cell = async (col, rowUp) => q(([col, rowUp]) => {
  const g = $canvasGrid.getBoundingClientRect(), s = $canvasScene.getBoundingClientRect();
  const c = Math.floor((s.left + 200 - g.left) / CANVAS_CELL) + col, r = Math.floor((s.top + 600 - g.top) / CANVAS_CELL) - rowUp;
  return { x: g.left + (c + 0.5) * CANVAS_CELL, y: g.top + (r + 0.5) * CANVAS_CELL, c, r };
}, [col, rowUp]);
async function drag(from, to, { release = true } = {}){
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  const n = 6;
  for (let i = 1; i <= n; i++) await page.mouse.move(from.x + (to.x - from.x) * i / n, from.y + (to.y - from.y) * i / n);
  if (release) await page.mouse.up();
}

await step('the add button in the week: add mode, as before', async () => {
  assert.equal(await q(() => getComputedStyle($fab).visibility), 'visible');
  await page.click('#fab');
  assert.equal(await q(() => UI.addMode), true);
  await page.click('#fab');
  assert.equal(await q(() => UI.addMode), false);
});

await step('in the canvas the same button turns draw mode on and off; Escape ends it, not the canvas', async () => {
  await enter();
  assert.equal(await q(() => getComputedStyle($fab).visibility), 'visible');
  await page.click('#fab');
  assert.equal(await q(() => UI.drawMode && $fab.classList.contains('on') && UI.addMode === false), true);
  assert.equal(await q(() => getComputedStyle($canvasScene).touchAction), 'none', 'a finger draws, set before the gesture');
  await page.click('#fab');
  assert.equal(await q(() => UI.drawMode || $fab.classList.contains('on')), false);
  assert.equal(await q(() => getComputedStyle($canvasScene).touchAction), 'auto');
  await page.click('#fab'); await page.keyboard.press('Escape');
  assert.equal(await q(() => UI.drawMode), false);
  assert.equal(await q(() => UI.canvas.active && !morph.on), true, 'still in the canvas');
});

await step('one row: a pill on the cells, corners on the dots; draw mode ends after one', async () => {
  await page.click('#fab');
  const a = await cell(0, 0), b = await cell(3, 0);
  await drag(a, b, { release: false });
  const pv = await q(() => { const p = document.querySelector('.idea.preview'), r = p.getBoundingClientRect(), g = $canvasGrid.getBoundingClientRect();
    return { pill: p.classList.contains('pill'), l: r.left - g.left, b: g.bottom - r.bottom, w: r.width, h: r.height }; });
  assert.equal(pv.pill, true);
  assert.deepEqual([pv.l % 40, pv.b % 40, pv.w, pv.h], [0, 0, 160, 40], 'snapped: four cells, one row, edges on the 40 px lattice');
  await page.mouse.up();
  const list = await ideas();
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].w, list[0].h], [4, 1]);
  assert.equal(await q(() => UI.drawMode), false, 'one-shot');
  assert.equal(await q(() => document.querySelectorAll('#canvasIdeas .idea.pill:not(.preview)').length), 1);
  assert.equal(await q(() => document.querySelectorAll('.idea.preview').length), 0);
});

await step('the type follows the rows live; up and to the left works; a squircle covers the cells', async () => {
  await page.click('#fab');
  const a = await cell(6, 0);
  await drag(a, await cell(4, 0), { release: false });
  assert.equal(await q(() => document.querySelector('.idea.preview').classList.contains('pill')), true);
  const up = await cell(4, 2);
  await page.mouse.move(up.x, up.y);
  assert.equal(await q(() => document.querySelector('.idea.preview').classList.contains('pill')), false, 'crossing a row: a squircle, at once');
  await page.mouse.up();
  const i = (await ideas()).at(-1);
  assert.deepEqual([i.w, i.h], [3, 3]);
  assert.equal(await q(() => getComputedStyle(document.querySelectorAll('#canvasIdeas .idea')[1]).borderRadius), '8px');
});

await step('a click or a drag inside one cell draws nothing and keeps draw mode', async () => {
  await page.click('#fab');
  const a = await cell(10, 0), n = (await ideas()).length;
  await page.mouse.click(a.x, a.y);
  await drag(a, { x: a.x + 12, y: a.y + 8 });
  assert.equal((await ideas()).length, n);
  assert.equal(await q(() => UI.drawMode), true);
});

await step('Escape, the add button or pointercancel mid-drag leave nothing behind', async () => {
  const n = (await ideas()).length;
  const a = await cell(10, 0), b = await cell(13, 1);
  await drag(a, b, { release: false });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal((await ideas()).length, n); assert.equal(await q(() => !!document.querySelector('.idea.preview') || UI.drawMode), false);
  await page.click('#fab');
  await drag(a, b, { release: false });
  await q(() => setDrawMode(!UI.drawMode));                      // what the button's click runs
  await page.mouse.up();
  assert.equal((await ideas()).length, n); assert.equal(await q(() => !!document.querySelector('.idea.preview')), false);
  await page.click('#fab');
  await drag(a, b, { release: false });
  await q(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })));
  await page.mouse.up();
  assert.equal((await ideas()).length, n); assert.equal(await q(() => !!document.querySelector('.idea.preview')), false);
  assert.equal(await q(() => UI.drawMode), true, 'a cancel keeps the mode');
  await page.keyboard.press('Escape');
});

await step('outside draw mode a drag still pans', async () => {
  const x0 = await q(() => $canvasScene.scrollLeft), n = (await ideas()).length;
  await drag(await cell(10, 0), await cell(6, 0));
  assert.ok(await q(() => $canvasScene.scrollLeft) > x0 + 100);
  assert.equal((await ideas()).length, n);
});

await step('ideas belong to their tab; they persist after a reload and travel as records', async () => {
  await page.click('#canvasTabs [data-create]'); await page.keyboard.press('Enter');
  assert.equal(await q(() => document.querySelectorAll('#canvasIdeas .idea').length), 0, 'a new tab is empty');
  await page.click('#canvasTabs .canvas-tab:first-child');
  assert.equal(await q(() => document.querySelectorAll('#canvasIdeas .idea').length), 2);
  const before = await ideas();
  await page.reload(); await page.waitForTimeout(300); await enter();
  assert.deepEqual(await ideas(), before);
  assert.equal(await q(() => document.querySelectorAll('#canvasIdeas .idea').length), 2);
  assert.equal(await q(() => rowsToSend(S, null).filter(r => r.list === 'ideas').length), 2);
});

await step('leaving the canvas ends draw mode; the week\'s add mode is untouched', async () => {
  await page.click('#fab');
  await q(() => { morphStart(1); morphRelease(0); });
  await page.waitForFunction(() => !UI.canvas.active && !morph.on);
  assert.equal(await q(() => UI.drawMode || $fab.classList.contains('on') || document.documentElement.hasAttribute('data-draw')), false);
});

await browser.close();
server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nCanvas-draw tests passed.');
