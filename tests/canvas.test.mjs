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
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n').slice(0,6).join(' | ')); }
};

/* a desktop screen, with the motions running (they are what is tested) */
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(APP);
await page.waitForFunction(() => !document.getElementById('bootSnakePill'), null, { timeout: 8000 }).catch(() => {});
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

/* a slow, even pull: n events of d px, gap ms apart (a pause at the end is how a trackpad lets go) */
const slow = async (d, n, gap = 30) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(0, d); await page.waitForTimeout(gap); } };
const pinch = async (d, n, gap = 16) => { await page.keyboard.down('Control'); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, d); await page.waitForTimeout(gap); } await page.keyboard.up('Control'); };

await step('the pull follows the wheel 1:1, then nothing moves while the hand is still', async () => {
  await page.waitForTimeout(200);
  await slow(-10, 6);
  assert.equal(await q(() => morph.on), true);
  assert.ok(await q(() => Math.abs(morph.y - 60) < 1), '60 px of wheel, 60 px of movement: ' + await q(() => morph.y));
  assert.match(await q(() => $tlWrap.style.transform), /translateY\(60px\)/, 'the band moves with it');
  assert.match(await q(() => $dayWrap.style.transform), /translateY\(60px\)/, 'the day view moves with it, as one sheet');
  assert.equal(await q(() => getComputedStyle($rail).visibility), 'hidden', 'one timeline: the rail waits hidden');
  assert.ok(await q(() => +getComputedStyle($canvasView).zIndex < +getComputedStyle($scene).zIndex), 'the canvas under the week');
  await settle();
  assert.equal(await view(), 'week', 'a slow short pull falls back');
  assert.equal(await q(() => [$tlWrap, $dayWrap, $railInner, $canvasView].map(el => el.style.transform + el.style.opacity).join('')), '');
});

await step('slowly past halfway, let go: on to the canvas; landing ends it, nothing moves after', async () => {
  const day = await q(() => weekLeftDay());
  await page.waitForTimeout(200);
  const n = await q(() => Math.ceil(($views.clientHeight * 0.6) / 10));
  await slow(-10, n);
  assert.ok(await q(() => morph.y > morph.floor / 2 && morph.y < morph.floor), 'past halfway, not at the end');
  const t0 = Date.now(); await settle(); const ms = Date.now() - t0;
  assert.equal(await view(), 'canvas');
  assert.ok(ms < 900, 'let go to landed: ' + ms + ' ms');
  const tl = await q(() => [$tlWrap.style.transform, $canvasView.style.transform, $scene.style.getPropertyValue('--ppd')].join(''));
  assert.equal(tl, '', 'nothing left moved: landing is the end');
  assert.ok(Math.abs(await q(() => canvasLeftDay()) - day) < 0.01, 'same day at the left edge');
  assert.equal(await atFloor(), true, 'at the floor');
  assert.equal(await q(() => document.elementFromPoint(700, 400).closest('#canvasView') !== null), true, 'the canvas gets the pointer');
  assert.equal(await q(() => UI.canvas.railOpen), false, 'pointer not on the rail: it closed at once');
});

await step('a short quick pinch out of the canvas carries it home (flick)', async () => {
  await page.mouse.move(700, 400); await page.waitForTimeout(300);
  await pinch(-8, 3);                                     // quick: well past the halfway mark once carried, even when a slow test browser spaces the events
  assert.ok(await q(() => morph.y > morph.floor * 0.7), 'it moved only a little: ' + await q(() => morph.y / morph.floor));
  await settle();
  assert.equal(await view(), 'week');
});

await step('a slow pinch holds where it is, and caught mid-settle it stops under the hand', async () => {
  await page.mouse.move(700, 300); await page.waitForTimeout(300);
  await pinch(2, 6, 40);
  const y0 = await q(() => morph.y);
  await page.waitForTimeout(120);                         // still: nothing plays on its own
  assert.equal(await q(() => morph.y), y0);
  await page.waitForTimeout(250);                         // let go (quiet): settling back
  const r = await q(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
    const before = morph.y; morphHold(0); const at = morph.y;
    setTimeout(() => res({ moving: before > 0, at, before, after: morph.y }), 120);
  }))));
  assert.ok(r.moving, 'it was settling');
  assert.ok(Math.abs(r.at - r.before) < 0.01 && Math.abs(r.after - r.at) < 0.01, 'stopped where it was: ' + JSON.stringify(r));
  await q(() => morphRelease()); await settle();
  assert.equal(await view(), 'week');
});

await step('a scroll carried to the end lands at once; the rest of the gesture goes nowhere', async () => {
  await q(() => { $scene.scrollTop = 0; }); await page.waitForTimeout(250);
  await wheel(-60, 14);
  assert.equal(await view(), 'canvas', 'landed while the gesture still runs');
  await wheel(-60, 10);                                   // its momentum, still going
  assert.equal(await atFloor(), true, 'still at the floor');
  await page.waitForTimeout(250);
  await page.mouse.move(700, 400); await page.waitForTimeout(200);
  await wheel(80, 14); await settle();
  assert.equal(await view(), 'week');
});

await step('landing with the pointer on the rail: it stays open', async () => {
  await page.mouse.move(700, 885); await page.waitForTimeout(100);
  await q(() => { morphStart(0); morphRelease(1); });
  await settle(); await page.waitForTimeout(300);
  assert.equal(await view(), 'canvas');
  assert.equal(await q(() => UI.canvas.railOpen), true);
  await page.mouse.move(700, 300); await page.waitForTimeout(600);
  assert.equal(await q(() => UI.canvas.railOpen), false, 'leaving it closes it, as a hover does');
  await page.keyboard.press('Escape'); await settle();
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

await step('along the days, by scale: labels thin out by tier, never two texts over each other; the rail ends on KW', async () => {
  const r = await q(() => {
    morphStart(0);
    const out = [];
    for (let i = 0; i <= 40; i++) {
      morphTo(i / 40);
      const shown = [...document.querySelectorAll('#dayHead .dh[data-day] :is(.dw, .dn), #dayHeadCorner :is(.dw, .dn)')]
        .filter(el => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o > 0.02; })
        .map(el => el.getBoundingClientRect()).filter(b => b.width && b.right > 0 && b.left < innerWidth);
      for (let a = 0; a < shown.length; a++) for (let b = a + 1; b < shown.length; b++) {
        const A = shown[a], B = shown[b];
        if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) out.push(i / 40);
      }
    }
    const held = [0.81, 0.81].map(p => { morphTo(p); return getComputedStyle($scene).getPropertyValue('--t-alt'); });
    morphRelease(0);
    const t = tiersFor(CANVAS_CELL);
    return { overlaps: [...new Set(out)], held, rail: [t.day, t.alt, t.mon, t.kw] };
  });
  await settle();
  assert.deepEqual(r.overlaps, [], 'texts overlap at p = ' + r.overlaps.join(', '));
  assert.equal(r.held[0], r.held[1], 'held at a scale, it stays');
  assert.deepEqual(r.rail, [0, 0, 0, 1], 'the rail: only the weeks, their KW and lines');
  assert.deepEqual(await q(() => { const t = tiersFor(TL_PPD); return [t.day, t.alt, t.mon, t.kw]; }), [1, 1, 1, 0], 'the week view: every day, as before');
});

await step('the rail\'s day row is whole even when its rows don\'t fit; the switch lands on it exactly', async () => {
  await page.mouse.move(700, 885); await page.waitForTimeout(100);       // resting on the rail: it stays open
  await q(() => mutate(st => { for (let k = 0; k < 8; k++) st.phases.push({ id: 'cap' + k, title: 'Cap ' + k, categoryId: null, start: todayISO(), end: isoDate(addDays(parseISO(todayISO()), 3 + k)) }); }));
  const r = await q(() => { morphStart(0); morphTo(1); const head = document.getElementById('dayHead').getBoundingClientRect().top; morphSettle(1, 0); return head; });
  await settle(); await page.waitForTimeout(300);
  const row = await q(() => { const b = $railDays.querySelector('.day-row').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, clip: UI.canvas.railClip }; });
  assert.ok(row.clip > 0, 'the rows are cut by the cap');
  assert.ok(row.bottom <= await q(() => innerHeight) + 0.5, 'the row ends inside the window');
  assert.equal(Math.round(row.top), Math.round(r), 'the day header lands on it');
  await page.keyboard.press('Escape'); await settle();
  for (let k = 0; k < 8; k++) await q(() => undo());
});

await step('the canvas dots follow the switch\'s scale: a dot a day at the canvas, 12 h dots as the days widen, from the band\'s day 0', async () => {
  const r = await q(() => {
    morphStart(0);
    const at = p => { morphTo(p); const t = tiersFor(parseFloat($canvasGrid.style.getPropertyValue('--ppd')), MIN_DOT_PX);
      return { ppd: $canvasGrid.style.getPropertyValue('--ppd'), half: +t.half.toFixed(2), day: t.day, gx: parseFloat($canvasDots.style.getPropertyValue('--gx')) }; };
    const out = { mid: at(0.5), end: at(1) };
    out.dayAt = ((railW() - $scene.scrollLeft) % parseFloat(out.end.ppd) + 40) % 40;
    morphRelease(0);
    return out;
  });
  await settle();
  assert.equal(r.end.ppd, '40px', 'at the canvas: its own scale');
  assert.deepEqual([r.end.day, r.end.half], [1, 0], 'at the canvas: one dot a day, nothing between');
  assert.equal(r.mid.half, 1, 'halfway (105 px a day): the 12 h dots are in');
  assert.ok(Math.abs(r.end.gx - r.dayAt) < 0.01, 'anchored on the band\'s day 0');
  assert.equal(await q(() => $canvasGrid.style.getPropertyValue('--ppd') + $canvasGrid.style.getPropertyValue('--ox') + $canvasDots.style.getPropertyValue('--gx')), '', 'nothing left behind');
});

await step('scrolling again while it settles catches it', async () => {
  await enter();
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

await step('in the canvas: T goes to today, A does not start add mode, the add button stays (it draws here)', async () => {
  await page.keyboard.press('t'); await page.waitForTimeout(800);
  assert.ok(Math.abs(await q(() => canvasLeftDay() - dayIdx(todayISO()))) < 0.01);
  await page.keyboard.press('a');
  assert.equal(await q(() => UI.addMode), false);
  assert.equal(await q(() => getComputedStyle(document.getElementById('fab')).visibility), 'visible');
  assert.equal(await q(() => getComputedStyle(document.getElementById('addMenu')).visibility), 'hidden', 'the add menu stays the week\'s');
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

await step('one packing for every kind: projects apart share a row, overlapping ones stack; chips too; the same lanes in band and rail', async () => {
  const r = await q(() => {
    const d = n => isoDate(addDays(parseISO(todayISO()), n));
    mutate(st => {
      st.categories.push({ id: 'pA', name: 'Alt', color: '#6498c0', start: d(-60), end: d(-40) },
                         { id: 'pB', name: 'Neu', color: '#c08a64', start: d(-30), end: d(-10) },
                         { id: 'pC', name: 'Quer', color: '#8ac064', start: d(-35), end: d(-20) });
      st.phases.push({ id: 'phA', title: 'A1', categoryId: 'pA', start: d(-58), end: d(-50) },
                     { id: 'phB', title: 'B1', categoryId: 'pB', start: d(-28), end: d(-20) });
      st.milestones.push({ id: 'm1', title: 'Eins', date: d(-80) }, { id: 'm2', title: 'Zwei', date: d(-79) }, { id: 'm3', title: 'Drei', date: d(-70) });
    });
    drawCanvas();
    const rowOf = (root, sel) => [...root.children].indexOf(root.querySelector(sel).closest('.tlRow'));
    const rows = root => ({ A: rowOf(root, '[data-edit-project="pA"]'), B: rowOf(root, '[data-edit-project="pB"]'), C: rowOf(root, '[data-edit-project="pC"]'),
      m1: rowOf(root, '[data-edit-milestone="m1"]'), m2: rowOf(root, '[data-edit-milestone="m2"]'), m3: rowOf(root, '[data-edit-milestone="m3"]'),
      phB: rowOf(root, '[data-phase="phB"]') });
    const out = { band: rows($tlInner.firstElementChild), rail: rows($railInner.firstElementChild) };
    for (let k = 0; k < 3; k++) undo();
    return out;
  });
  const b = r.band;
  assert.equal(b.A, b.C, 'apart in time (A ends before C starts): one row');
  assert.notEqual(b.C, b.B, 'overlapping (B, C): stacked');
  assert.ok(b.phB > b.B, 'a project\'s phases stay under its line');
  assert.notEqual(b.m1, b.m2, 'chips a day apart: stacked');
  assert.equal(b.m1, b.m3, 'chips far apart: one row');
  assert.deepEqual(r.rail, b, 'the same lanes at the rail\'s scale');
});

await step('no page errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); server.close();
if (failed) { console.log(`\n${failed} canvas test(s) FAILED`); process.exit(1); }
console.log('\nCanvas tests passed.');
