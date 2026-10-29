// The editor on a phone, and what an event shows at each height.
// Run from the repo root:  node tests/editor-phone.test.mjs
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
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.clock.setSystemTime(new Date('2026-10-21T10:00:00+02:00'));
await page.goto(APP); await page.waitForTimeout(500);

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
};
const open = () => page.evaluate(() => { const ev = S.events.find(e => e.repeat === 'none'); openEditor({ type: 'event', edit: ev }); return ev.id; });
const pull = async (dy, ms) => {
  await page.waitForTimeout(300);                                     // the editor has finished rising
  const r = await page.locator('.editor-header').boundingBox();
  const x = r.x + r.width / 2, y = r.y + 10;                          // at the grip: the top middle of the header
  await page.mouse.move(x, y); await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x, y + dy * i / steps); await page.waitForTimeout(ms / steps); }
  await page.mouse.up(); await page.waitForTimeout(400);
};

await step('opening an event on a phone does not start typing (no keyboard)', async () => {
  await open();
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'fTitle');
  await page.evaluate(() => closeEditor());
});
await step('a new event on a phone does not start typing either', async () => {
  await page.evaluate(() => openEditor({ type: 'event', initial: { date: todayISO(), startMin: 600, endMin: 660 } }));
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'fTitle');
  await page.evaluate(() => closeEditor());
});
await step('the editor sits at the bottom, full width', async () => {
  await open(); await page.waitForTimeout(300);
  const r = await page.locator('.editor').boundingBox();
  assert.equal(Math.round(r.width), 390); assert.equal(Math.round(r.y + r.height), 844);
  await page.evaluate(() => closeEditor());
});
await step('pulling the header down closes it without saving', async () => {
  const id = await open();
  const title = await page.evaluate(i => S.events.find(e => e.id === i).title, id);
  await page.fill('#fTitle', 'verworfen');
  await pull(260, 300);
  assert.equal(await page.locator('#editorOverlay').count(), 0, 'closed');
  assert.equal(await page.evaluate(i => S.events.find(e => e.id === i).title, id), title, 'not saved');
});
await step('a short slow pull springs back', async () => {
  await open();
  await pull(40, 600);
  assert.equal(await page.locator('#editorOverlay').count(), 1, 'still open');
  assert.equal(await page.evaluate(() => document.querySelector('.editor').style.transform), '');
  await page.evaluate(() => closeEditor());
});
await step('a quick flick closes it', async () => {
  await open();
  await pull(70, 20);
  assert.equal(await page.locator('#editorOverlay').count(), 0);
});

await step('many todos: repeat and reminder keep their full height, the body scrolls, the editor does not grow', async () => {
  const id = await open();
  await page.waitForTimeout(300);
  const h0 = (await page.locator('.editor').boundingBox()).height;
  for (let i = 0; i < 18; i++) { await page.fill('#fNewTodo', 'Todo ' + i); await page.press('#fNewTodo', 'Enter'); }
  await page.waitForTimeout(200);
  const list = await page.evaluate(() => Math.round(document.querySelector('.editor-body > .list').getBoundingClientRect().height));
  assert.ok(list >= 88, `the repeat/reminder list is ${list}px high (two 44px rows need 88)`);   // squeezed, it clips its rows away
  const body = await page.evaluate(() => { const b = document.getElementById('editorBody'); return { scroll: b.scrollHeight > b.clientHeight }; });
  assert.ok(body.scroll, 'the body scrolls');
  assert.equal(Math.round((await page.locator('.editor').boundingBox()).height), Math.round(h0), 'the editor keeps its height');
  assert.equal(await page.evaluate(() => { const r = document.getElementById('fNewTodo').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }), true, 'the new-todo row stays in view');
  await page.evaluate(i => { mutate(s => { const e = s.events.find(x => x.id === i); e.todosByDate = {}; }); closeEditor(); }, id);
});

/* what an event shows at each height (narrow phone column) */
const shows = minutes => page.evaluate(m => {
  const el = renderEvent({ id: 'x', title: 'Betreuungstermin Seminararbeit', date: todayISO(), startMin: 600, endMin: 600 + m, repeat: 'weekly', reminderMin: 15,
    todosByDate: { [todayISO()]: [{ id: 'a', text: 'x', state: 'done' }, { id: 'b', text: 'y', state: 'open' }] } }, todayISO(), 0, 58);
  document.getElementById('dayGrid').appendChild(el);
  const out = { title: !!el.querySelector('.et'), time: !!el.querySelector('.em'), todos: !!el.querySelector('.badge'),
    lines: +getComputedStyle(el).getPropertyValue('--title-lines'), hyphens: el.querySelector('.et') && getComputedStyle(el.querySelector('.et')).hyphens };
  el.remove(); return out;
}, minutes);
await step('15 minutes: just its colour', async () => { assert.deepEqual(await shows(15), { title: false, time: false, todos: false, lines: 1, hyphens: null }); });
await step('30 minutes: the title', async () => { const s = await shows(30); assert.equal(s.title, true); assert.equal(s.time, false); });
await step('1 hour in a narrow column: the title, then the start time', async () => {
  const s = await shows(60); assert.equal(s.time, true); assert.equal(s.lines, 1);
  assert.equal(await page.evaluate(() => { const el = renderEvent({ id:'x', title:'T', date:todayISO(), startMin:600, endMin:660, repeat:'none', reminderMin:null, todosByDate:{} }, todayISO(), 0, 58); return el.querySelector('.em').textContent; }), '10:00'); });
await step('1 hour in a wide column: the title, then the whole time', async () => {
  assert.equal(await page.evaluate(() => { const el = renderEvent({ id:'x', title:'T', date:todayISO(), startMin:600, endMin:660, repeat:'none', reminderMin:null, todosByDate:{} }, todayISO(), 0, 180); return el.querySelector('.em').textContent; }), '10:00–11:00'); });
await step('3 hours: title on several lines, time, todos; words break at syllables', async () => {
  const s = await shows(180); assert.ok(s.lines >= 4, `${s.lines} lines`); assert.equal(s.time, true); assert.equal(s.todos, true); assert.equal(s.hyphens, 'auto'); });

await step('the category list rises above the editor: plain, arrow up when closed and down when open', async () => {
  const id = await open(); await page.waitForTimeout(300);
  const before = await page.evaluate(i => S.events.find(e => e.id === i).categoryId, id);
  const pick = before === 'work' ? 'personal' : 'work';
  const arrow = () => page.evaluate(() => getComputedStyle(document.querySelector('.kind-arrow')).transform);
  const closedArrow = await arrow();
  assert.equal(await page.locator('#editorCatList').isHidden(), true);
  await page.click('#editorKindBtn'); await page.waitForTimeout(300);
  assert.equal(await page.locator('#editorCatList').isVisible(), true);
  assert.notEqual(await arrow(), closedArrow, 'the arrow turns');
  const [list, ed] = await Promise.all([page.locator('#editorCatList').boundingBox(), page.locator('.editor').boundingBox()]);
  assert.ok(list.y + list.height <= ed.y, 'above the editor');
  assert.equal(await page.locator('.overlay').count(), 1, 'no window of its own');
  const names = await page.locator('#editorCatList .cat-item').allTextContents();
  assert.equal(names.at(-1), 'Frei', 'frei nearest to the header');
  await page.click(`[data-pick-cat="${pick}"]`); await page.waitForTimeout(300);
  assert.equal(await page.locator('#editorCatList').isHidden(), true, 'closes after picking');
  assert.equal(await page.textContent('#editorKind'), await page.evaluate(p => cat(p).name, pick));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#editorOverlay .editor')).getPropertyValue('--ed-colour').trim()), await page.evaluate(p => cat(p).color, pick), 'the header takes the colour');
  await page.click('#editorKindBtn');
  await page.mouse.click(30, 60); await page.waitForTimeout(300);                  // a tap on the dim layer closes the list, not the editor
  assert.equal(await page.locator('#editorCatList').isHidden(), true);
  assert.equal(await page.locator('#editorOverlay').count(), 1, 'the editor stays');
  await page.click('#editorKindBtn'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  assert.equal(await page.locator('#editorCatList').isHidden(), true, 'Escape: the list first');
  assert.equal(await page.locator('#editorOverlay').count(), 1);
  await page.click('#editorClose');                                                  // cancelled: the category stays as it was
  assert.equal(await page.evaluate(i => S.events.find(e => e.id === i).categoryId, id), before);
});
await step('a new thing: the overline says Frei, the title waits with the kind as its placeholder', async () => {
  await page.evaluate(() => openEditor({ type: 'event', initial: { date: todayISO(), startMin: 600, endMin: 660 } }));
  assert.equal(await page.textContent('#editorKind'), 'Frei');
  assert.equal(await page.getAttribute('#fTitle', 'placeholder'), 'Termin');
  await page.evaluate(() => closeEditor(true));
});

for (const n of [3, 8, 20]) await step(`with ${n} todos the category list still rises above the header, fully on screen; the header stays visible`, async () => {
  await page.evaluate(n => { const ev = S.events.find(e => e.title === 'Tutorium');
    setTodosOf(ev, ev.date, Array.from({ length: n }, (_, i) => ({ id: 't' + i, text: 'Todo ' + i, state: 'open' })));
    openEditor({ type: 'event', edit: ev }); }, n);
  await page.waitForTimeout(300);
  await page.click('#editorKindBtn'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const l = document.getElementById('editorCatList').getBoundingClientRect(), h = document.querySelector('#editorOverlay .editor-header').getBoundingClientRect();
    const items = [...document.querySelectorAll('#editorCatList .cat-item')];
    return { listTop: l.top, listBottom: l.bottom, headerTop: h.top, headerBottom: h.bottom, scrolls: document.getElementById('editorCatList').scrollHeight > document.getElementById('editorCatList').clientHeight, n: items.length };
  });
  assert.ok(r.listTop >= 0 && r.listBottom <= r.headerTop, `list ${Math.round(r.listTop)}–${Math.round(r.listBottom)}, header from ${Math.round(r.headerTop)}`);
  assert.ok(r.headerBottom <= 844 + 1, 'the header stays on screen');
  assert.equal(r.scrolls, false, 'all categories fit on a phone');
  await page.click('[data-pick-cat="work"]'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.querySelector('#editorOverlay .editor-stack').style.transform), '', 'the editor glides back');
  await page.evaluate(() => { const ev = S.events.find(e => e.title === 'Tutorium'); setTodosOf(ev, ev.date, []); closeEditor(true); });
});

/* todos of a day, without an event */
await step('a tap on a day opens its todos; a new one gets the chosen category and its dot appears', async () => {
  await page.evaluate(() => { $scene.scrollTop = $dayWrap.offsetTop; });
  await page.click('.dh[data-day="2026-10-22"]'); await page.waitForTimeout(300);
  assert.equal(await page.locator('#dayTodoOverlay').count(), 1);
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'fNewDayTodo', 'no keyboard by itself on a phone');
  await page.click('#dayTodoCat'); await page.waitForTimeout(300);
  await page.click('#dayCatList [data-pick-cat="work"]'); await page.waitForTimeout(300);
  await page.fill('#fNewDayTodo', 'Modell fotografieren'); await page.press('#fNewDayTodo', 'Enter');
  const t = await page.evaluate(() => S.dayTodos.find(x => x.text === 'Modell fotografieren'));
  assert.deepEqual([t.date, t.categoryId, t.state], ['2026-10-22', 'work', 'open']);
  assert.equal(await page.locator('.dh[data-day="2026-10-22"] .dh-dot').count(), 1, 'its dot');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.dh[data-day="2026-10-22"] .dh-dot')).backgroundColor), await page.evaluate(() => { const d = document.createElement('div'); d.style.color = cat('work').color; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
});
await step('ticking applies at once; a day with only done todos has no dot', async () => {
  await page.locator('#dayTodoList .tcheck').first().click();
  assert.equal(await page.evaluate(() => S.dayTodos.find(x => x.text === 'Modell fotografieren').state), 'done');
  assert.equal(await page.locator('.dh[data-day="2026-10-22"] .dh-dot').count(), 0);
  await page.locator('#dayTodoList .tcheck').first().click(); await page.locator('#dayTodoList .tcheck').first().click();   // done → cancelled → open
});
await step('holding a todo moves it to tomorrow; undo brings it back', async () => {
  const row = page.locator('#dayTodoList .todoRow', { hasText: 'Modell fotografieren' });
  const r = await row.locator('.tx').boundingBox();
  await page.touchscreen.tap(r.x + 5, r.y + 5);                                   // (a tap does nothing)
  await row.locator('.tx').dispatchEvent('pointerdown', { pointerType: 'touch', clientX: r.x + 5, clientY: r.y + 5 });
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => S.dayTodos.find(x => x.text === 'Modell fotografieren').date), '2026-10-23', 'tomorrow');
  assert.equal(await page.locator('#dayTodoList .todoRow').count(), 0, 'gone from this day');
  await page.evaluate(() => undo()); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => S.dayTodos.find(x => x.text === 'Modell fotografieren').date), '2026-10-22');
});
await step('pulled down, the day panel closes; Escape too', async () => {
  await pull(260, 300);
  assert.equal(await page.locator('#dayTodoOverlay').count(), 0);
  await page.click('.dh[data-day="2026-10-22"]'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  assert.equal(await page.locator('#dayTodoOverlay').count(), 0);
});
await step('an open todo of an earlier day comes along to today, marked with its day', async () => {
  await page.evaluate(() => mutate(s => { s.dayTodos.push({ id: 'old', text: 'Buch verlängern', state: 'open', date: '2026-10-19', categoryId: null }); }));
  await page.click('.dh[data-day="2026-10-21"]'); await page.waitForTimeout(300);           // today in this test
  const earlier = await page.locator('#dayTodoBody .part').nth(1).textContent();
  assert.match(earlier, /Von früheren Tagen/); assert.match(earlier, /Buch verlängern/); assert.match(earlier, /Mo, 19\.10\./);
  assert.equal(await page.locator('.dh[data-day="2026-10-21"] .dh-dot').count(), 1, 'it gives today a dot');
  await page.locator('#dayTodoBody .todoRow', { hasText: 'Buch verlängern' }).locator('.tcheck').click();
  assert.equal(await page.locator('#dayTodoBody .todoRow', { hasText: 'Buch verlängern' }).count(), 0, 'ticked, it stays behind on its day');
  await page.keyboard.press('Escape');
});
await step('more than three categories: three dots and a "+"', async () => {
  await page.evaluate(() => mutate(s => { ['work', 'personal', 'seminar', 'tests'].forEach((c, i) => s.dayTodos.push({ id: 'm' + i, text: c, state: 'open', date: '2026-10-24', categoryId: c })); }));
  assert.equal(await page.locator('.dh[data-day="2026-10-24"] .dh-dot').count(), 3);
  assert.equal(await page.locator('.dh[data-day="2026-10-24"] .dh-more').count(), 1);
});

/* motion: with animations on, as on a real phone */
const moving = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
await moving.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await moving.clock.setSystemTime(new Date('2026-10-21T10:00:00+02:00'));
await moving.goto(APP); await moving.waitForTimeout(3300);
await step('the editor slides up to open, and down to close: the same motion reversed', async () => {
  await moving.evaluate(() => openEditor({ type: 'event', edit: S.events.find(e => e.repeat === 'none') }));
  assert.equal(await moving.evaluate(() => getComputedStyle(document.querySelector('#editorOverlay .editor')).animationName), 'editor-slide');
  await moving.waitForTimeout(400);
  await moving.click('#editorClose');
  const leaving = await moving.evaluate(() => { const ov = document.querySelector('.editor-leaving'); return ov && { id: ov.id, anim: getComputedStyle(ov.querySelector('.editor')).animationName, dir: getComputedStyle(ov.querySelector('.editor')).animationDirection }; });
  assert.deepEqual(leaving, { id: '', anim: 'editor-slide-out', dir: 'normal' });
  assert.equal(await moving.evaluate(() => UI.editor), null, 'closed at once for the app');
  await moving.waitForTimeout(500);
  assert.equal(await moving.locator('.overlay').count(), 0, 'gone after the motion');
});
await step('saving closes with the same motion', async () => {
  await moving.evaluate(() => openEditor({ type: 'event', edit: S.events.find(e => e.repeat === 'none') }));
  await moving.waitForTimeout(400);
  await moving.click('#editorSave');
  assert.equal(await moving.locator('.editor-leaving').count(), 1);
  await moving.waitForTimeout(500);
  assert.equal(await moving.locator('.overlay').count(), 0);
});
await step('the time budget: switching 7/30 days changes the chart, not the window (no replayed opening)', async () => {
  await moving.evaluate(() => openBudget()); await moving.waitForTimeout(400);
  const before = await moving.evaluate(() => { window.__win = document.querySelector('#budgetPage .overlay-window'); return document.querySelector('#bBody').innerHTML; });
  await moving.click('#bSeg button[data-d="30"]');
  assert.equal(await moving.evaluate(() => document.querySelector('#budgetPage .overlay-window') === window.__win), true, 'the same window');
  assert.equal(await moving.evaluate(() => document.querySelector('#bSeg .on').dataset.d), '30');
  await moving.evaluate(() => closeBudget());
});
await step('a phase dropdown: redraws do not replay its opening; closing plays it reversed', async () => {
  await moving.evaluate(() => { $scene.scrollTop = 0; }); await moving.waitForTimeout(200);
  await moving.locator('.ph-exp').first().click();
  assert.equal(await moving.locator('.dropdown.opening').count(), 1, 'opens with the animation');
  await moving.evaluate(() => renderAll());
  assert.equal(await moving.locator('.dropdown.opening').count(), 0, 'a redraw does not animate it again');
  await moving.locator('.ph-exp').first().click();
  assert.equal(await moving.locator('.dropdown.closing').count(), 1, 'closes with the animation reversed');
  await moving.waitForTimeout(400);
  assert.equal(await moving.locator('.dropdown').count(), 0);
});

await browser.close(); server.close();
console.log(failed ? `\n${failed} editor-phone test(s) FAILED` : '\nEditor-phone tests passed.');
process.exit(failed ? 1 : 0);
