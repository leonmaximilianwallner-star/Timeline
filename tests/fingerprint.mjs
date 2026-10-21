// Fingerprint test — ARCHITECTURE.md §10.
// Proves that a change did not alter what the app looks like. It opens two builds side by side
// (the reference and the working copy) at the same fixed date and screen size, plays the same
// steps in both, and compares every step pixel by pixel and every element's position.
//
//   node tests/fingerprint.mjs main            compare the working copy with the branch "main"
//   node tests/fingerprint.mjs <dir> [<dir>]   compare two folders (second defaults to this one)
//
// Screenshots of any step that differs are written to tests/.fingerprint/ (not committed).

import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const FIXED_NOW = new Date('2026-10-21T10:00:00+02:00');   // a Wednesday; change only on purpose
const SCREENS = {
  phone:   { width: 390,  height: 844,  isMobile: true,  hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900,  isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};
const OUT = resolve('tests/.fingerprint');

// ── the steps both builds go through ─────────────────────────────────────────
// Each step leaves the app in a state worth comparing. Steps only use things a person can do.
const STEPS = [
  ['start',            async p => {}],
  ['scrolled',         async p => p.evaluate(() => { const s = document.getElementById('scene'); s.scrollLeft += 1700; s.scrollTop += 500; })],
  ['scrolled-back',    async p => p.evaluate(() => { const s = document.getElementById('scene'); s.scrollLeft -= 2600; s.scrollTop -= 500; })],
  ['today',            async p => p.click('#btnToday')],
  ['phase-editor',     async p => { await p.locator('[data-phase]').first().click(); }],
  ['closed',           async p => p.keyboard.press('Escape')],
  ['todo-panel',       async p => { await p.locator('.evcard').nth(1).click(); }],
  ['todo-ticked',      async p => { await p.locator('#pop .tcheck').first().click(); }],
  ['event-editor',     async p => { await p.locator('#popEdit').click(); }],
  ['closed-2',         async p => p.keyboard.press('Escape')],
  ['undo',             async p => p.click('#btnUndo')],
  ['add-mode',         async p => p.click('#fab')],
  ['add-mode-off',     async p => p.click('#fab')],
  ['settings',         async p => p.click('#btnSettings')],
  ['settings-closed',  async p => p.keyboard.press('Escape')],
  ['time-budget',      async p => p.click('#btnBudget')],
];

// ── serving a build ───────────────────────────────────────────────────────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
                '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

function serve(root) {
  return new Promise(done => {
    const server = createServer(async (req, res) => {
      let path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
      try {
        const body = await readFile(path);
        res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404); res.end(); }
    });
    server.listen(0, '127.0.0.1', () => done(server));
  });
}

async function buildFromRef(ref) {
  const dir = await mkdtemp(join(tmpdir(), 'timeline-ref-'));
  execSync(`git archive ${ref} | tar -x -C "${dir}"`, { stdio: 'inherit' });
  return dir;
}

// ── recording one build ──────────────────────────────────────────────────────
async function record(browser, root, screen) {
  const server = await serve(root);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height },
    isMobile: screen.isMobile, hasTouch: screen.hasTouch, deviceScaleFactor: screen.deviceScaleFactor,
    reducedMotion: 'reduce', locale: 'de-AT', timezoneId: 'Europe/Vienna' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });   // ERR_FAILED = the fonts blocked below
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   // same fallback font in both builds
  await page.clock.setFixedTime(FIXED_NOW);
  // Compare settled states only: no transitions, animations or blinking text cursor (timing noise, not design).
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important;caret-color:transparent!important}';
    document.head.appendChild(st);
  }));
  await page.addInitScript(() => { Math.random = (() => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); });
  await page.goto(url, { waitUntil: 'load' });
  await settle(page);

  const frames = [];
  for (const [name, act] of STEPS) {
    try { await act(page); } catch (e) { errors.push(`step "${name}": ${e.message.split('\n')[0]}`); }
    await settle(page);
    frames.push({ name, png: await page.screenshot(), layout: await layoutOf(page) });
  }
  await context.close();
  server.close();
  return { frames, errors };
}

// Waits until scrolling (animated scrolls, snapping) has come to rest for half a second.
async function settle(page) {
  let last = '', still = 0;
  for (let i = 0; i < 80 && still < 5; i++) {
    await page.waitForTimeout(100);
    const now = await page.evaluate(() => { const s = document.getElementById('scene'); return s ? s.scrollLeft + ',' + s.scrollTop : ''; });
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

// Every visible element's place and size, in document order.
function layoutOf(page) {
  return page.evaluate(() => [...document.body.querySelectorAll('*')].map(el => {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const label = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    return `${label} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean));
}

function pixelDiff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return Infinity;
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4)
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) n++;
  return n;
}

// ── main ──────────────────────────────────────────────────────────────────────
const [argA, argB = '.'] = process.argv.slice(2);
if (!argA) { console.error('Usage: node tests/fingerprint.mjs <git ref | folder> [folder]'); process.exit(2); }
const refRoot = existsSync(argA) && statSync(argA).isDirectory() ? resolve(argA) : await buildFromRef(argA);
const newRoot = resolve(argB);

const browser = await chromium.launch();
await rm(OUT, { recursive: true, force: true });
let failed = false;

for (const [screenName, screen] of Object.entries(SCREENS)) {
  const [ref, now] = [await record(browser, refRoot, screen), await record(browser, newRoot, screen)];
  if (now.errors.length > ref.errors.length) {
    failed = true;
    console.error(`✗ ${screenName}: new errors\n    ` + now.errors.filter(e => !ref.errors.includes(e)).join('\n    '));
  }
  for (let i = 0; i < STEPS.length; i++) {
    const a = ref.frames[i], b = now.frames[i];
    const px = pixelDiff(a.png, b.png);
    const moved = a.layout.join('\n') === b.layout.join('\n') ? null
      : a.layout.findIndex((l, j) => l !== b.layout[j]);
    if (process.env.FP_SAVE) { await mkdir(OUT, { recursive: true }); await writeFile(join(OUT, `${screenName}-${String(i).padStart(2, '0')}-${a.name}.png`), b.png); }
    if (px === 0 && moved === null) { console.log(`✓ ${screenName} · ${a.name}`); continue; }
    failed = true;
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, `${screenName}-${a.name}-before.png`), a.png);
    await writeFile(join(OUT, `${screenName}-${a.name}-after.png`), b.png);
    console.error(`✗ ${screenName} · ${a.name}: ${px} pixels differ` +
      (moved !== null ? `; first moved element:\n    before: ${a.layout[moved]}\n    after:  ${b.layout[moved]}` : ''));
  }
  if (ref.errors.length) console.log(`  (errors present in both builds, ${screenName}:\n    ${[...new Set(ref.errors)].join('\n    ')})`);
}
await browser.close();
console.log(failed ? '\nFingerprint test FAILED — see tests/.fingerprint/' : '\nFingerprint test passed: both builds look identical in every step.');
process.exit(failed ? 1 : 0);
