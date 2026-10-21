// Asset version — every file index.html loads carries ?v=<version>, computed from the content of all of them.
// Any change gives a new version, so a browser never mixes an old file with a new one after an update.
//   node tests/asset-version.mjs           fails if a file changed but the version in index.html didn't
//   node tests/asset-version.mjs --update  writes the current version into index.html
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync('index.html', 'utf8');
const ref = /(<script src="|<link rel="stylesheet" href=")([^"?:]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g;
const files = [...html.matchAll(ref)].map(m => m[2]);
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);
const stamped = html.replace(ref, (_, a, f, b) => `${a}${f}?v=${version}${b}`);

if (process.argv.includes('--update')) {
  writeFileSync('index.html', stamped);
  console.log(`Asset version ${version} written for ${files.length} files.`);
} else if (stamped !== html) {
  console.error(`Asset version FAILED: files changed since the version in index.html. Run: node tests/asset-version.mjs --update`);
  process.exit(1);
} else console.log(`Asset version up to date (${version}, ${files.length} files).`);
