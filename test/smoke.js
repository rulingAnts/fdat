#!/usr/bin/env node
/*
  Browser smoke test for the FDAT web app.

  Serves docs/ with the repo's dev server, opens it in headless Chromium via
  Playwright, renders test/fixtures/sample-chart.xml and exercises the settings
  panels that historically broke on re-render. Fails (exit 1) on any page error,
  console error, unexpected dialog, or failed assertion.

  Usage:  npm test            (needs `playwright` resolvable: npm i -D playwright,
                               or NODE_PATH pointing at a global install)
          npx playwright install chromium   (once, to fetch the browser)
*/
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SMOKE_PORT || 5199);
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'sample-chart.xml');

let playwright;
try { playwright = require('playwright'); }
catch (e) { console.error('playwright is not installed. Run: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const failures = [];
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures.push(msg); console.log('  FAIL ' + msg); } }

async function waitForServer(url, ms = 10000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('dev server did not start');
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, '.local', 'dev-server.js')], {
    env: { ...process.env, PORT: String(PORT), NO_OPEN: '1' }, stdio: 'ignore'
  });
  const base = `http://localhost:${PORT}/`;
  let browser;
  try {
    await waitForServer(base);
    browser = await playwright.chromium.launch();
    const page = await browser.newContext().then(c => c.newPage());
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
    page.on('dialog', d => { problems.push('dialog: ' + d.message()); d.dismiss(); });

    await page.goto(base);
    check(await page.title() === 'Flex DiscourseChart Analysis Tool (FDAT)', 'page loads with expected title');

    // Render the fixture through the public host API
    const xml = fs.readFileSync(FIXTURE, 'utf8');
    const rendered = await page.evaluate(async (x) => { window.FDAT.loadXmlText(x, 'sample-chart.xml'); return await window.FDAT.previewCurrentXml(); }, xml);
    check(rendered === true, 'previewCurrentXml resolves true');
    await page.waitForSelector('table.chartshell');
    const rows = await page.$$eval('table.chartshell tbody tr', r => r.length);
    check(rows === 3, `chart renders 3 body rows (got ${rows})`);
    check(await page.$eval('#fileLoadedMsg', n => n.textContent) === '✓ sample-chart.xml', 'loaded-file message shows the source name');
    check(await page.$$eval('table.chartshell .pair.listRef', n => n.length) === 4, 'listRef markers rendered');
    check(await page.$$eval('#abbrevRows .abbr-row', n => n.length) === 2, 'abbreviation rows built from markers (Adv, PP)');
    const colsBase = await page.$eval('table.chartshell', t => t.querySelectorAll('colgroup col').length);
    check(colsBase === 8, `colgroups expanded to one <col> per column (got ${colsBase})`);

    // Collapsible headers must still toggle after a re-render (regression: double-wired listeners)
    for (const id of ['documentPartsHeader', 'textGenresHeader', 'languageProjectsHeader']) await page.click('#' + id);
    await page.evaluate(() => window.FDAT.previewCurrentXml());
    await page.waitForTimeout(200);
    await page.click('#prologueHeader');
    check(await page.$eval('#prologuePanel', p => p.getAttribute('data-collapsed')) === '0', 'panel header opens after a second render');
    await page.click('#prologueHeader');
    check(await page.$eval('#prologuePanel', p => p.getAttribute('data-collapsed')) === '1', 'panel header closes again');

    // Salience column toggling must add/remove exactly one <col>
    const colCount = () => page.$eval('table.chartshell', t => t.querySelectorAll('colgroup col').length);
    await page.$eval('#salienceShowColumn', el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
    check(await colCount() === colsBase + 1, 'showing the salience column adds one <col>');
    check(await page.$$eval('table.chartshell thead th[data-sal-col]', n => n.length) === 2, 'salience header cells added to both title rows');
    await page.$eval('#salienceShowColumn', el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
    check(await colCount() === colsBase, 'hiding the salience column removes its <col>');

    // Custom columns: one <col>, one header cell per title row, one editable cell per body row
    await page.$eval('#ccAdd', el => el.click());
    check(await colCount() === colsBase + 1, 'adding a custom column adds one <col>');
    check(await page.$$eval('table.chartshell thead th.cc-header', n => n.length) === 2, 'custom column header in both title rows');
    check(await page.$$eval('table.chartshell tbody td.cc-cell', n => n.length) === 3, 'custom column cell in each body row');
    const ccInsertedAfterRownum = await page.$eval('table.chartshell tbody tr', tr => {
      const cells = Array.from(tr.children);
      const rn = cells.findIndex(td => td.querySelector('.rownum'));
      return cells[rn + 1] && cells[rn + 1].classList.contains('cc-cell');
    });
    check(ccInsertedAfterRownum, 'custom column sits right after the row-number column');
    // Custom column values persist by row GUID across a re-render
    await page.$eval('table.chartshell tbody tr .cc-edit', d => { d.textContent = 'hello'; d.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => window.FDAT.previewCurrentXml());
    await page.waitForSelector('table.chartshell tbody tr .cc-edit');
    check(await page.$eval('table.chartshell tbody tr .cc-edit', d => d.textContent) === 'hello', 'custom column value survives a re-render');

    // Notes mode change must trigger exactly one re-render (regression: listener cascade)
    await page.evaluate(() => { window.__renders = 0; const o = window.renderDocument; window.renderDocument = async function (x) { window.__renders++; return o(x); }; });
    await page.$eval('#notesMode', el => { el.value = 'endnotes'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForSelector('.chart-endnotes');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__renders) === 1, 'notes-mode change re-renders exactly once');
    check(await page.$$eval('.chart-endnotes .endnote-item', n => n.length) === 2, 'endnotes built for the two rows with notes');
    check(await page.$$eval('a.note-link', n => n.length) === 2, 'note links replace the notes column cells');
    await page.$eval('#notesMode', el => { el.value = 'inline'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(300);

    // Free translation (tooltip mode) and epilogue appear once in the export
    await page.evaluate(() => {
      localStorage.setItem('flex_textchart_free_trans_prefs_v1', JSON.stringify({ mode: 'tooltip', items: { '1a': 'Then the man went home.' }, style: {} }));
      localStorage.setItem('flex_textchart_postlogue_v1', JSON.stringify({ html: 'The end.\n\nReally.', autoConvert: true }));
      return window.FDAT.previewCurrentXml();
    });
    await page.waitForSelector('.chart-freetrans');
    check(await page.$$eval('.chart-freetrans .ft-item', n => n.length) === 1, 'free translation section lists the one translation');
    check(await page.$$eval('#renderArea > .chart-epilogue p', n => n.length) === 2, 'epilogue auto-converts blank lines to paragraphs');
    const exportHtml = await page.evaluate(() => buildStandaloneHTML({ includeToolbar: true }));
    check((exportHtml.match(/class="chart-epilogue"/g) || []).length === 1, 'export contains the epilogue exactly once');
    check(!/class="add-band-btn"|class="add-trans-btn"|contenteditable/.test(exportHtml), 'export strips in-app buttons and editable regions');
    check(/<title>FDAT Discourse Chart<\/title>/.test(exportHtml), 'export uses the default FDAT title when no prologue title is set');
    check(/id="exportSaveBtn"/.test(exportHtml), 'export includes the toolbar');

    // Non-chart XML is rejected with a pointer to the general viewer
    await page.evaluate(async () => { window.FDAT.loadXmlText('<lists><list><name>x</name></list></lists>', 'lists.xml'); await window.FDAT.previewCurrentXml(); });
    check(await page.$eval('#renderArea', n => /flexml_display/.test(n.innerHTML)), 'non-chart XML shows the FLEx XML Viewer link');

    // Settings export/import round trip through the public JSON shape
    const settings = await page.evaluate(() => collectAllSettings());
    check(settings && settings.fdat_hierarchical_settings_v1 && settings.fdat_hierarchical_settings_v1.languages, 'collectAllSettings returns hierarchical settings');

    check(problems.length === 0, 'no page errors, console errors, or dialogs' + (problems.length ? ' — ' + problems.join(' | ') : ''));
  } catch (e) {
    failures.push('exception: ' + (e && e.message || e));
    console.error(e);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
  console.log('\nsmoke test passed');
})();
