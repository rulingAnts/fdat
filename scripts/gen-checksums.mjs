#!/usr/bin/env node
// Generate SHA256 checksum files for every artifact in dist/ plus an aggregate checksums.txt
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const SKIP = new Set(['checksums.txt']);
const ARTIFACT_EXT = new Set(['.dmg', '.zip', '.exe', '.AppImage', '.deb', '.rpm', '.tar.gz', '.msi', '.blockmap', '.yml']);

async function sha256(file){
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try{
    const stream = handle.createReadStream();
    for await (const chunk of stream) hash.update(chunk);
  } finally { await handle.close(); }
  return hash.digest('hex');
}

async function main(){
  let entries;
  try{ entries = await fs.readdir(DIST, { withFileTypes: true }); }
  catch(_){ console.error(`No dist/ folder found at ${DIST}. Run a build first (e.g. npm run dist).`); process.exit(1); }
  const files = entries.filter(e => e.isFile() && !SKIP.has(e.name) && !e.name.endsWith('.sha256')).map(e => e.name)
    .filter(n => ARTIFACT_EXT.has(path.extname(n)) || n.endsWith('.tar.gz'))
    .sort();
  if(!files.length){ console.error('No artifacts found in dist/.'); process.exit(1); }
  const lines = [];
  for(const name of files){
    const full = path.join(DIST, name);
    const hex = await sha256(full);
    await fs.writeFile(`${full}.sha256`, `${hex}  ${name}\n`);
    lines.push(`${hex}  ${name}`);
    console.log(`${hex}  ${name}`);
  }
  await fs.writeFile(path.join(DIST, 'checksums.txt'), lines.join('\n') + '\n');
  console.log(`\nWrote ${files.length} .sha256 files and checksums.txt to ${DIST}`);
}
main().catch(err => { console.error(err); process.exit(1); });
