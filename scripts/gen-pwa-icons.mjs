#!/usr/bin/env node
// Regenerate the PWA icon set in docs/assets from assets/icon.svg using sharp.
//
//   npm run pwa:icons
//
// Produces icon-{16,32,48,64,128,192,256,512}.png plus maskable variants for
// 192 and 512 (the artwork is inset so it survives Android's circular masks).
// Requires `sharp` (a devDependency). Desktop .icns/.ico icons are produced by
// scripts/gen-icons.mjs instead.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICON_SVG = path.join(ROOT, 'assets', 'icon.svg');
const OUT_DIR = path.join(ROOT, 'docs', 'assets');
const SIZES = [16, 32, 48, 64, 128, 192, 256, 512];
const MASKABLE_SIZES = [192, 512];
const MASKABLE_BG = '#0b6edb'; // matches theme_color in manifest.webmanifest
const MASKABLE_INSET = 0.12;   // fraction of each edge kept clear (safe zone is the inner 80%)

async function main() {
  let sharp;
  try { ({ default: sharp } = await import('sharp')); }
  catch (_) { console.error('sharp is not installed. Run: npm i -D sharp'); process.exit(1); }

  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(ICON_SVG).resize(size, size).png().toFile(out);
    console.log('wrote', path.relative(ROOT, out));
  }
  for (const size of MASKABLE_SIZES) {
    const inner = Math.round(size * (1 - 2 * MASKABLE_INSET));
    const art = await sharp(ICON_SVG).resize(inner, inner).png().toBuffer();
    const out = path.join(OUT_DIR, `icon-${size}-maskable.png`);
    await sharp({ create: { width: size, height: size, channels: 4, background: MASKABLE_BG } })
      .composite([{ input: art, gravity: 'centre' }])
      .png()
      .toFile(out);
    console.log('wrote', path.relative(ROOT, out));
  }
  console.log('Done. Remember to bump SW_VERSION in docs/sw.js so installed apps refresh their icons.');
}

main().catch(err => { console.error('Icon generation failed:', err.message); process.exit(1); });
