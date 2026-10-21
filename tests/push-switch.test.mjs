// The push switch in Settings → Erinnerungen, in a real browser against a simulated Supabase.
// Only what headless Chromium lacks is faked: the push service (subscribe() returns a fixed subscription)
// and the permission prompt (it reports "denied" even when granted). Run from the repo root:  node tests/push-switch.test.mjs
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

/* the simulated Supabase: login, an empty records table, and push_devices */
const devices = new Map(), calls = [];
async function supabase(route) {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  if (path === '/auth/v1/token') return json(200, { access_token: 'token-max', refresh_token: 'refresh-max', expires_in: 3600, user: { id: 'u-max', email: 'max@example.com' } });
  assert.equal(req.headers()['authorization'], 'Bearer token-max');
  if (path === '/rest/v1/records') return req.method() === 'GET' ? json(200, []) : json(201);
  if (path === '/rest/v1/push_devices') {
    calls.push(req.method());
    if (req.method() === 'POST') {
      assert.equal(url.searchParams.get('on_conflict'), 'endpoint');
      const row = JSON.parse(req.postData());
      devices.set(row.endpoint, row);
      return json(201);
    }
    if (req.method() === 'DELETE') { devices.delete(decodeURIComponent(url.searchParams.get('endpoint').slice(3))); return json(204); }
  }
  return json(404, { message: 'not simulated: ' + path });
}

/* a fake push service: what PushManager.subscribe() would hand back */
const FAKE_PUSH = () => {
  Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
  Notification.requestPermission = async () => 'granted';
  const bytes = n => new Uint8Array(n).map((_, i) => i + 1).buffer;
  const sub = { endpoint: 'https://push.example/device-1', getKey: k => bytes(k === 'p256dh' ? 65 : 16),
                unsubscribe: async () => { localStorage.removeItem('fake.sub'); return true; } };
  PushManager.prototype.subscribe = async function (o) {
    if (!(o.applicationServerKey instanceof Uint8Array) || o.applicationServerKey.length !== 65) throw new Error('bad key');
    localStorage.setItem('fake.sub', '1'); return sub;
  };
  PushManager.prototype.getSubscription = async () => localStorage.getItem('fake.sub') ? sub : null;
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Vienna' });
await context.addInitScript(FAKE_PUSH);
await context.route('https://vkdrhvnpmuelckwnafpu.supabase.co/**', supabase);
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

const openSettings = async () => { await page.evaluate(() => toggleSettings(true)); };
const status = () => page.locator('#pushStatus').textContent();

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', e.message.split('\n')[0]); }
};

await page.goto(APP);
await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready);

await step('signed out: the switch is off and disabled, and says why', async () => {
  await openSettings();
  assert.equal(await page.locator('#sPush').isDisabled(), true);
  assert.match(await status(), /zuerst bei Sync anmelden/);
});
await step('the service worker is registered', async () => {
  assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), true);
});
await step('signed in: switching on registers this device with the server', async () => {
  await page.click('#sSync');                                            // Daten → Sync
  await page.fill('#sEmail', 'max@example.com'); await page.fill('#sPassword', 'x'); await page.click('#sSignIn');
  await page.waitForSelector('#sSignOut'); await page.click('#sBack');
  await page.waitForFunction(() => !document.getElementById('sPush').disabled);
  await page.click('#sPush');
  await page.waitForFunction(() => /^An:/.test(document.getElementById('pushStatus').textContent));
  const row = devices.get('https://push.example/device-1');
  assert.ok(row, 'row stored');
  assert.equal(row.time_zone, 'Europe/Vienna');
  assert.equal(row.user_id, 'u-max');
  assert.match(row.p256dh, /^[A-Za-z0-9_-]{87}$/);                       // 65 bytes, base64url without padding
  assert.match(row.auth, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(await page.locator('#sPush').isChecked(), true);
});
await step('after a restart it is still on, and the device is registered again (time zone may change)', async () => {
  calls.length = 0;
  await page.reload();
  await page.waitForFunction(() => pushState.on === true);
  await page.waitForTimeout(200);
  assert.deepEqual(calls, ['POST']);
  await openSettings();
  assert.match(await status(), /^An:/);
});
await step('while push is on, the app does not remind by itself (no doubles)', async () => {
  const shown = await page.evaluate(() => {
    let n = 0; const real = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function () { n++; return Promise.resolve(); };
    S.events.push({ id: 'now', title: 'Jetzt', date: todayISO(), startMin: new Date().getHours() * 60 + new Date().getMinutes() + 2, endMin: 24 * 60 - 1, repeat: 'none', reminderMin: 5 });
    checkReminders();
    S.events.pop(); ServiceWorkerRegistration.prototype.showNotification = real;
    return n;
  });
  assert.equal(shown, 0);
});
await step('switching off removes the device from the server', async () => {
  await page.click('#sPush');
  await page.waitForFunction(() => /^Aus:/.test(document.getElementById('pushStatus').textContent));
  assert.equal(devices.size, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('fake.sub')), null);
});
await step('with push off, the app reminds through the service worker', async () => {
  const shown = await page.evaluate(() => new Promise(done => {
    localStorage.removeItem(NOTIF_STORE);
    ServiceWorkerRegistration.prototype.showNotification = function (title, o) { done([title, o.body]); return Promise.resolve(); };
    const start = new Date().getHours() * 60 + new Date().getMinutes() + 2;
    S.events.push({ id: 'now', title: 'Jetzt', date: todayISO(), startMin: start, endMin: Math.min(start + 30, 24 * 60 - 1), repeat: 'none', reminderMin: 5 });
    checkReminders(); S.events.pop();
    setTimeout(() => done(null), 1000);
  }));
  assert.ok(shown, 'a notification was shown');
  assert.equal(shown[0], 'Jetzt');
});
await step('signing out with push on switches it off first', async () => {
  await page.click('#sPush');
  await page.waitForFunction(() => /^An:/.test(document.getElementById('pushStatus').textContent));
  await page.click('#sSync'); await page.click('#sSignOut');
  await page.waitForFunction(() => !login);
  assert.equal(devices.size, 0);
  assert.equal(await page.evaluate(() => pushState.on), false);
});
await step('no errors on the page', async () => { assert.deepEqual(errors, []); });

await browser.close(); server.close();
console.log(failed ? `\n${failed} push switch test(s) FAILED` : '\nPush switch tests passed.');
process.exit(failed ? 1 : 0);
