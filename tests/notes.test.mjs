// Notes on the canvas (an idea's editor, its text, its look), one shadow and one cursor rule for every thing, stacking.
// Run from the repo root:  node tests/notes.test.mjs
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
  let body; try { body = await readFile(path); } catch { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body);
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
const box = sel => q(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const enter = async () => { await q(() => { morphStart(0); morphRelease(1); }); await page.waitForFunction(() => UI.canvas.active && !morph.on, null, { timeout: 3000 }); };

await enter();
await q(() => { const g = $canvasGrid.getBoundingClientRect(), s = $canvasScene.getBoundingClientRect(), c = Math.floor((s.left + 300 - g.left) / CANVAS_CELL), row = UI.canvas.rows - Math.floor((s.top + 300 - g.top) / CANVAS_CELL);
  mutate(p => p.ideas.push({ id: 'n1', tabId: activeCanvasTab().id, day: idxDate(c), row: row - 5, w: 6, h: 4 }, { id: 'n2', tabId: activeCanvasTab().id, day: idxDate(c + 8), row: row - 5, w: 4, h: 1 })); });

await step('a click on a note opens the events\' editor shell: title "Notiz", category, formatted text', async () => {
  const b = await box('.idea[data-idea="n1"]');
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  assert.equal(await q(() => UI.editor && UI.editor.type), 'idea');
  assert.equal(await q(() => document.getElementById('fTitle').placeholder), 'Notiz');
  assert.equal(await q(() => !!document.getElementById('editorKindBtn') && !!document.getElementById('editorDelete') && !!document.getElementById('editorSave')), true, 'the same header');
  assert.equal(await q(() => document.querySelectorAll('.text-tools button').length), 4);
});

await step('bold, italic, a list and a checklist with a tick survive saving and a reload', async () => {
  await page.click('#fTitle'); await page.keyboard.type('Ideen sammeln');
  await page.click('#fText');
  await page.click('[data-cmd="bold"]'); await page.keyboard.type('Wichtig'); await page.click('[data-cmd="bold"]');
  await page.keyboard.type(' und '); await page.click('[data-cmd="italic"]'); await page.keyboard.type('schief'); await page.click('[data-cmd="italic"]');
  await page.keyboard.press('Enter');
  await page.click('[data-cmd="checklist"]'); await page.keyboard.type('Erstens'); await page.keyboard.press('Enter'); await page.keyboard.type('Zweitens');
  const li = await box('#fText ul[data-check] > li');
  await page.mouse.click(li.x + 9, li.y + li.h / 2);
  await page.click('#editorSave'); await page.waitForTimeout(400);
  const saved = await q(() => S.ideas.find(i => i.id === 'n1'));
  assert.equal(saved.title, 'Ideen sammeln');
  assert.match(saved.body, /<b>Wichtig<\/b>/); assert.match(saved.body, /<i>schief<\/i>/);
  assert.match(saved.body, /<ul data-check="">/); assert.match(saved.body, /<li data-done="">Erstens<\/li>/);
  await page.reload(); await page.waitForTimeout(400); await enter();
  assert.equal(await q(() => S.ideas.find(i => i.id === 'n1').body), saved.body);
  assert.equal(await q(() => rowsToSend(S, null).find(r => r.id === 'n1').data.body), saved.body, 'the body travels as part of its record');
});

await step('only the allowed tags and the two markers survive (sanitize)', async () => {
  const out = await q(() => sanitize('<b onclick="x()">a</b><img src=x onerror="y()"><ul data-check="" class="c"><li data-done="" style="color:red">b</li></ul><script>z()</script>'));
  assert.equal(out, '<b>a</b><ul data-check=""><li data-done="">b</li></ul>z()');
});

await step('a note shows what its height holds: one row its title, taller its text, cut inside it', async () => {
  await q(() => mutate(p => { p.ideas.find(i => i.id === 'n2').title = 'Kurz'; p.ideas.find(i => i.id === 'n2').body = '<b>nie sichtbar</b>'; }));
  assert.deepEqual(await q(() => { const e = document.querySelector('.idea[data-idea="n2"]'); return [!!e.querySelector('.idea-title'), !!e.querySelector('.idea-body')]; }), [true, false]);
  await q(() => mutate(p => { p.ideas.find(i => i.id === 'n1').body += '<p>' + 'Viel Text. '.repeat(80) + '</p>'; }));
  const r = await q(() => { const e = document.querySelector('.idea[data-idea="n1"]'), b = e.querySelector('.idea-body'); return [b.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom, b.scrollHeight > b.clientHeight]; });
  assert.deepEqual(r, [true, true], 'cut inside the note');
});

await step('a note wears its category\'s colour as an event does', async () => {
  const c = await q(() => S.categories[0]);
  await q(id => mutate(p => { p.ideas.find(i => i.id === 'n2').categoryId = id; }), c.id);
  assert.equal(await q(() => getComputedStyle(document.querySelector('.idea[data-idea="n2"]')).backgroundColor), await q(col => { const d = document.createElement('div'); d.style.background = col + 'd0'; document.body.append(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; }, c.color));
});

await step('one shadow for every thing: flat, offset, no blur', async () => {
  const lift = await q(() => getComputedStyle(document.querySelector('.idea')).boxShadow);
  assert.equal(lift, 'rgba(0, 0, 0, 0.45) 2px 2px 0px 0px');
  await q(() => { morphStart(1); morphTo(0); morphEnd(0); }); await page.waitForTimeout(200);
  await q(() => mutate(p => { p.events.push({ id: 'e9', title: 'E', date: todayISO(), startMin: 600, endMin: 660, repeat: 'none', categoryId: null, todosByDate: {} }); }));
  const all = await q(() => [...document.querySelectorAll('.event, #tlInner .phase')].map(e => getComputedStyle(e).boxShadow));
  assert.ok(all.length > 1 && all.every(s => s === 'rgba(0, 0, 0, 0.45) 2px 2px 0px 0px'), [...new Set(all)].join(' / '));
  const blurred = await q(() => [...document.querySelectorAll('*')].map(e => getComputedStyle(e).boxShadow).filter(s => s !== 'none')
    .flatMap(s => s.split(/,(?![^(]*\))/)).filter(l => (l.match(/-?[\d.]+px/g) || [])[2] !== '0px'));   // each layer's third length is its blur
  assert.deepEqual(blurred, [], 'no blurred shadow anywhere');
});

await step('one cursor rule: a finger over things, double arrows on their handles, the grabbing hand while moving', async () => {
  await enter();
  const c = await q(() => ['.idea', '.idea .rez[data-rez="r"]', '.idea .rez[data-rez="b"]', '.idea .rez[data-rez="lt"]', '.idea .rez[data-rez="lb"]'].map(s => getComputedStyle(document.querySelector(s)).cursor));
  assert.deepEqual(c, ['pointer', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize']);
  assert.deepEqual(await q(() => [getComputedStyle(document.querySelector('#railInner .phase .rez[data-rez="r"]') || document.querySelector('#tlInner .phase .rez[data-rez="r"]')).cursor]), ['ew-resize'], 'a phase\'s handle: the same');
  const b = await box('.idea[data-idea="n2"]');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2); await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(b.x + b.w / 2 + i * 20, b.y + b.h / 2);
  assert.equal(await q(() => getComputedStyle(document.elementFromPoint(10, 300)).cursor), 'grabbing', 'everywhere while moving');
  await page.mouse.up();
});

await step('the note last moved is drawn in front, and the pointer reaches it first', async () => {
  const a = await box('.idea[data-idea="n2"]'), t = await box('.idea[data-idea="n1"]');
  await page.mouse.move(a.x + 20, a.y + a.h / 2); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(a.x + 20 + (t.x + 60 - a.x - 20) * i / 6, a.y + a.h / 2 + (t.y + 60 - a.y - a.h / 2) * i / 6);
  await page.mouse.up(); await page.waitForTimeout(100);
  assert.equal(await q(() => [...document.querySelectorAll('#canvasIdeas .idea')].at(-1).dataset.idea), 'n2');
  const n2 = await box('.idea[data-idea="n2"]');
  assert.equal(await q(([x, y]) => document.elementFromPoint(x, y).closest('.idea').dataset.idea, [n2.x + n2.w / 2, n2.y + n2.h / 2]), 'n2');
  assert.ok(await q(() => S.ideas.find(i => i.id === 'n2').z > (S.ideas.find(i => i.id === 'n1').z || 0)), 'stored, so it syncs');
});

await step('the event editor is unchanged; the phase keeps its text, now with the checklist too', async () => {
  await q(() => openEditor({ type: 'event', edit: S.events.find(e => e.id === 'e9') || S.events[0] }));
  assert.equal(await q(() => !!document.querySelector('.text-tools')), false);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await q(() => openEditor({ type: 'phase', edit: S.phases[0] }));
  assert.equal(await q(() => document.querySelectorAll('.text-tools button').length), 4);
  await page.keyboard.press('Escape');
});

await browser.close();
server.close();
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nNotes tests passed.');
