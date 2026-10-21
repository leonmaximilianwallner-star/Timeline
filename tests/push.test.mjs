// End-to-end test of the push itself: the server function's sender (webPusher) with the real library
// sends to a fake push service on this machine; the test then decrypts the message on its own
// (RFC 8291 + RFC 8188, as a phone does) and checks the VAPID signature (RFC 8292, as Google/Apple do).
// Run from the repo root:  node --experimental-strip-types tests/push.test.mjs
import http from 'node:http';
import assert from 'node:assert/strict';
import * as lib from './vendor/webpush.bundle.mjs';
import { webPusher } from '../supabase/functions/send-reminders/index.ts';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const b64url = buf => Buffer.from(buf).toString('base64url');
const unb64url = s => new Uint8Array(Buffer.from(s, 'base64url'));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; parts.forEach(p => { out.set(p, i); i += p.length; }); return out; };
const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256', salt, info }, await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits));

/* the phone: a key pair and an auth secret, as PushManager.subscribe() would make them */
const phoneKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const phonePublic = new Uint8Array(await subtle.exportKey('raw', phoneKeys.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

/* RFC 8291: what the phone does with an incoming push */
async function decrypt(body){
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idLen = body[20];
  const serverPublic = body.slice(21, 21 + idLen), cipher = body.slice(21 + idLen);
  assert.ok(cipher.length <= rs, 'one record');
  const serverKey = await subtle.importKey('raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: serverKey }, phoneKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc.encode('WebPush: info\0'), phonePublic, serverPublic), 256);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce },
    await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  let end = plain.length - 1;
  while (plain[end] === 0) end--;
  assert.equal(plain[end], 2, 'last-record delimiter');
  return new TextDecoder().decode(plain.slice(0, end));
}

/* RFC 8292: what the push service checks before it accepts */
async function checkVapid(header, audience, contact){
  const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  assert.ok(jwt && k, 'Authorization: vapid t=…, k=…');
  const [h, p, sig] = jwt.split('.');
  const key = await subtle.importKey('raw', unb64url(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64url(sig), enc.encode(h + '.' + p)), 'signature');
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(claims.aud, audience);
  assert.equal(claims.sub, contact);
  assert.ok(claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 24 * 3600, 'expiry within 24 h');
  return k;
}

/* a fake push service */
let reply = 201, received = null;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => { received = { path: req.url, headers: req.headers, body: new Uint8Array(Buffer.concat(chunks)) }; res.writeHead(reply); res.end(); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const vapid = await lib.generateVapidKeys({ extractable: true });
const vapidJson = JSON.stringify(await lib.exportVapidKeys(vapid));        // what goes into the VAPID_KEYS secret
const appKey = await lib.exportApplicationServerKey(vapid);               // what the app puts into subscribe()
const contact = 'mailto:test@example.com';
const push = await webPusher(lib, vapidJson, contact);
const device = { endpoint: `${origin}/push/abc`, p256dh: b64url(phonePublic), auth: b64url(authSecret) };
const message = { title: 'Tutorium', body: 'In 15 min · 09:00–11:00', tag: 'e1@2026-10-21', day: '2026-10-21' };

const tests = {
  async 'the phone can decrypt the message, and it is exactly what was sent'() {
    reply = 201;
    await push(device, message);
    assert.equal(received.path, '/push/abc');
    assert.equal(received.headers['content-encoding'], 'aes128gcm');
    assert.deepEqual(JSON.parse(await decrypt(received.body)), message);
  },
  async 'the push service would accept the signature, and it names this app'() {
    const k = await checkVapid(received.headers.authorization, origin, contact);
    assert.equal(k, appKey, 'the key in the header is the one the app subscribed with');
  },
  async 'the push is urgent and expires after an hour'() {
    assert.equal(received.headers.urgency, 'high');
    assert.equal(received.headers.ttl, '3600');
  },
  async 'a push service answering 410 means the device is gone'() {
    reply = 410;
    await assert.rejects(push(device, message), e => e.gone === true);
  },
  async 'other failures are passed on, not mistaken for a gone device'() {
    reply = 500;
    await assert.rejects(push(device, message), e => !e.gone);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { await fn(); console.log('✓', name); }
  catch (e) { failed++; console.error('✗', name, '\n   ', String(e.message || e).split('\n')[0]); }
}
server.close();
console.log(failed ? `\n${failed} push test(s) FAILED` : '\nPush tests passed.');
process.exit(failed ? 1 : 0);
