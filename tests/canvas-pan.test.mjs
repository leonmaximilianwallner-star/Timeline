// Panning the canvas (input/canvas-pull.js): Space, Shift or the middle button + drag; two fingers on touch. Never the plain drag.
// Run from the repo root:  node tests/canvas-pan.test.mjs
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
await page.waitForFunction(() => !document.getElementById('bootSnakePill'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(300);
const q = (fn, a) => page.evaluate(fn, a);
await q(() => { morphStart(0); morphRelease(1); });
await page.waitForFunction(() => UI.canvas.active && !morph.on, null, { timeout: 3000 });
await q(() => mutate(p => { p.ideas.push({ id: 'i1', tabId: activeCanvasTab().id, day: idxDate(dayIdx(todayISO()) + 2), row: 8, w: 3, h: 2, z: 1 }); }));
await page.waitForTimeout(200);
const scroll = () => q(() => [$canvasScene.scrollLeft, $canvasScene.scrollTop]);
const P = { x: 700, y: 300 };
async function drag(from, dx, dy, button = 'left'){
  await page.mouse.move(from.x, from.y); await page.mouse.down({ button });
  for (let i = 1; i <= 6; i++) await page.mouse.move(from.x + dx * i / 6, from.y + dy * i / 6);
  await page.mouse.up({ button });
}
const ideaAt = () => q(() => { document.querySelector('.idea[data-idea="i1"]').scrollIntoView({ block: 'center', inline: 'center' }); const r = document.querySelector('.idea[data-idea="i1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
const ideaPos = () => q(() => { const i = S.ideas.find(x => x.id === 'i1'); return [i.day, i.row]; });

await step('a plain drag on the empty canvas does not pan', async () => {
  const s0 = await scroll();
  await drag(P, -200, -100);
  assert.deepEqual(await scroll(), s0);
});

await step('Space + drag pans 1:1; the hand while Space is held, the closed hand while panning', async () => {
  const s0 = await scroll();
  assert.notEqual(await q(() => getComputedStyle(document.querySelector('#canvasGrid')).cursor), 'grab', 'no hand without Space');
  await page.keyboard.down('Space');
  assert.equal(await q(() => getComputedStyle(document.querySelector('#canvasGrid')).cursor), 'grab');
  await page.mouse.move(P.x, P.y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(P.x - 200 * i / 6, P.y + 100 * i / 6);
  assert.equal(await q(() => getComputedStyle(document.documentElement).cursor), 'grabbing');
  await page.mouse.up(); await page.keyboard.up('Space');
  const s1 = await scroll();
  assert.deepEqual([s1[0] - s0[0], s1[1] - s0[1]], [200, -100]);
  assert.equal(await q(() => document.documentElement.hasAttribute('data-pan-ready')), false, 'released: no hand');
});

await step('Space + drag over an idea pans; the idea stays', async () => {
  const at = await ideaAt(), p0 = await ideaPos(), s0 = await scroll();
  await page.keyboard.down('Space'); await drag(at, 120, 0); await page.keyboard.up('Space');
  assert.deepEqual(await ideaPos(), p0);
  assert.equal((await scroll())[0] - s0[0], -120);
});

await step('Shift + drag pans anywhere, over an idea too (as in CAD)', async () => {
  let s0 = await scroll();
  await page.keyboard.down('Shift'); await drag(P, 150, 50); await page.keyboard.up('Shift');
  let s1 = await scroll();
  assert.deepEqual([s1[0] - s0[0], s1[1] - s0[1]], [-150, -50]);
  const p0 = await ideaPos(), at = await ideaAt(); s0 = await scroll();
  await page.keyboard.down('Shift'); await drag(at, -80, 0); await page.keyboard.up('Shift');
  assert.deepEqual(await ideaPos(), p0, 'the idea did not move');
  assert.equal((await scroll())[0] - s0[0], 80);
  assert.equal(await q(() => !!UI.editor), false, 'nothing opened');
});

await step('the middle button pans; it is not the browser\'s autoscroll', async () => {
  const s0 = await scroll();
  await drag(P, -100, 0, 'middle');
  assert.equal((await scroll())[0] - s0[0], 100);
});

await step('Space + drag over the rail pans and changes no phase', async () => {
  await q(() => openRail(true)); await page.waitForTimeout(400);
  const before = await q(() => JSON.stringify(S.phases));
  const r = await q(() => { const b = $rail.getBoundingClientRect(); return { x: 700, y: b.top + 30 }; });
  const s0 = await scroll();
  assert.notEqual(await q(() => getComputedStyle(document.querySelector('#canvasGrid')).cursor), 'grab', 'no hand without Space');
  await page.keyboard.down('Space'); await drag(r, -120, 0); await page.keyboard.up('Space');
  assert.equal((await scroll())[0] - s0[0], 120);
  assert.equal(await q(() => JSON.stringify(S.phases)), before);
  assert.equal(await q(() => document.querySelectorAll('.ghost').length), 0);
});

await step('Space while typing types a space', async () => {
  await q(() => { const i = document.createElement('input'); i.id = 'tmpIn'; document.body.append(i); i.focus(); });
  await page.keyboard.press('Space');
  assert.equal(await q(() => document.getElementById('tmpIn').value), ' ');
  await q(() => document.getElementById('tmpIn').remove());
});

await step('touch: two fingers pan by their middle; a second finger undoes what the first began', async () => {
  const at = await ideaAt(), p0 = await ideaPos();
  const s0 = await scroll();
  await q(([x, y]) => {
    const ev = (type, id, x, y) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, isPrimary: id === 11 });
    const tgt = (x, y) => document.elementFromPoint(x, y);
    tgt(x, y).dispatchEvent(ev('pointerdown', 11, x, y));             // the first finger, on the idea
    tgt(x + 200, y).dispatchEvent(ev('pointerdown', 12, x + 200, y)); // the second
    for (let i = 1; i <= 5; i++){ window.dispatchEvent(ev('pointermove', 11, x - 20 * i, y)); window.dispatchEvent(ev('pointermove', 12, x + 200 - 20 * i, y)); }
    window.dispatchEvent(ev('pointerup', 11, x - 100, y)); window.dispatchEvent(ev('pointerup', 12, x + 100, y));
  }, [at.x, at.y]);
  await page.waitForTimeout(100);
  assert.equal((await scroll())[0] - s0[0], 100, 'the middle moved 100 left: the canvas follows');
  assert.deepEqual(await ideaPos(), p0, 'the idea stays');
  assert.equal(await q(() => UI.dragLive || !!document.querySelector('.ghost')), false);
});

await step('touch: two fingers spreading pinch toward the week, as a trackpad\'s pinch', async () => {
  await q(() => {
    const ev = (type, id, x, y) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true });
    document.elementFromPoint(600, 300).dispatchEvent(ev('pointerdown', 21, 600, 300));
    document.elementFromPoint(700, 300).dispatchEvent(ev('pointerdown', 22, 700, 300));
    for (let i = 1; i <= 8; i++){ window.dispatchEvent(ev('pointermove', 21, 600 - 30 * i, 300)); window.dispatchEvent(ev('pointermove', 22, 700 + 30 * i, 300)); }
  });
  assert.equal(await q(() => morph.on), true, 'the switch to the week runs, held by the fingers');
  await q(() => { const ev = (type, id) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', bubbles: true }); window.dispatchEvent(ev('pointerup', 21)); window.dispatchEvent(ev('pointerup', 22)); });
  await page.waitForFunction(() => !morph.on, null, { timeout: 3000 });
});

await browser.close(); server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nCanvas-pan tests passed.');
