// Tests for the data layer in the running app (ARCHITECTURE.md §5, step 3).
// Run from the repo root:  node tests/data-layer.test.mjs
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
const URL_ = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// Opens the app in a fresh browser profile; `before` may fill localStorage before the app starts.
async function open(before) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (before) await page.addInitScript(before);
  await page.goto(URL_);
  await page.waitForTimeout(500);
  page.errors = errors;
  return page;
}
const stored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const data = async page => JSON.parse(await stored(page, 'timeline.data.v3'));
const device = async page => JSON.parse(await stored(page, 'timeline.device.v1') || 'null');
const LISTS = ['categories', 'phases', 'exams', 'events'];

const V2 = JSON.stringify({
  categories: [{ id: 'seminar', name: 'Seminararbeit', color: '#40838b', start: '2026-10-01', end: '2026-11-30', milestones: [] }],
  phases: [{ id: 'p1', title: 'Schreiben', categoryId: 'seminar', start: '2026-10-15', end: '2026-10-30', details: '', expanded: true, _lane: 0 }],
  exams: [], events: [{ id: 'e1', title: 'Tutorium', categoryId: null, date: '2026-10-21', startMin: 540, endMin: 660, repeat: 'none', reminderMin: null, todos: [] }],
  settings: { theme: 'light', density: 3 },
});

const tests = {
  async 'first start: the plan is saved in the new shape, every record stamped'(page) {
    const d = await data(page);
    assert.equal(d.version, 3);
    assert.equal(d.settings, undefined);
    for (const l of LISTS) for (const r of d[l]) assert.ok(r.updatedAt, `${l}/${r.id} has no stamp`);
    for (const p of d.phases) { assert.equal(p.expanded, undefined); assert.equal(p._lane, undefined); }
    assert.deepEqual(d.deleted, {});
  },
  async 'a reload keeps every stamp (nothing counts as changed)'(page) {
    const first = await stored(page, 'timeline.data.v3');
    await page.reload(); await page.waitForTimeout(400);
    assert.equal(await stored(page, 'timeline.data.v3'), first);
  },
  async 'opening a phase dropdown changes device state, not the plan'(page) {
    const first = await stored(page, 'timeline.data.v3');
    await page.locator('.ph-exp').first().click(); await page.waitForTimeout(200);
    assert.equal((await device(page)).openPhases.length, 1);
    assert.equal(await stored(page, 'timeline.data.v3'), first);
    assert.equal(await page.locator('.dropdown').count(), 1);
  },
  async 'changing theme and days changes device state, not the plan'(page) {
    const first = await stored(page, 'timeline.data.v3');
    await page.click('#btnSettings');
    await page.click('#sTheme button[data-t="light"]');
    await page.click('#sDens button[data-d="3"]');
    const dv = await device(page);
    assert.equal(dv.theme, 'light'); assert.equal(dv.density, 3);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    assert.equal(await stored(page, 'timeline.data.v3'), first);
  },
  async 'cancelling the editor drops todo changes'(page) {
    const before = (await data(page)).events;
    await page.locator('.event').nth(1).click();
    await page.click('#todoPanelEdit');
    await page.fill('#fNewTodo', 'nur ein Versuch');
    await page.click('#fAddTodo');
    await page.click('#editorClose');
    await page.waitForTimeout(200);
    assert.deepEqual((await data(page)).events, before);
    assert.equal(await page.evaluate(() => S.events.some(e => e.todos.some(t => t.text === 'nur ein Versuch'))), false);
  },
  async 'saving the editor keeps todo changes and stamps only that event'(page) {
    const before = (await data(page)).events;
    await page.locator('.event').nth(1).click();
    const id = await page.evaluate(() => UI.todoPanel.evId);
    await page.click('#todoPanelEdit');
    await page.fill('#fNewTodo', 'Folien hochladen');
    await page.click('#fAddTodo');
    await page.click('#editorSave');
    await page.waitForTimeout(200);
    const after = (await data(page)).events;
    const ev = after.find(e => e.id === id);
    assert.ok(ev.todos.some(t => t.text === 'Folien hochladen'));
    assert.notEqual(ev.updatedAt, before.find(e => e.id === id).updatedAt);
    for (const e of after) if (e.id !== id) assert.equal(e.updatedAt, before.find(b => b.id === e.id).updatedAt);
  },
  async 'deleting is remembered; undo brings the event back and forgets the deletion'(page) {
    await page.locator('.event').nth(1).click();
    const id = await page.evaluate(() => UI.todoPanel.evId);
    await page.click('#todoPanelEdit');
    await page.click('#editorDelete');
    await page.waitForTimeout(200);
    let d = await data(page);
    assert.equal(d.events.some(e => e.id === id), false);
    assert.equal(d.deleted[id].in, 'events');
    await page.click('#btnUndo'); await page.waitForTimeout(200);
    d = await data(page);
    assert.equal(d.events.some(e => e.id === id), true);
    assert.equal(d.deleted[id], undefined);
  },
};

const v2Tests = {
  async 'V2 data is copied into the new shape; the V2 copy stays untouched'(page) {
    assert.equal(await stored(page, 'timeline.app.v2'), V2);
    const d = await data(page);
    assert.equal(d.events[0].title, 'Tutorium');
    assert.equal(d.phases[0].expanded, undefined);
    assert.equal(d.phases[0]._lane, undefined);
    assert.ok(d.phases[0].updatedAt);
  },
  async "V2's theme, days and open dropdowns move to this device"(page) {
    const dv = await device(page);
    assert.equal(dv.theme, 'light'); assert.equal(dv.density, 3);
    assert.deepEqual(dv.openPhases, ['p1']);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  },
};

let failed = 0;
async function run(group, before) {
  const page = await open(before);
  for (const [name, fn] of Object.entries(group)) {
    try { await fn(page); console.log('✓', name); }
    catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
  }
  if (page.errors.length) { failed++; console.error('✗ page errors:', page.errors); }
  await page.context().close();
}
await run(tests);
await run(v2Tests, `localStorage.setItem('timeline.app.v2', ${JSON.stringify(V2)})`);
await browser.close(); server.close();
console.log(failed ? `\n${failed} data-layer test(s) FAILED` : '\nData-layer tests passed.');
process.exit(failed ? 1 : 0);
