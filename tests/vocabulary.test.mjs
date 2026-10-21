// Vocabulary test — RULEBOOK.md §A.11.
// Fails when a banned word appears in code, comments or UI text more often than the
// allow-list permits. The allow-list holds the old words still in the code; it may
// only shrink. Run from the repo root:  node tests/vocabulary.test.mjs
// Update the allow-list after removing old words:  node tests/vocabulary.test.mjs --update

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT       = process.cwd();
const RULEBOOK   = join(ROOT, 'docs/RULEBOOK.md');
const ALLOW_FILE = join(ROOT, 'tests/vocabulary.allow.json');
const SCAN_EXT   = new Set(['.js', '.mjs', '.html', '.css']);
const SKIP_DIRS  = new Set(['.git', 'docs', 'tests', 'node_modules']);
const EXEMPT     = new Set(['zoomlevel', 'scrollbar', 'scrollbars', 'webkit-scrollbar-track', 'aria-modal']);     // whole words the rulebook allows (§A.11)

// 1. The banned words, read from the rulebook's never-say block.
function bannedWords() {
  const text  = readFileSync(RULEBOOK, 'utf8');
  const block = text.match(/```never-say\n([\s\S]*?)```/);
  if (!block) throw new Error('No ```never-say block in docs/RULEBOOK.md');
  const map = new Map();
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\s*(\S+)\s*→\s*(.+)$/);
    if (m) map.set(m[1].toLowerCase(), m[2].trim());
  }
  return map;
}

// 2. Every word in a file. Identifiers are split, so `examRow` and `exam-chip` yield `exam`.
function words(text) {
  const out = [];
  text = text.replace(/\.pop\(/g, '.(');   // JavaScript's own list method, not the banned word (RULEBOOK A.11)
  for (const tok of text.match(/[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_-]*/g) || []) {
    const whole = tok.toLowerCase();
    if (EXEMPT.has(whole)) continue;
    const parts = tok
      .replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, '$1 $2')
      .split(/[\s_-]+/)
      .map(p => p.toLowerCase())
      .filter(Boolean);
    const all = [whole.replace(/[_-]/g, ''), ...parts];
    out.push(...new Set([...all, ...all.filter(w => w.length > 3 && w.endsWith('s')).map(w => w.slice(0, -1))]));   // plurals count too (exams → exam)
  }
  return out;
}

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return SKIP_DIRS.has(name) ? [] : files(p);
    return SCAN_EXT.has(extname(name)) ? [p] : [];
  });
}

// 3. Count banned words per file.
const banned = bannedWords();
const found  = {};
for (const file of files(ROOT)) {
  const counts = {};
  for (const w of words(readFileSync(file, 'utf8'))) {
    if (banned.has(w)) counts[w] = (counts[w] || 0) + 1;
  }
  if (Object.keys(counts).length) found[relative(ROOT, file)] = counts;
}

if (process.argv.includes('--update')) {
  writeFileSync(ALLOW_FILE, JSON.stringify(found, null, 2) + '\n');
  console.log('Allow-list written:', relative(ROOT, ALLOW_FILE));
  process.exit(0);
}

// 4. Compare against the allow-list: counts may fall, never rise.
const allow = existsSync(ALLOW_FILE) ? JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) : {};
const errors = [];
for (const [file, counts] of Object.entries(found)) {
  for (const [w, n] of Object.entries(counts)) {
    const max = allow[file]?.[w] ?? 0;
    if (n > max) errors.push(`${file}: "${w}" ×${n} (allowed ${max}) → use "${banned.get(w)}"`);
  }
}
const shrunk = Object.entries(allow).some(([f, c]) =>
  Object.entries(c).some(([w, n]) => (found[f]?.[w] ?? 0) < n));

if (errors.length) {
  console.error('Vocabulary test FAILED — banned words added:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('Vocabulary test passed.' + (shrunk ? ' Old words were removed: run with --update to shrink the allow-list.' : ''));
