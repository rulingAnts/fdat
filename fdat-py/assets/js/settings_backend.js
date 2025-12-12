// Backend-only settings cache via pywebview
let settingsCache = {};
let settingsSaveTimeout = null;
let settingsInitialized = false;

function ensureSettingsIndicator(){
  let el = document.getElementById('settingsStatus');
  if (!el){
    el = document.createElement('span');
    el.id = 'settingsStatus';
    el.className = 'small-muted';
    el.style.marginLeft = '8px';
    const header = document.querySelector('.controls-row');
    if (header){ header.appendChild(el); }
    else {
      const h = document.querySelector('header div');
      if (h) h.appendChild(el);
    }
  }
  return el;
}

async function initSettings() {
  if (settingsInitialized) return;
  const indicator = ensureSettingsIndicator();
  if (!(window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_settings === 'function')){
    console.error('[Settings] pywebview API not ready');
    if (indicator){ indicator.textContent = 'Settings: backend not ready'; indicator.style.color = '#d32f2f'; }
    return;
  }
  console.log('[Settings] Initializing persistent settings');
  try {
    settingsCache = await window.pywebview.api.get_settings();
    settingsCache = settingsCache && typeof settingsCache === 'object' ? settingsCache : {};
    console.log('[Settings] Loaded settings:', Object.keys(settingsCache).length, 'keys');
    settingsInitialized = true;
    if (indicator){ indicator.textContent = 'Settings: loaded'; indicator.style.color = 'var(--muted)'; }
    if (window.pywebview.api && typeof window.pywebview.api.log === 'function'){
      try{ window.pywebview.api.log('[Settings] Loaded ' + Object.keys(settingsCache).length + ' keys'); }catch(_){ }
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
    settingsCache = {};
    settingsInitialized = true;
    if (indicator){ indicator.textContent = 'Settings: load error'; indicator.style.color = '#d32f2f'; }
    if (window.pywebview.api && typeof window.pywebview.api.log === 'function'){
      try{ window.pywebview.api.log('[Settings] Load error: ' + (e?.message||String(e))); }catch(_){ }
    }
  }
}

async function persistSettings() {
  if (window.pywebview && window.pywebview.api && settingsCache) {
    try {
      console.log('[Settings] Saving settings:', Object.keys(settingsCache).length, 'keys');
      await window.pywebview.api.save_settings(settingsCache);
      const indicator = ensureSettingsIndicator();
      if (indicator){ indicator.textContent = 'Settings: saved'; indicator.style.color = 'var(--muted)'; }
      if (window.pywebview.api && typeof window.pywebview.api.log === 'function'){
        try{ window.pywebview.api.log('[Settings] Saved'); }catch(_){ }
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
      const indicator = ensureSettingsIndicator();
      if (indicator){ indicator.textContent = 'Settings: save error'; indicator.style.color = '#d32f2f'; }
      if (window.pywebview.api && typeof window.pywebview.api.log === 'function'){
        try{ window.pywebview.api.log('[Settings] Save error: ' + (e?.message||String(e))); }catch(_){ }
      }
    }
  }
}

function saveJSON(key, obj) {
  settingsCache[key] = obj;
  clearTimeout(settingsSaveTimeout);
  settingsSaveTimeout = setTimeout(() => persistSettings(), 500);
}

function loadJSON(key) {
  try {
    return settingsCache[key] || null;
  } catch(e) {
    return null;
  }
}

// Initialize settings once pywebview is ready
(async () => {
  let attempts = 0;
  while (!settingsInitialized && attempts < 100) {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_settings === 'function') {
      await initSettings();
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  if (!settingsInitialized) {
    console.error('[Settings] Backend API not detected after', attempts * 100, 'ms');
    const indicator = ensureSettingsIndicator();
    if (indicator){ indicator.textContent = 'Settings: backend not ready'; indicator.style.color = '#d32f2f'; }
  }
})();

// Save settings before closing
window.addEventListener('beforeunload', () => {
  if (settingsSaveTimeout) {
    clearTimeout(settingsSaveTimeout);
  }
  if (settingsCache && window.pywebview && window.pywebview.api) {
    try {
      window.pywebview.api.save_settings(settingsCache);
    } catch(e) {
      console.error('Failed to save settings on close:', e);
    }
  }
});
