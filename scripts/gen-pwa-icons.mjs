#!/usr/bin/env node
// Generate the PWA icon set in docs/assets from assets/icon.svg using sharp.
// Produces icon-{16,32,48,64,128,192,256,512}.png plus maskable 192/512 variants
// (artwork inset to ~80% on the theme colour so it survives Android's mask shapes).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon.svg');
const OUT = path.join(ROOT, 'docs', 'assets');
const SIZES = [16, 32, 48, 64, 128, 192, 256, 512];
const MASKABLE = [192, 512];
const THEME = '#0b6edb';

async function main(){
  const svg = await fs.readFile(SRC);
  await fs.mkdir(OUT, { recursive: true });
  for(const size of SIZES){
    await sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png().toFile(path.join(OUT, `icon-${size}.png`));
    console.log(`icon-${size}.png`);
  }
  for(const size of MASKABLE){
    const inner = Math.round(size * 0.8);
    const art = await sharp(svg, { density: 384 }).resize(inner, inner, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: THEME } })
      .composite([{ input: art, gravity: 'centre' }]).png().toFile(path.join(OUT, `icon-${size}-maskable.png`));
    console.log(`icon-${size}-maskable.png`);
  }
  console.log(`Wrote icons to ${OUT}`);
}
main().catch(err => { console.error(err); process.exit(1); });
