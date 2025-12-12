// DOM helpers and processing overlay
const byId = id => document.getElementById(id);

function showProcessing(msg = 'Processing...') {
  const overlay = document.getElementById('processingOverlay');
  const msgEl = document.getElementById('processingMessage');
  if (overlay && msgEl) {
    msgEl.textContent = msg;
    overlay.style.display = 'flex';
    void overlay.offsetWidth; // reflow
  }
}

function hideProcessing() {
  const overlay = document.getElementById('processingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Section visibility helpers
function showLanguageProjectsSection(show) {
  const p = byId('languageProjectsSection');
  if (p) p.style.display = show ? 'block' : 'none';
}

function showTextGenresSection(show) {
  const p = byId('textGenresSection');
  if (p) p.style.display = show ? 'block' : 'none';
}

function showDocumentPartsSection(show) {
  const p = byId('documentPartsSection');
  if (p) p.style.display = show ? 'block' : 'none';
}
