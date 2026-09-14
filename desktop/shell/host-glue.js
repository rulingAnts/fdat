// Injected into the bundled renderer by main.js. Adds "Open from FLEx" controls that
// feed chart XML from the LCM sidecar into the existing renderer through window.FDAT.
// Does nothing when window.fdatHost is absent (i.e. when the same bundle runs as the web app).
(function () {
  if (!window.fdatHost || !window.FDAT) return;

  const bar = document.createElement('div');
  bar.className = 'controls-row';
  bar.style.cssText = 'background:#eef5ff;border:1px solid #c8dbff;border-radius:8px;padding:8px 10px;margin-bottom:10px';
  bar.innerHTML = `
    <strong class="small-muted">FLEx project</strong>
    <select id="hostProject" style="padding:6px;border:1px solid #e5e5e5;border-radius:6px;min-width:200px"><option value="">(loading…)</option></select>
    <select id="hostChart" style="padding:6px;border:1px solid #e5e5e5;border-radius:6px;min-width:260px" disabled><option value="">(select a project)</option></select>
    <button id="hostOpen" disabled>Open chart</button>
    <button id="hostRefresh" class="secondary" title="Re-read the chart from FieldWorks">Refresh</button>
    <span id="hostStatus" class="small-muted"></span>`;
  const anchor = document.querySelector('.controls-row');
  anchor.parentNode.insertBefore(bar, anchor);

  // The file picker is meaningless when charts come from FLEx.
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.style.display = 'none';

  const $ = (id) => document.getElementById(id);
  const status = (t) => { $('hostStatus').textContent = t || ''; };
  let current = null;

  async function loadProjects() {
    try {
      const names = await window.fdatHost.listProjects();
      $('hostProject').innerHTML = '<option value="">(select a project)</option>' + names.map(n => `<option>${n.replace(/</g, '&lt;')}</option>`).join('');
    } catch (e) { status('Cannot reach the LCM sidecar: ' + e.message); }
  }

  async function loadCharts(project) {
    $('hostChart').disabled = true; $('hostOpen').disabled = true;
    $('hostChart').innerHTML = '<option value="">(loading…)</option>';
    try {
      status('Opening ' + project + '…');
      await window.fdatHost.openProject(project);
      const charts = await window.fdatHost.listCharts();
      $('hostChart').innerHTML = '<option value="">(select a chart)</option>' + charts.map(c =>
        `<option value="${c.guid}">${(c.textTitle || c.title || c.guid).replace(/</g, '&lt;')} — ${c.rowCount} rows</option>`).join('');
      $('hostChart').disabled = false;
      status('');
    } catch (e) { status('Could not open project: ' + e.message); }
  }

  async function openChart() {
    const guid = $('hostChart').value; if (!guid) return;
    try {
      status('Reading chart…');
      const xml = await window.fdatHost.getChartXml(guid);
      const label = $('hostChart').selectedOptions[0].textContent;
      window.FDAT.loadXmlText(xml, label);
      await window.FDAT.previewCurrentXml();
      current = guid; status('');
    } catch (e) { status('Could not read chart: ' + e.message); }
  }

  $('hostProject').addEventListener('change', (e) => { if (e.target.value) loadCharts(e.target.value); });
  $('hostChart').addEventListener('change', (e) => { $('hostOpen').disabled = !e.target.value; });
  $('hostOpen').addEventListener('click', openChart);
  $('hostRefresh').addEventListener('click', () => { if (current) openChart(); });
  loadProjects();
})();
