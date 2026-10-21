// Sync between two devices, against a simulated Supabase (ARCHITECTURE.md §5, step 4).
// The simulation answers the app's requests the way Supabase does: password login, rows only for
// the signed-in account, synced_at set by the server, and an older version never overwriting a
// newer one (supabase/schema.sql). Run from the repo root:  node tests/sync.test.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import assert from 'node:assert/strict';

// ── the app, served locally ───────────────────────────────────────────────────
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

// ── the simulated Supabase ───────────────────────────────────────────────────
const USERS = { 'max@example.com': { id: 'u-max', password: 'richtig' } };
const table = new Map();                      // "user/id" → row
let clock = Date.now();
const serverNow = () => new Date(++clock).toISOString();
const pgTime = iso => iso.replace(/\.000Z$/, 'Z').replace('Z', '+00:00');   // how Postgres writes times
const requests = [];

async function supabase(route, device) {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  requests.push(`${device.name} ${req.method()} ${path}`);
  if (device.offline) return route.abort('internetdisconnected');
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  if (req.headers()['apikey'] !== 'sb_publishable_0GeBfnRUVWl8sU1aqygttg_JfGH02NU') return json(401, { message: 'Invalid API key' });

  if (path === '/auth/v1/token') {
    const body = JSON.parse(req.postData() || '{}');
    const grant = url.searchParams.get('grant_type');
    let email;
    if (grant === 'password') {
      const u = USERS[body.email];
      if (!u || u.password !== body.password) return json(400, { error_description: 'Invalid login credentials' });
      email = body.email;
    } else if (grant === 'refresh_token' && body.refresh_token?.startsWith('refresh-')) {
      email = body.refresh_token.slice(8);
    } else return json(400, { error_description: 'Invalid Refresh Token' });
    device.tokensIssued = (device.tokensIssued || 0) + 1;
    return json(200, { access_token: `token-${email}`, refresh_token: `refresh-${email}`, expires_in: 3600, user: { id: USERS[email].id, email } });
  }

  const auth = req.headers()['authorization'] || '';
  const email = auth.startsWith('Bearer token-') ? auth.slice(13) : null;
  if (!email || !USERS[email]) return json(401, { message: 'JWT invalid' });
  const uid = USERS[email].id;

  if (path === '/rest/v1/records' && req.method() === 'GET') {
    const [, op, after] = (url.searchParams.get('synced_at') || '').match(/^(gte?)\.(.*)$/) || [];
    const limit = +url.searchParams.get('limit') || 1000;
    const newer = r => !after || (op === 'gte' ? new Date(r.synced_at) >= new Date(after) : new Date(r.synced_at) > new Date(after));
    const rows = [...table.values()].filter(r => r.user_id === uid && newer(r))
      .sort((a, b) => a.synced_at < b.synced_at ? -1 : a.synced_at > b.synced_at ? 1 : a.id < b.id ? -1 : 1).slice(0, limit)
      .map(r => ({ id: r.id, list: r.list, data: r.data, updated_at: pgTime(r.updated_at), deleted: r.deleted, synced_at: pgTime(r.synced_at) }));
    return json(200, rows);
  }
  if (path === '/rest/v1/records' && req.method() === 'POST') {
    assert.equal(url.searchParams.get('on_conflict'), 'user_id,id');
    const arrived = serverNow();                      // like Postgres' now(): one time for the whole request
    for (const r of JSON.parse(req.postData())) {
      if (r.user_id !== uid) return json(403, { message: 'new row violates row-level security policy' });
      const key = `${uid}/${r.id}`, old = table.get(key);
      if (old && new Date(r.updated_at) < new Date(old.updated_at)) continue;   // the trigger keeps the newer row
      table.set(key, { ...r, updated_at: new Date(r.updated_at).toISOString(), synced_at: arrived });
    }
    return json(201);
  }
  return json(404, { message: 'not simulated: ' + path });
}

// ── devices ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
async function device(name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const dev = { name, page, offline: false, errors: [] };
  page.on('pageerror', e => dev.errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route('https://vkdrhvnpmuelckwnafpu.supabase.co/**', r => supabase(r, dev));
  await page.goto(APP); await page.waitForTimeout(400);
  return dev;
}
const plan = dev => dev.page.evaluate(() => S);
const titles = async dev => (await plan(dev)).events.map(e => e.title).sort();
const serverTitles = () => [...table.values()].filter(r => r.list === 'events' && !r.deleted).map(r => r.data.title).sort();
const syncNow = dev => dev.page.evaluate(() => syncNow());
const status = dev => dev.page.evaluate(() => syncStatusText());
async function signInThroughSettings(dev, password) {
  await dev.page.click('#btnSettings');
  await dev.page.fill('#sEmail', 'max@example.com');
  await dev.page.fill('#sPassword', password);
  await dev.page.click('#sSignIn');
  await dev.page.waitForTimeout(600);
}
async function addEvent(dev, title, date = '2026-10-23') {
  await dev.page.evaluate(([t, d]) => mutate(s => s.events.push({ id: uid(), title: t, categoryId: null, date: d, startMin: 600, endMin: 660,
    repeat: 'none', reminderMin: null, todosByDate: {} })), [title, date]);
}

const phone = await device('phone'), laptop = await device('laptop');
await addEvent(phone, 'Nur am Handy');                     // the phone has its own data before any sync

const tests = {
  async 'a wrong password shows a message and keeps what was typed'() {
    await signInThroughSettings(phone, 'falsch');
    assert.match(await phone.page.textContent('#syncStatus'), /Invalid login credentials/);
    assert.equal(await phone.page.inputValue('#sEmail'), 'max@example.com');
    assert.equal(table.size, 0);
  },
  async 'first sign-in with an empty server: the phone uploads its plan'() {
    await phone.page.fill('#sPassword', 'richtig'); await phone.page.click('#sSignIn'); await phone.page.waitForTimeout(800);
    assert.deepEqual(serverTitles(), await titles(phone));
    assert.ok(serverTitles().includes('Nur am Handy'));
    assert.match(await status(phone), /max@example\.com · synchronisiert um/);
    assert.equal(await phone.page.locator('#sSignOut').count(), 1);
  },
  async 'a second device takes the server plan; its own old data is kept as a backup, not uploaded'() {
    const laptopBefore = await titles(laptop);
    const rowsBefore = table.size;
    await signInThroughSettings(laptop, 'richtig');
    assert.deepEqual(await titles(laptop), await titles(phone));
    assert.equal(table.size, rowsBefore);                                     // nothing of the laptop's own data went up
    const backup = await laptop.page.evaluate(() => JSON.parse(localStorage.getItem('timeline.data.before-sync')));
    assert.deepEqual(backup.events.map(e => e.title).sort(), laptopBefore);
  },
  async 'a new event on the phone reaches the laptop'() {
    await addEvent(phone, 'Krit');
    await phone.page.waitForTimeout(2200);                                    // sent shortly after the change
    assert.ok(serverTitles().includes('Krit'));
    await syncNow(laptop);
    assert.ok((await titles(laptop)).includes('Krit'));
  },
  async 'a deletion on the laptop reaches the phone, and stays deleted'() {
    await laptop.page.evaluate(() => mutate(s => { s.events = s.events.filter(e => e.title !== 'Krit'); }));
    await syncNow(laptop);
    await syncNow(phone);
    assert.ok(!(await titles(phone)).includes('Krit'));
    await syncNow(phone); await syncNow(laptop);                              // more rounds: it does not come back
    assert.ok(!(await titles(phone)).includes('Krit') && !(await titles(laptop)).includes('Krit'));
  },
  async 'offline on the phone: edits wait, and go up when back online'() {
    phone.offline = true;
    await addEvent(phone, 'Im U-Bahn-Tunnel');
    await syncNow(phone);
    assert.match(await status(phone), /offline/);
    assert.ok(!serverTitles().includes('Im U-Bahn-Tunnel'));
    phone.offline = false;
    await syncNow(phone);
    assert.ok(serverTitles().includes('Im U-Bahn-Tunnel'));
  },
  async 'the same event edited on both devices: the later edit wins on both'() {
    const id = (await plan(phone)).events.find(e => e.title === 'Im U-Bahn-Tunnel').id;
    await syncNow(laptop);
    phone.offline = true;
    await phone.page.evaluate(i => mutate(s => { s.events.find(e => e.id === i).title = 'früher (Handy)'; }), id);
    await new Promise(r => setTimeout(r, 30));
    await laptop.page.evaluate(i => mutate(s => { s.events.find(e => e.id === i).title = 'später (Laptop)'; }), id);
    await syncNow(laptop);
    phone.offline = false;
    await syncNow(phone); await syncNow(laptop);
    const t = async dev => (await plan(dev)).events.find(e => e.id === id).title;
    assert.equal(await t(phone), 'später (Laptop)');
    assert.equal(await t(laptop), 'später (Laptop)');
    assert.equal(table.get(`u-max/${id}`).data.title, 'später (Laptop)');
  },
  async 'undo cannot step back across changes from another device'() {
    await addEvent(laptop, 'Vom Laptop'); await syncNow(laptop);
    await addEvent(phone, 'Lokal');
    await syncNow(phone);
    assert.equal(await phone.page.evaluate(() => UI.undo.length), 0);
  },
  async 'an expired login is renewed without asking again'() {
    const before = phone.tokensIssued;
    await phone.page.evaluate(() => { login.expires_at = Date.now() - 1000; });
    await syncNow(phone);
    assert.equal(phone.tokensIssued, before + 1);
    assert.match(await status(phone), /synchronisiert um/);
  },
  async 'signing out sends what is left, then stops syncing'() {
    await addEvent(phone, 'Letzte Änderung');
    await phone.page.evaluate(() => signOut());
    assert.ok(serverTitles().includes('Letzte Änderung'));
    const fromPhone = () => requests.filter(r => r.startsWith('phone ')).length;
    const n = fromPhone();
    await addEvent(phone, 'Nach dem Abmelden'); await phone.page.waitForTimeout(2000);
    assert.ok(!serverTitles().includes('Nach dem Abmelden'));
    assert.equal(fromPhone(), n, `phone made ${fromPhone() - n} requests after signing out`);
  },
  async 'a big plan (1,200 events, sent in batches that share one arrival time) arrives complete on a new device'() {
    await laptop.page.evaluate(() => mutate(s => { for (let i = 0; i < 1200; i++) s.events.push({ id: 'bulk' + i, title: 'Viele ' + i,
      categoryId: null, date: '2027-01-04', startMin: 600, endMin: 660, repeat: 'none', reminderMin: null, todosByDate: {} }); }));
    await syncNow(laptop);
    const tablet = await device('tablet');
    await signInThroughSettings(tablet, 'richtig');
    assert.equal((await titles(tablet)).length, (await titles(laptop)).length);
    assert.equal((await plan(tablet)).events.filter(e => e.id.startsWith('bulk')).length, 1200);
    await tablet.page.context().close();
  },
  async 'no errors on either device'() {
    assert.deepEqual(phone.errors, []); assert.deepEqual(laptop.errors, []);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
}
await browser.close(); server.close();
console.log(failed ? `\n${failed} sync test(s) FAILED` : '\nSync tests passed.');
process.exit(failed ? 1 : 0);
