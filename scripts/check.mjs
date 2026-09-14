#!/usr/bin/env node
// Fast static checks: syntax-check every JavaScript file in the project and, when
// xmllint is available, check the XSL and test fixtures are well-formed XML.
// Run with `npm run check`. Exits non-zero on the first failure.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const JS_FILES = [
  'main.js',
  'docs/app.js',
  'docs/sw.js',
  '.local/dev-server.js',
  '.local/dev-android-pwa.js',
  '.local/shell-dev-auto.mjs',
  'scripts/check.mjs',
  'scripts/gen-icons.mjs',
  'scripts/gen-pwa-icons.mjs',
  'scripts/gen-checksums.mjs',
  'test/smoke.js',
  'desktop/shell/main.js',
  'desktop/shell/preload.js',
  'desktop/shell/host-glue.js'
];
const XML_FILES = [
  'docs/textchart/textchart-to-html.xsl',
  'test/fixtures/sample-chart.xml'
];

let failed = false;
for (const f of JS_FILES) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  if (r.status === 0) console.log('ok   ' + f);
  else { failed = true; console.log('FAIL ' + f + '\n' + (r.stderr || r.stdout)); }
}

const xmllint = spawnSync('xmllint', ['--version'], { encoding: 'utf8' });
if (xmllint.error) {
  console.log('skip XML well-formedness checks (xmllint not installed)');
} else {
  for (const f of XML_FILES) {
    const r = spawnSync('xmllint', ['--noout', path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status === 0) console.log('ok   ' + f);
    else { failed = true; console.log('FAIL ' + f + '\n' + r.stderr); }
  }
}

process.exit(failed ? 1 : 0);
