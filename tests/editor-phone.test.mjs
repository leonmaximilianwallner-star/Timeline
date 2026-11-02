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

/* Soll/Ist (1 Nov): a tap on an actual opens the actual, not the plan behind it */
await step('a tap on an actual opens its own editor, not the plan\'s; saving changes the actual only', async () => {
  await page.evaluate(() => { const ev = S.events.find(e => e.repeat === 'none'); window.__plan = JSON.stringify(ev);
    mutate(s => s.actuals.push({ id: 'ist1', date: todayISO(), startMin: ev.startMin + 15, endMin: ev.endMin + 40, eventId: ev.id, occurrence: todayISO(), categoryId: ev.categoryId })); });
  await page.locator('.event.actual').tap(); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => UI.editor && UI.editor.type), 'actual');
  assert.equal(await page.evaluate(() => document.getElementById('fTitle').readOnly), true, 'it carries its plan\'s name, not one of its own');
  await page.evaluate(() => { document.getElementById('fStart').value = '13:20'; });
  await page.click('#editorSave'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => S.actuals.find(a => a.id === 'ist1').startMin), 13 * 60 + 20);
  assert.equal(await page.evaluate(() => JSON.stringify(S.events.find(e => e.id === JSON.parse(window.__plan).id))), await page.evaluate(() => window.__plan), 'the plan is untouched');
});
await step('a running actual stays running when its editor saves; its delete removes only it', async () => {
  await page.evaluate(() => { mutate(s => { s.actuals.find(a => a.id === 'ist1').endMin = null; }); openEditor({ type: 'actual', edit: S.actuals.find(a => a.id === 'ist1') }); });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.getElementById('fEnd').disabled), true);
  await page.click('#editorSave'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => S.actuals.find(a => a.id === 'ist1').endMin), null);
  const events = await page.evaluate(() => S.events.length);
  await page.evaluate(() => openEditor({ type: 'actual', edit: S.actuals.find(a => a.id === 'ist1') })); await page.waitForTimeout(300);
  await page.click('#editorDelete'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => S.actuals.length), 0);
  assert.equal(await page.evaluate(() => S.events.length), events);
});
await step('the time row never makes the editor slide sideways, even with a phone\'s wide time fields', async () => {
  await page.addStyleTag({ content: '.when input{width:170px}' });     // as an Android field with a 12-hour time brings its own width
  await open(); await page.waitForTimeout(300);
  const w = await page.evaluate(() => { const B = document.getElementById('editorBody'); return [B.scrollWidth, B.clientWidth]; });
  assert.equal(w[0], w[1], `content ${w[0]}px in ${w[1]}px`);
  await page.evaluate(() => closeEditor(true));
});

/* the focus view (1 Nov): reached from the event editor, the event open, todos tick, the back gesture closes it */
await step('the editor\'s expand button opens the focus view of that day, with that event open', async () => {
  const id = await page.evaluate(() => { const ev = S.events.find(e => e.repeat === 'none'); openEditor({ type: 'event', edit: ev, occurrence: ev.date }); return ev.id; });
  await page.waitForTimeout(300);
  await page.click('#editorFocus'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => !!UI.focus && !UI.editor), true);
  assert.equal(await page.locator('.focus-event.open').getAttribute('data-ev'), id);
  assert.equal(await page.locator('.focus-pill').count(), 7);
});
await step('a todo ticks in the focus view and is stored for that day', async () => {
  await page.fill('#focusNewTodo', 'im Fokus'); await page.press('#focusNewTodo', 'Enter');
  await page.locator('.focus-event.open .todoRow', { hasText: 'im Fokus' }).locator('.tcheck').tap();
  assert.equal(await page.evaluate(() => { const f = UI.focus, ev = S.events.find(e => e.id === f.open); return todosOf(ev, f.day).find(t => t.text === 'im Fokus').state; }), 'done');
});
await step('a tap on another event opens it; its header opens the editor over the focus view', async () => {
  await page.evaluate(() => mutate(s => s.events.push({ id: 'fx', title: 'Zweiter', categoryId: null, date: UI.focus.day, startMin: 20 * 60, endMin: 21 * 60, repeat: 'none', reminderMin: null, todosByDate: {} })));
  await page.locator('[data-open="fx"]').tap();
  assert.equal(await page.evaluate(() => UI.focus.open), 'fx');
  await page.locator('.fe-head').tap(); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => UI.editor && UI.editor.edit.id), 'fx');
  await page.evaluate(() => closeEditor(true));
  assert.equal(await page.evaluate(() => !!UI.focus), true, 'still in the focus view');
});
await step('the day\'s own todos stand before the first event: added, ticked and moved to tomorrow in Fokus', async () => {
  await page.fill('#focusNewDayTodo', 'ohne Termin'); await page.press('#focusNewDayTodo', 'Enter');
  const id = await page.evaluate(() => S.dayTodos.find(t => t.text === 'ohne Termin').id);
  assert.equal(await page.evaluate(() => S.dayTodos.find(t => t.text === 'ohne Termin').date), await page.evaluate(() => UI.focus.day));
  const first = await page.evaluate(() => { const l = document.querySelector('.focus-todos'), e = document.querySelector('.focus-list .focus-event'); return l.getBoundingClientRect().bottom <= e.getBoundingClientRect().top; });
  assert.equal(first, true, 'above the first event');
  await page.locator(`.focus-todos .todoRow[data-tid="${id}"] .tcheck`).tap();
  assert.equal(await page.evaluate(i => S.dayTodos.find(t => t.id === i).state, id), 'done');
  await page.locator(`.focus-todos .todoRow[data-tid="${id}"] .tx`).click({ button: 'right' });
  assert.equal(await page.evaluate(i => S.dayTodos.find(t => t.id === i).date, id), await page.evaluate(() => dayAfter(UI.focus.day > todayISO() ? UI.focus.day : todayISO())));
});
await step('free time between events: three dots, its length, a note typed in place, stored with the next event', async () => {
  await page.evaluate(() => mutate(s => { const d = UI.focus.day; s.events.push({ id: 'g1', title: 'Früh', categoryId: null, date: d, startMin: 6 * 60, endMin: 7 * 60, repeat: 'none', reminderMin: null, todosByDate: {} },
    { id: 'g2', title: 'Treffen', categoryId: null, date: d, startMin: 7 * 60 + 30, endMin: 8 * 60, repeat: 'none', reminderMin: null, todosByDate: {} }); }));
  const note = page.locator('.gap-note[data-gap-for="g2"]');
  assert.equal(await page.locator('.focus-gap .gap-dots svg circle').count() >= 3, true);
  await note.fill('Anfahrt'); await note.press('Enter');
  assert.equal(await page.evaluate(() => gapNoteOf(S.events.find(e => e.id === 'g2'), UI.focus.day)), 'Anfahrt');
  assert.equal(await page.locator('.focus-gap button, .focus-gap[data-gap]').count(), 0, 'no "create an event" here (Max, 1 Nov)');
});
await step('typing in Fokus survives the keyboard: a resize neither rebuilds it nor puts the cursor back after it closed', async () => {
  const input = page.locator('#focusNewTodo');
  await input.tap(); await page.keyboard.type('Tast');
  await page.evaluate(() => { window.__kept = document.getElementById('focusNewTodo'); });
  await page.setViewportSize({ width: 390, height: 520 }); await page.waitForTimeout(300);     // the keyboard opens: the window shrinks
  assert.equal(await page.evaluate(() => document.getElementById('focusNewTodo') === window.__kept), true, 'not rebuilt');
  assert.equal(await input.inputValue(), 'Tast');
  await page.evaluate(() => document.activeElement.blur());                                  // back: the keyboard closes …
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);     // … and the window grows again
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'focusNewTodo', 'the keyboard does not come back');
  await input.fill('');
});
await step('ticked off, a todo moves into the event\'s colour; all done, the event is all colour', async () => {
  const day = await page.evaluate(() => UI.focus.day);
  await page.evaluate(d => mutate(s => { const ev = s.events.find(e => e.id === UI.focus.open);
    setTodosOf(ev, d, [{ id: 't1', text: 'eins', state: 'open' }, { id: 't2', text: 'zwei', state: 'open' }]); }), day);
  await page.locator('.focus-event.open .todoRow[data-tid="t1"] .tcheck').tap();
  assert.equal(await page.locator('.focus-event.open .fe-done .todoRow[data-tid="t1"]').count(), 1, 'in the colour');
  assert.equal(await page.locator('.focus-event.open .fe-body .todoRow[data-tid="t2"]').count(), 1, 'still to do: in the raised body');
  await page.locator('.focus-event.open .todoRow[data-tid="t2"] .tcheck').tap();
  assert.equal(await page.evaluate(() => document.querySelector('.focus-event.open .fe-body').offsetHeight), 0, 'no raised body left');
});
await step('the time column: the start at the event\'s top, its end at its bottom, dots between', async () => {
  const r = await page.evaluate(() => { const row = document.querySelector('.focus-event.open').closest('.focus-row'), ev = row.querySelector('.focus-event').getBoundingClientRect();
    const s = row.querySelector('.ft-start').getBoundingClientRect(), e = row.querySelector('.ft-end').getBoundingClientRect(), d = row.querySelector('.ft-dots').getBoundingClientRect();
    return { top: s.top - ev.top, bottom: ev.bottom - e.bottom, dots: d.height }; });
  assert.ok(r.top < 16 && r.bottom < 16, JSON.stringify(r));
  assert.ok(r.dots > 20, 'dots between');
});
await step('the phone\'s back gesture closes the focus view, not the app', async () => {
  await page.goBack(); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => UI.focus === null && !document.querySelector('.focus-view')), true);
  assert.ok(page.url().startsWith(APP));
});

/* from the editor to Fokus by pulling up (1 Nov): a rubber band, armed past a line, committed on release; a container transform */
const pullUp = async (pg, dy) => {
  const r = await pg.locator('.editor-grip').boundingBox();
  const x = r.x + r.width / 2, y = r.y + 6;
  await pg.mouse.move(x, y); await pg.mouse.down();
  const h0 = await pg.evaluate(() => document.querySelector('#editorOverlay .editor').offsetHeight);
  for (let i = 1; i <= 10; i++) { await pg.mouse.move(x, y - dy * i / 10); await pg.waitForTimeout(20); }
  const armed = await pg.evaluate(() => document.querySelector('#editorOverlay .editor').classList.contains('armed'));
  const lift = await pg.evaluate(h => document.querySelector('#editorOverlay .editor').offsetHeight - h, h0);   // up: it grows from the bottom edge
  const bottom = await pg.evaluate(() => Math.round(document.querySelector('#editorOverlay .editor').getBoundingClientRect().bottom));
  await pg.mouse.up();
  return { armed, lift, bottom };
};
const openFirst = pg => pg.evaluate(() => { const ev = S.events.find(e => e.repeat === 'none'); openEditor({ type: 'event', edit: ev, occurrence: ev.date }); return ev.id; });
await step('a short pull up: the editor holds back (grows a little from the bottom edge, nothing shows under it), springs back', async () => {
  await moving.evaluate(() => { closeFocus?.(true); });
  await openFirst(moving); await moving.waitForTimeout(400);
  const { armed, lift, bottom } = await pullUp(moving, 60);
  assert.equal(armed, false);
  assert.ok(lift > 3 && lift < 15, `grew ${lift}px for 60px of finger: it holds back before the line`);
  assert.equal(bottom, 844, 'still on the screen\'s bottom edge');
  await moving.waitForTimeout(400);
  assert.equal(await moving.evaluate(() => !!UI.editor && !UI.focus), true);
  await moving.evaluate(() => closeEditor(true));
});
await step('a pull past the line arms it; on release the editor turns into Fokus, what was typed is kept', async () => {
  const id = await openFirst(moving); await moving.waitForTimeout(400);
  await moving.evaluate(() => { document.getElementById('fTitle').value = 'Hochgezogen'; });
  const { armed, lift } = await pullUp(moving, 150);
  assert.equal(armed, true);
  assert.ok(lift > 50, `past the line it springs forward and follows: ${lift}px for 150px of finger`);
  assert.equal(await moving.locator('.morph-plate').count(), 2, 'the container transform runs');
  await moving.waitForTimeout(700);
  assert.equal(await moving.evaluate(() => !!UI.focus && !UI.editor && !document.querySelector('.editor-overlay, .morph-plate')), true);
  assert.equal(await moving.locator('.focus-event.open').getAttribute('data-ev'), id);
  assert.equal(await moving.evaluate(i => S.events.find(e => e.id === i).title, id), 'Hochgezogen');
  assert.equal(await moving.evaluate(() => [...document.querySelectorAll('.focus-view *')].some(el => el.getAnimations().length)), false, 'nothing left mid-motion');
});
await step('closing Fokus: a container transform back into the week, landing on that day at the event\'s hour', async () => {
  const { day, id } = await moving.evaluate(() => ({ day: UI.focus.day, id: UI.focus.open }));
  await moving.click('#focusClose');
  assert.ok(await moving.locator('.morph-plate').count() >= 1, 'its events reshape into the grid');
  await moving.waitForTimeout(700);
  assert.equal(await moving.evaluate(() => !UI.focus && !UI.dragLive && !document.querySelector('.focus-view, .morph-plate')), true);
  const ev = await moving.evaluate(([d, i]) => { const r = document.querySelector(`#dayGrid .event[data-ev="${i}"][data-date="${d}"]`).getBoundingClientRect(); return { top: r.top, left: r.left, bg: document.querySelector(`#dayGrid .event[data-ev="${i}"]`).style.background }; }, [day, id]);
  assert.ok(ev.top > 0 && ev.top < 844 && ev.left >= 0 && ev.left < 390, `the event is on screen: ${JSON.stringify(ev)}`);
  assert.ok(ev.bg && ev.bg !== 'transparent', 'its colour is back');
  assert.equal(await moving.evaluate(() => [...document.querySelectorAll('#dayGrid *, #dayHead *')].some(el => el.getAnimations().length)), false, 'nothing left mid-motion');
});
await step('pulling down still closes the editor; a new event cannot be pulled up (no Fokus without a stored event)', async () => {
  await openFirst(moving); await moving.waitForTimeout(400);
  await pullUp(moving, -200); await moving.waitForTimeout(500);
  assert.equal(await moving.evaluate(() => !UI.editor && !UI.focus), true, "closed by pulling down");
  await moving.evaluate(() => openEditor({ type: 'event', initial: { date: todayISO(), startMin: 600, endMin: 660 } })); await moving.waitForTimeout(400);
  const { armed, lift } = await pullUp(moving, 150);
  assert.equal(armed, false, "armed"); assert.ok(Math.abs(lift) < 0.5, `lift ${lift}`);
  await moving.evaluate(() => closeEditor(true));
});

await browser.close(); server.close();
console.log(failed ? `\n${failed} editor-phone test(s) FAILED` : '\nEditor-phone tests passed.');
process.exit(failed ? 1 : 0);
