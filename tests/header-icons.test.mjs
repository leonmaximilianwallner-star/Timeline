// The header's icons and the add button's (ui/header-icons.js): each drives what it drove, and follows its state.
// Run from the repo root:  node tests/header-icons.test.mjs
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
const pose = () => q(() => document.querySelector('#btnSettings .glyph').dataset.pose);
const timeD = () => q(() => document.querySelector('#btnBudget .arc').getAttribute('d'));
const fabArm = () => q(() => document.querySelector('#fab .arm4').getAttribute('d'));

await step('every header button and the add button carry the new icon, and nothing else', async () => {
  assert.deepEqual(await q(() => ['btnUndo', 'btnRedo', 'btnToday', 'btnBudget', 'btnSettings', 'fab'].map(id => {
    const b = document.getElementById(id); return [b.children.length, b.firstElementChild.classList.contains('glyph')]; })),
    Array(6).fill([1, true]));
  const box = await q(() => { const r = document.querySelector('#btnBudget .glyph').getBoundingClientRect(); return [r.width, r.height]; });
  assert.deepEqual(box, [20, 20], 'drawn at 20 px');
});

await step('settings: rows at rest, columns while open, rows again however it closes (button, Escape, a tap outside)', async () => {
  assert.equal(await pose(), 'rows');
  await page.click('#btnSettings'); await page.waitForTimeout(80);
  assert.equal(await pose(), 'dots', 'through the three dots');
  await page.waitForTimeout(400);
  assert.deepEqual([await pose(), await q(() => UI.settingsOpen)], ['cols', true]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  assert.deepEqual([await pose(), await q(() => UI.settingsOpen)], ['rows', false], 'Escape');
  await page.click('#btnSettings'); await page.waitForTimeout(500);
  await page.mouse.click(300, 500); await page.waitForTimeout(500);
  assert.deepEqual([await pose(), await q(() => UI.settingsOpen)], ['rows', false], 'a tap outside');
});

await step('time: the pie turns into the ring while the budget is open, and back however it closes', async () => {
  const pie = await timeD();
  await page.click('#btnBudget'); await page.waitForTimeout(900);
  assert.equal(await q(() => UI.budgetOpen), true);
  const ring = await timeD();
  assert.notEqual(ring, pie);
  assert.ok(await q(() => +document.querySelector('#btnBudget .dot').getAttribute('r')) > 7, 'the dot is out');
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  assert.equal(await timeD(), pie, 'back to the pie, exactly');
});

await step('add: plus at rest, X in add mode, plus when it ends; a quick double toggle lands where the state is', async () => {
  const plus = await fabArm();
  await page.click('#fab'); await page.waitForTimeout(700);
  assert.equal(await q(() => UI.addMode), true);
  assert.notEqual(await fabArm(), plus, 'an X');
  await page.keyboard.press('Escape'); await page.waitForTimeout(700);
  assert.equal(await fabArm(), plus, 'a plus again (Escape)');
  await page.click('#fab'); await page.waitForTimeout(60); await page.click('#fab'); await page.waitForTimeout(800);
  assert.deepEqual([await q(() => UI.addMode), await fabArm()], [false, plus], 'interrupted: no half shape left');
});

await step('undo, redo and now: still do what they did; their icons play from the button and the key', async () => {
  await q(() => mutate(p => { p.events.push({ id: 'evH', title: 'H', date: todayISO(), startMin: 600, endMin: 660, repeat: 'none', categoryId: null, todosByDate: {} }); }));
  await page.click('#btnUndo'); await page.waitForTimeout(50);
  assert.equal(await q(() => S.events.some(e => e.id === 'evH')), false, 'undone');
  assert.equal(await q(() => document.querySelector('#btnUndo .glyph').classList.contains('go')), true, 'the undo arrow plays');
  await page.keyboard.press('Control+y'); await page.waitForTimeout(50);
  assert.equal(await q(() => S.events.some(e => e.id === 'evH')), true, 'redone by the key');
  assert.equal(await q(() => document.querySelector('#btnRedo .glyph').classList.contains('go')), true, 'the redo arrow plays');
  await page.click('#btnToday'); await page.waitForTimeout(150);
  assert.ok(await q(() => +document.querySelector('#btnToday .ring').getAttribute('r')) < 28, 'the ring closes in');
  await page.waitForTimeout(600);
  assert.equal(await q(() => +document.querySelector('#btnToday .ring').getAttribute('r')), 28, 'and opens again');
});

await step('reduced motion: every icon lands at once', async () => {
  const p2 = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
  await p2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p2.goto(APP);
  await p2.waitForFunction(() => !document.getElementById('bootSnakePill'), null, { timeout: 8000 }).catch(() => {});
  await p2.waitForTimeout(300);
  await p2.click('#btnSettings');
  const s = await p2.evaluate(() => [UI.settingsOpen, document.querySelector('#btnSettings .glyph').dataset.pose,
    parseFloat(getComputedStyle(document.querySelector('#btnSettings .piece')).transitionDuration) < .01]);
  assert.deepEqual(s, [true, 'cols', true]);
  await p2.keyboard.press('Escape'); await p2.click('#btnBudget');
  assert.equal(await p2.evaluate(() => +document.querySelector('#btnBudget .dot').getAttribute('r')), 8, 'the ring at once');
  await p2.close();
});

await browser.close(); server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nHeader-icon tests passed.');
