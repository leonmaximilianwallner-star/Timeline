// The canvas view above the timeline: moving between them by the wheel (1:1, a barrier, settle or fall back), the rail, panning.
// Run from the repo root:  node tests/canvas.test.mjs
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

/* a desktop screen, with the motions running (they are what is tested) */
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(APP);
await page.waitForFunction(() => !document.getElementById('tl-loader'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);

const q = (fn, a) => page.evaluate(fn, a);
const wheel = async (dy, n, dx = 0) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(dx, dy); await page.waitForTimeout(16); } };
const settle = () => page.waitForFunction(() => !morph.on, null, { timeout: 3000 });
const view = () => q(() => document.documentElement.dataset.view || 'week');
const atFloor = () => q(() => $canvasScene.scrollTop >= $canvasScene.scrollHeight - $canvasScene.clientHeight - 1);
/* in: a fresh gesture up from the timeline's top, all the way */
async function enter(){ await q(() => { $scene.scrollTop = 0; }); await page.mouse.move(700, 300); await page.waitForTimeout(200); await wheel(-80, 12); await settle(); }

await step('a fling that runs into the top of the week does not pull', async () => {
  await page.mouse.move(700, 300);
  await q(() => { $scene.scrollTop = 400; });
  await wheel(-60, 20);                                     // one gesture: starts below the top, keeps going past it
  assert.equal(await q(() => $scene.scrollTop), 0);
  assert.equal(await q(() => morph.on), false);
  await page.waitForTimeout(300);
  assert.equal(await q(() => UI.canvas.shown), false);
});

await step('the pull follows the wheel 1:1; short of the barrier, let go, it falls back, nothing left behind', async () => {
  await page.waitForTimeout(200);
  await wheel(-40, 3);
  assert.equal(await q(() => morph.on), true);
  assert.ok(await q(() => Math.abs(morph.p * morph.floor - 120) < 1), '120 px of wheel, 120 px of movement');
  assert.match(await q(() => $tlWrap.style.transform), /translateY\(120px\)/, 'the band moves with it');
  assert.match(await q(() => $dayWrap.style.transform), /translateY\(120px\)/, 'the day view moves with it, as one sheet');
  assert.equal(await q(() => $scene.style.transform), '', 'the week\'s scroller never moves');
  await page.waitForTimeout(80);
  assert.ok(await q(() => Math.abs(morph.p * morph.floor - 120) < 1), 'nothing plays while the hand holds it');
  await settle();
  assert.equal(await view(), 'week');
  assert.equal(await q(() => UI.canvas.shown), false);
  assert.equal(await q(() => [$tlWrap, $dayWrap, $railInner, $canvasView].map(el => el.style.transform + el.style.opacity).join('')), '');
});

await step('a zoom, not a stretch: in between nothing is scaled; at the end the band lies exactly on the rail', async () => {
  const r = await q(() => {
    morphStart(0); morphTo(0.5);
    const between = [$tlWrap, $dayWrap].every(el => !/scale/.test(el.style.transform));
    const pill = $tlWrap.querySelector('.phase'), line = $tlWrap.querySelector('.todayLine');
    const shapes = [pill.getBoundingClientRect().height, line.getBoundingClientRect().width];
    morphTo(1);
    const at = el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width].map(Math.round).join(); };
    const same = [...$tlWrap.querySelectorAll('.phase')].every(el => at(el) === at($railInner.querySelector(`.phase[data-phase="${el.dataset.phase}"]`)));
    morphRelease(0);
    return { between, shapes, same };
  });
  await settle();
  assert.equal(r.between, true, 'no scale transform');
  assert.deepEqual(r.shapes, [24, 2], 'a pill keeps its height, the today line its width');
  assert.equal(r.same, true, 'every pill on its twin in the rail');
});

await step('past the barrier, let go, it goes on to the canvas; the day at the left edge is kept', async () => {
  const day = await q(() => weekLeftDay());
  await page.waitForTimeout(200);
  const n = await q(() => Math.ceil((window.innerHeight * 0.6) / 40));   // well past the barrier, short of the end
  await wheel(-40, Math.min(n, 8));
  assert.ok(await q(() => morph.p > BARRIER && morph.p < 1), 'between: ' + await q(() => morph.p));
  await settle();
  assert.equal(await view(), 'canvas');
  assert.ok(Math.abs(await q(() => canvasLeftDay()) - day) < 0.01, 'same day at the left edge');
  assert.equal(await atFloor(), true, 'at the floor');
  assert.ok(await q(() => +getComputedStyle($canvasView).zIndex > +getComputedStyle($scene).zIndex), 'the canvas covers the week');
  assert.equal(await q(() => document.elementFromPoint(700, 400).closest('#canvasView') !== null), true, 'the canvas gets the pointer');
});

await step('scrolling again while it settles catches it', async () => {
  await page.mouse.move(700, 400); await page.waitForTimeout(200);
  await wheel(40, 2);                                       // out a little: short of the barrier, it will settle back
  await page.waitForTimeout(150);                           // let go: settling
  assert.equal(await q(() => morph.on), true);
  await wheel(80, 8);                                       // caught, and pulled all the way
  await settle();
  assert.equal(await view(), 'week');
  assert.equal(await q(() => $scene.scrollTop), 0);
});

await step('the rail is the timeline at the canvas scale, closed until hovered', async () => {
  await enter();
  const phase = await q(() => S.phases[0].id);
  const w = await q(id => $railInner.querySelector(`.phase[data-phase="${id}"]`).offsetWidth, phase);
  const want = await q(id => { const p = S.phases.find(x => x.id === id); return Math.max(diffDays(p.start, p.end) * CANVAS_CELL, 26); }, phase); assert.equal(w, want, 'phase width ' + w + ' vs ' + want);
  await page.waitForTimeout(300);   // it closes with a motion after landing open
  assert.equal(await q(() => $rail.offsetHeight), await q(() => UI.canvas.railThinH), 'closed height');
  assert.equal(await q(() => $railInner.querySelectorAll('.dropdown').length), 0, 'no dropdowns in the rail');
  await page.mouse.move(700, 885); await page.waitForTimeout(500);
  assert.equal(await q(() => UI.canvas.railOpen), true);
  await page.mouse.move(700, 300); await page.waitForTimeout(600);
  assert.equal(await q(() => UI.canvas.railOpen), false);
});

await step('the rail moves with the canvas, sideways, exactly', async () => {
  const x0 = await q(() => $railInner.querySelector('.phase').getBoundingClientRect().left), s0 = await q(() => $canvasScene.scrollLeft);
  await wheel(0, 10, 80); await page.waitForTimeout(150);
  const x1 = await q(() => $railInner.querySelector('.phase').getBoundingClientRect().left), s1 = await q(() => $canvasScene.scrollLeft);
  assert.ok(s1 - s0 > 400, 'the canvas scrolled');
  assert.equal(Math.round(x0 - x1), Math.round(s1 - s0));
});

await step('dragging the empty grid pans the canvas', async () => {
  const s0 = await q(() => $canvasScene.scrollLeft);
  await page.mouse.move(800, 300); await page.mouse.down(); await page.mouse.move(600, 300, { steps: 6 }); await page.mouse.up();
  assert.equal(Math.round(await q(() => $canvasScene.scrollLeft) - s0), 200);
});

await step('in the canvas: T goes to today, A does not start add mode, the add button is hidden', async () => {
  await page.keyboard.press('t'); await page.waitForTimeout(800);
  assert.ok(Math.abs(await q(() => canvasLeftDay() - dayIdx(todayISO()))) < 0.01);
  await page.keyboard.press('a');
  assert.equal(await q(() => UI.addMode), false);
  assert.equal(await q(() => getComputedStyle(document.getElementById('fab')).visibility), 'hidden');
});

await step('a click on a phase in the rail opens its editor, as on the timeline', async () => {
  await page.mouse.move(700, 885); await page.waitForTimeout(500);
  await q(() => $railInner.querySelector('.phase').click());
  assert.equal(await q(() => UI.editor && UI.editor.type), 'phase');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  assert.equal(await view(), 'canvas', 'Escape closed the editor, not the canvas');
});

await step('out: a pull down from the floor, back to the week at the canvas day', async () => {
  await page.mouse.move(700, 400); await page.waitForTimeout(600);
  await q(() => { $canvasScene.scrollLeft += 7 * CANVAS_CELL + 13; });     // a little into a day: the week lands on whole days
  const day = await q(() => canvasLeftDay());
  await page.waitForTimeout(200);
  await wheel(80, 12);
  await settle();
  assert.equal(await view(), 'week');
  assert.equal(await q(() => weekLeftDay()), Math.round(day));
  assert.equal(await q(() => $scene.scrollTop), 0, 'at the timeline, where the canvas was above');
  assert.equal(await q(() => UI.canvas.shown), false);
});

await step('Escape leaves the canvas too; nothing is left moved or hidden', async () => {
  await enter();
  assert.equal(await view(), 'canvas');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100); await settle();
  assert.equal(await view(), 'week');
  assert.equal(await q(() => [$scene, $canvasView, $tlWrap, $railInner, $dayWrap].map(el => el.style.transform + el.style.opacity).join('')), '');
  assert.equal(await q(() => document.getAnimations().length), 0);
  assert.equal(await q(() => getComputedStyle($scene).visibility), 'visible');
});

await step('a plan change while in the canvas redraws the rail', async () => {
  await enter();
  const n = await q(() => $railInner.querySelectorAll('.phase').length);
  await q(() => mutate(s => s.phases.push({ id: 'canvas-test', title: 'Neu', categoryId: null, start: todayISO(), end: isoDate(addDays(parseISO(todayISO()), 5)) })));
  assert.equal(await q(() => $railInner.querySelectorAll('.phase').length), n + 1);
  await q(() => undo());
  assert.equal(await q(() => $railInner.querySelectorAll('.phase').length), n);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100); await settle();
});

await step('the pull waits while an editor is open', async () => {
  await q(() => { $scene.scrollTop = 0; openEditor({ type: 'event', initial: { date: todayISO(), startMin: 600, endMin: 660 } }); });
  await page.waitForTimeout(300);
  await q(() => $scene.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true })));
  await page.waitForTimeout(250);
  assert.equal(await q(() => UI.canvas.shown), false);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
});

await step('no page errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); server.close();
if (failed) { console.log(`\n${failed} canvas test(s) FAILED`); process.exit(1); }
console.log('\nCanvas tests passed.');
