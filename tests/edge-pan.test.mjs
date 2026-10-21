// Dragging an event to the edge of the screen slides the days by, so it can land in another week.
// Run from the repo root:  node tests/edge-pan.test.mjs
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
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
};

async function open(viewport, hasTouch = false) {
  const context = await browser.newContext({ viewport, hasTouch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.clock.setSystemTime(new Date('2026-10-21T10:00:00+02:00'));
  await page.goto(APP);
  await page.waitForTimeout(500);
  return page;
}
/* the one-off event of the starting plan, scrolled into view; its box on screen */
async function target(page) {
  return page.evaluate(() => {
    const ev = S.events.find(e => e.repeat === 'none');
    const el = document.querySelector(`.event[data-ev="${ev.id}"]`);
    $scene.scrollTop = $dayWrap.offsetTop + el.offsetTop - 120;
    const r = el.getBoundingClientRect(), s = $scene.getBoundingClientRect();
    return { id: ev.id, date: ev.date, x: r.left + r.width / 2, y: r.top + r.height / 2, right: s.right, left: s.left };
  });
}
const dateOf = (page, id) => page.evaluate(id => S.events.find(e => e.id === id).date, id);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

await step('mouse: held at the right edge, the event travels into a later week', async () => {
  const page = await open({ width: 1440, height: 900 });
  const t = await target(page);
  const before = await page.evaluate(() => $scene.scrollLeft);
  await page.mouse.move(t.x, t.y); await page.mouse.down();
  await page.mouse.move(t.x + 40, t.y, { steps: 4 });
  await page.mouse.move(t.right - 8, t.y, { steps: 10 });
  await page.waitForTimeout(1500);                                 // dwell at the edge
  assert.ok(await page.evaluate(() => $scene.classList.contains('panning')), 'snapping is paused while panning');
  await page.mouse.up();
  const after = await page.evaluate(() => $scene.scrollLeft);
  assert.ok(after - before > 600, `the view slid (${after - before} px)`);
  const moved = daysBetween(t.date, await dateOf(page, t.id));
  assert.ok(moved >= 7, `moved ${moved} days`);
  assert.equal(await page.evaluate(() => $scene.classList.contains('panning')), false, 'snapping is back after the drop');
  await page.context().close();
});

await step('mouse: held at the left edge, it travels back', async () => {
  const page = await open({ width: 1440, height: 900 });
  const t = await target(page);
  await page.mouse.move(t.x, t.y); await page.mouse.down();
  await page.mouse.move(t.x - 40, t.y, { steps: 4 });
  await page.mouse.move(t.left + 140, t.y, { steps: 10 });         // the hour rail covers the left edge: the zone starts at the scene's edge
  await page.mouse.move(t.left + 8, t.y, { steps: 4 });
  await page.waitForTimeout(1200);
  await page.mouse.up();
  const moved = daysBetween(t.date, await dateOf(page, t.id));
  assert.ok(moved <= -5, `moved ${moved} days`);
  await page.context().close();
});

await step('just passing the edge does not pan (it needs a short dwell)', async () => {
  const page = await open({ width: 1440, height: 900 });
  const t = await target(page);
  const before = await page.evaluate(() => $scene.scrollLeft);
  await page.mouse.move(t.x, t.y); await page.mouse.down();
  await page.mouse.move(t.right - 8, t.y, { steps: 10 });
  await page.mouse.move(t.right - 200, t.y, { steps: 2 });         // straight back out
  await page.mouse.up();
  assert.ok(Math.abs((await page.evaluate(() => $scene.scrollLeft)) - before) < 5);
  await page.context().close();
});

await step('resizing an event never pans sideways', async () => {
  const page = await open({ width: 1440, height: 900 });
  const box = await page.evaluate(() => {
    const ev = S.events.find(e => e.repeat === 'none');
    const el = document.querySelector(`.event[data-ev="${ev.id}"]`);
    $scene.scrollTop = $dayWrap.offsetTop + el.offsetTop - 120;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, bottom: r.bottom - 2, right: $scene.getBoundingClientRect().right };
  });
  const before = await page.evaluate(() => $scene.scrollLeft);
  await page.mouse.move(box.x, box.bottom); await page.mouse.down();
  await page.mouse.move(box.right - 8, box.bottom + 60, { steps: 10 });
  await page.waitForTimeout(800);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => $scene.scrollLeft), before);
  await page.context().close();
});

await browser.close(); server.close();
console.log(failed ? `\n${failed} edge-pan test(s) FAILED` : '\nEdge-pan tests passed.');
process.exit(failed ? 1 : 0);
