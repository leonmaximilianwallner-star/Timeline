// Settings, Darstellung (ui/settings.js): the row is the control. A tap moves to the next value and saves it; no menu.
// Run from the repo root:  node tests/settings-rows.test.mjs
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
const dev = () => q(() => JSON.parse(localStorage.getItem(DEVICE_KEY)));
const val = id => q(id => document.querySelector(`#${id} .row-value`).textContent, id);
await page.click('#btnSettings'); await page.waitForTimeout(400);

await step('no menus left in settings: every row is a button, no select anywhere on the main page', async () => {
  assert.equal(await q(() => $set.querySelectorAll('select, .row-pick').length), 0);
  assert.deepEqual(await q(() => ['sTheme', 'sDens', 'sDayStart'].map(id => document.getElementById(id).tagName)), ['BUTTON', 'BUTTON', 'BUTTON']);
});

await step('Thema toggles dark ⇄ light at once, saved; the panel is not redrawn (the same row keeps its motion)', async () => {
  const row = await page.$('#sTheme');
  await page.click('#sTheme');
  assert.deepEqual([(await dev()).theme, await q(() => document.documentElement.dataset.theme), await val('sTheme')], ['light', 'light', 'Hell']);
  assert.equal(await row.evaluate(el => el.isConnected), true, 'the same row element');
  await page.waitForTimeout(700);
  assert.equal(await q(() => +document.querySelector('#sTheme .rays circle').getAttribute('r')), 6, 'the sun, its rays out');
  await page.click('#sTheme');
  assert.deepEqual([(await dev()).theme, await val('sTheme')], ['dark', 'Dunkel']);
});

await step('Sichtbare Tage cycles 5 → 7 → 3 → 5; the icon shows as many pills', async () => {
  const pills = () => q(() => [...document.querySelectorAll('#sDens rect')].filter(r => +r.getAttribute('opacity') === 1).length);
  for (const n of [7, 3, 5]) {
    await page.click('#sDens'); await page.waitForTimeout(500);
    assert.deepEqual([(await dev()).density, await val('sDens'), await pills(), await q(() => device.density)], [n, String(n), n, n]);
  }
});

await step('Tag beginnt um cycles 6 → 7 → 8 → 5 → 6; the day view follows; a quick double tap lands on the value', async () => {
  for (const h of [7, 8, 5, 6]) {
    await page.click('#sDayStart');
    assert.deepEqual([(await dev()).dayStart, await val('sDayStart')], [h, `${h}:00`]);
  }
  assert.equal(await q(() => Math.round(minToY(6 * 60) / NIGHT_PX)), 6, 'the night ends at 6:00');
  await page.click('#sDayStart'); await page.waitForTimeout(80); await page.click('#sDayStart'); await page.waitForTimeout(600);
  assert.equal((await dev()).dayStart, 8);
  assert.equal(await q(() => +document.querySelector('#sDayStart .sun').getAttribute('cy')), 30, 'the sun stands where 8:00 puts it');
});

await step('after a reload the values stay; a device on the old 0:00 starts at 5:00', async () => {
  await page.reload(); await page.waitForTimeout(800);
  assert.deepEqual(await q(() => [device.theme, device.density, device.dayStart]), ['dark', 5, 8]);
  await q(() => { localStorage.setItem(DEVICE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(DEVICE_KEY)), dayStart: 0 })); });
  await page.reload(); await page.waitForTimeout(800);
  assert.equal(await q(() => device.dayStart), 5);
  await page.click('#btnSettings'); await page.waitForTimeout(400);
  assert.equal(await val('sDayStart'), '5:00');
});

await browser.close(); server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nSettings-row tests passed.');
