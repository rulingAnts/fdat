#!/usr/bin/env node
// Write a SHA-256 checksum file next to every release artifact in dist/ and an
// aggregate dist/checksums.txt (sha256sum-compatible). Run after `npm run dist:*`.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SKIP = /\.(sha256|txt|yml|yaml|blockmap)$/i;

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of (await fs.open(file)).createReadStream()) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  let entries;
  try { entries = await fs.readdir(DIST, { withFileTypes: true }); }
  catch (e) { console.error('No dist/ folder. Build first (npm run dist).'); process.exit(1); }
  const files = entries.filter(e => e.isFile() && !SKIP.test(e.name)).map(e => e.name).sort();
  if (!files.length) { console.error('No artifacts found in dist/.'); process.exit(1); }
  const lines = [];
  for (const name of files) {
    const digest = await sha256(path.join(DIST, name));
    await fs.writeFile(path.join(DIST, name + '.sha256'), `${digest}  ${name}\n`);
    lines.push(`${digest}  ${name}`);
    console.log(digest, name);
  }
  await fs.writeFile(path.join(DIST, 'checksums.txt'), lines.join('\n') + '\n');
  console.log(`Wrote ${files.length} .sha256 files and checksums.txt`);
}

main().catch(err => { console.error(err); process.exit(1); });
