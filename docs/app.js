/* FDAT — Flex DiscourseChart Analysis Tool: application script.
 *
 * Loaded by index.html as a classic script; everything here runs in the page's
 * global scope. Sections, in order:
 *   1. PWA plumbing (service worker registration, install prompts)
 *   2. Helpers, storage keys and the hierarchical settings store
 *   3. Input handling and rendering (XML -> XSLT -> chart table)
 *   4. Per-panel controls (prologue, abbreviations, markers, notes, free
 *      translations, salience bands, custom columns)
 *   5. Standalone HTML export
 *   6. Hierarchical settings UI (language / genre / document)
 *
 * Rendering is DOM-driven: the XSL produces the table once and every setting is
 * applied as a post-transform DOM augmentation, so settings changes never
 * re-run the XSLT unless they change XSL parameters (notes mode / width).
 */
// Register Service Worker for PWA offline + updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Show first-run overlay if SW hasn't taken control yet
    try {
      const overlay = document.getElementById('firstRunOverlay');
      const showOverlay = () => { if (overlay) { overlay.style.display = 'flex'; } };
      const hideOverlay = () => { if (overlay) { overlay.style.display = 'none'; } };
      const hasController = !!navigator.serviceWorker.controller;
      // If no controller, likely first run. Show overlay until SW precache completes or a timeout.
      if (!hasController) {
        showOverlay();
        // Safety timeout in case of network issues (still lets user interact)
        setTimeout(hideOverlay, 15000);
        navigator.serviceWorker.addEventListener('controllerchange', hideOverlay);
        navigator.serviceWorker.addEventListener('message', (evt) => {
          const data = evt.data || {};
          if (data && data.type === 'PRECACHE_DONE') hideOverlay();
        });
      }
    } catch (_) {}
    function showUpdateToast(onReload){
      const t = document.createElement('div');
      t.style.position = 'fixed'; t.style.bottom = '16px'; t.style.left = '50%'; t.style.transform = 'translateX(-50%)';
      t.style.background = '#111'; t.style.color = '#fff'; t.style.padding = '8px 12px'; t.style.borderRadius = '999px'; t.style.boxShadow = '0 6px 22px rgba(0,0,0,0.35)';
      t.style.zIndex = '100000'; t.style.display = 'flex'; t.style.alignItems = 'center'; t.style.gap = '10px';
      t.textContent = 'Update available';
      const btn = document.createElement('button'); btn.textContent = 'Reload'; btn.style.background = '#0b6edb'; btn.style.color = '#fff'; btn.style.border = 'none'; btn.style.padding = '6px 10px'; btn.style.borderRadius = '999px'; btn.style.cursor = 'pointer';
      btn.addEventListener('click', ()=>{ onReload && onReload(); document.body.removeChild(t); });
      t.appendChild(btn); document.body.appendChild(t);
    }
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // If there is a waiting worker (already installed but not active), offer to reload now
      if (reg.waiting) {
        showUpdateToast(() => {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.waiting.addEventListener('statechange', () => { if (reg.waiting.state === 'activated') location.reload(); });
        });
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(() => {
              if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                reg.waiting.addEventListener('statechange', () => { if (reg.waiting.state === 'activated') location.reload(); });
              } else {
                location.reload();
              }
            });
          }
        });
      });
    }).catch(console.warn);
  });
}

// ===== PWA Install (tablet-only if possible) =====
(function(){
  const installBtn = document.getElementById('pwaInstallBtn');
  const banner = document.getElementById('installBanner');
  const installNow = document.getElementById('installNow');
  const installDismiss = document.getElementById('installDismiss');
  let deferredPrompt = null;

  function isStandalone(){
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }
  function isiOS(){
    const ua = window.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  }
  function isAndroid(){
    return /Android/i.test(window.navigator.userAgent || '');
  }
  function isTablet(){
    const w = Math.max(window.screen?.width || 0, window.innerWidth || 0);
    const h = Math.max(window.screen?.height || 0, window.innerHeight || 0);
    const minDim = Math.min(w, h);
    const touch = (navigator.maxTouchPoints || 0) > 0;
    // Heuristic: touch device and at least 768px on the short side
    return touch && minDim >= 768;
  }

  // iPad: show an instruction banner (no beforeinstallprompt on Safari)
  function showIOSInstallHint(){
    if(!isiOS() || !isTablet() || isStandalone()) return;
    const b = document.createElement('div');
    b.style.position='fixed'; b.style.bottom='16px'; b.style.left='50%'; b.style.transform='translateX(-50%)';
    b.style.background='#111'; b.style.color='#fff'; b.style.padding='10px 12px'; b.style.borderRadius='12px'; b.style.boxShadow='0 6px 22px rgba(0,0,0,0.35)'; b.style.zIndex='100000'; b.style.maxWidth='90vw';
    b.innerHTML = 'To install FDAT: tap the Share icon <span aria-hidden="true">▵</span> and choose <strong>Add to Home Screen</strong>.';
    const close = document.createElement('button'); close.textContent='✕'; close.style.marginLeft='10px'; close.style.background='transparent'; close.style.color='#fff'; close.style.border='none'; close.style.cursor='pointer'; close.style.fontSize='1rem';
    close.addEventListener('click', ()=> document.body.removeChild(b));
    b.appendChild(close); document.body.appendChild(b);
  }

  window.addEventListener('beforeinstallprompt', (e)=>{
    // Android/Chromium: intercept and show our button when tablet heuristics pass
    e.preventDefault();
    deferredPrompt = e;
    const dismissed = localStorage.getItem('fdat_install_banner_dismissed') === '1';
    const shouldShow = !isStandalone() && isTablet() && isAndroid() && !dismissed;
    if(installBtn){ installBtn.style.display = shouldShow ? 'inline-flex' : 'none'; }
    if(banner){ banner.style.display = shouldShow ? 'block' : 'none'; }
  });

  if(installBtn){
    installBtn.addEventListener('click', async ()=>{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      try{ await deferredPrompt.userChoice; }catch(_){/* ignore */}
      deferredPrompt = null; installBtn.style.display='none';
      if(banner) banner.style.display='none';
    });
  }

  if(installNow){
    installNow.addEventListener('click', async ()=>{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      try{ await deferredPrompt.userChoice; }catch(_){/* ignore */}
      deferredPrompt = null; if(installBtn) installBtn.style.display='none'; if(banner) banner.style.display='none';
    });
  }
  if(installDismiss){
    installDismiss.addEventListener('click', ()=>{
      localStorage.setItem('fdat_install_banner_dismissed','1');
      if(banner) banner.style.display='none';
    });
  }

  // On load, show iPad hint if applicable
  window.addEventListener('load', showIOSInstallHint);
})();

// ===== PWA run/install detection =====
(function(){
  try{
    const LS_KEY = 'fdat_pwa_run_state_v1';
    function load(){ try{ const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : {}; } catch(_) { return {}; } }
    function save(obj){ try{ localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch(_) {}
    }
    function isStandalone(){
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || (window.navigator.standalone === true);
    }
    const nowIso = new Date().toISOString();
    const state = load();
    if(!state.firstSeen){ state.firstSeen = nowIso; }
    state.lastSeen = nowIso;
    state.isStandalone = isStandalone();
    // Persist and expose a simple status for tooling (e.g., dev:android_pwa)
    save(state);
    window.FDAT_PWA_STATUS = {
      ...state,
      // convenient booleans
      firstRun: state.firstSeen === state.lastSeen,
      installed: state.isStandalone === true
    };
    // Log once per session for visibility during testing
    if(!sessionStorage.getItem('fdat_pwa_status_logged')){
      console.log('[FDAT] PWA status:', window.FDAT_PWA_STATUS);
      sessionStorage.setItem('fdat_pwa_status_logged','1');
    }
    // When the PWA is installed from browser, mark state immediately
    window.addEventListener('appinstalled', ()=>{
      const s = load(); s.isStandalone = true; save(s);
      console.log('[FDAT] PWA installed');
    });
  }catch(_){/* ignore */}
})();
/* ===== Helpers ===== */
const byId = id => document.getElementById(id);
const escapeHtml = s => String(s||'').replace(/[&<>"]/g, c=>'&' + ({'&':'amp','<':'lt','>':'gt','"':'quot'})[c] + ';');
function create(tag, attrs={}, text){
  const el = document.createElement(tag);
  for(const k in attrs){
    if(k==='cls') el.className = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if(text !== undefined && text !== null) el.textContent = text;
  return el;
}

/* ===== Persistence keys and state ===== */
// Legacy keys (for backward compatibility and migration)
const TEXTCHART_PROLOGUE_KEY = 'flex_textchart_prologue_v1';
const TEXTCHART_POSTLOGUE_KEY = 'flex_textchart_postlogue_v1';
const PRINT_HEADERS_KEY = 'flex_textchart_repeat_headers_v1';
const FREEZE_HEADERS_KEY = 'flex_textchart_freeze_headers_v1';
const ABBREV_PREFS_KEY = 'flex_textchart_abbrevs_v1';
const LISTREF_PREFS_KEY = 'flex_textchart_listrefs_v2';
const FT_PREFS_KEY = 'flex_textchart_free_trans_prefs_v1';
const SALIENCE_PREFS_KEY = 'flex_textchart_salience_bands_v1';
const CUSTOM_COLS_PREFS_KEY = 'flex_textchart_custom_cols_v1';
const ROW_GUIDS_KEY = 'flex_textchart_row_guids_v1';
const TOKEN_GUIDS_KEY = 'flex_textchart_token_guids_v1';
const NOTE_GUIDS_KEY = 'flex_textchart_note_guids_v1';
const NOTES_PREFS_KEY = 'flex_textchart_notes_prefs_v1';
const COLLAPSE_STATE_KEY = 'flex_textchart_collapse_state_v1';

// Hierarchical settings keys
const HIERARCHICAL_SETTINGS_KEY = 'fdat_hierarchical_settings_v1';
const CURRENT_CONTEXT_KEY = 'fdat_current_context_v1';

// GUID utilities
function newGuid(){
  // RFC4122-ish random GUID (not cryptographically strong, sufficient for client persistence)
  const s = () => Math.floor((1+Math.random())*0x10000).toString(16).slice(1);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8); return v.toString(16);
  });
}
function loadRowGuidMap(){ return loadJSON(ROW_GUIDS_KEY) || { byIdx:{}, byLabel:{} }; }
function saveRowGuidMap(map){ saveJSON(ROW_GUIDS_KEY, map); }
function getOrAssignRowGuid(tr){
  try{
    const idxAttr = tr.getAttribute('data-row-idx');
    const label = computeRowLabelFromRow(tr);
    const map = loadRowGuidMap();
    const idx = idxAttr ? String(idxAttr) : '';
    let guid = '';
    // Prefer existing mapping by idx; fallback to label if present
    if(idx && map.byIdx[idx]) guid = map.byIdx[idx];
    else if(label && map.byLabel[label]) guid = map.byLabel[label];
    if(!guid){ guid = newGuid(); }
    // Update both indices for robustness over time
    if(idx) map.byIdx[idx] = guid;
    if(label) map.byLabel[label] = guid;
    saveRowGuidMap(map);
    // Reflect on DOM for faster access
    tr.setAttribute('data-row-guid', guid);
    return guid;
  }catch(_){ return ''; }
}
function getRowGuidFromTr(tr){ return tr.getAttribute('data-row-guid') || getOrAssignRowGuid(tr); }
function getRowGuidByLabel(label){ const map = loadRowGuidMap(); return (map.byLabel||{})[label] || ''; }
function getRowGuidByIndex(idx){ const map = loadRowGuidMap(); return (map.byIdx||{})[String(idx)] || ''; }

// The token/note GUID registries are reserved for token-scoped custom fields
// (ROADMAP §1). They are persisted with each document but not yet wired into the UI.
// Token GUID registry: key shape `${rowIdx}:${kind}:${pos}` → guid
function loadTokenGuidMap(){ return loadJSON(TOKEN_GUIDS_KEY) || { byKey:{} }; }
function saveTokenGuidMap(map){ saveJSON(TOKEN_GUIDS_KEY, map); }
function tokenKindFromPair(pair){
  const cls = pair.className || '';
  if(/\blistRef\b/.test(cls)) return 'listRef';
  if(/\bclauseMkr\b/.test(cls)) return 'clauseMkr';
  if(/\brownum\b/.test(cls)) return 'rownum';
  if(/\bnote\b/.test(cls)) return 'note';
  if(/\bpunct-open\b/.test(cls)) return 'punctOpen';
  if(/\bpunct-close\b/.test(cls)) return 'punctClose';
  return 'token';
}
function assignTokenGuids(area){
  const tbl = area?.querySelector('table.chartshell'); if(!tbl) return;
  const map = loadTokenGuidMap(); const byKey = map.byKey || {}; let updated = false;
  const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('title1') && !r.classList.contains('title2') && !r.classList.contains('ft-inline'));
  rows.forEach(r=>{
    const rowIdx = r.getAttribute('data-row-idx') || '';
    // Walk tokens in row order
    const pairs = Array.from(r.querySelectorAll('.interlinear .pair'));
    pairs.forEach((pair, i)=>{
      const kind = tokenKindFromPair(pair);
      const key = `${rowIdx}:${kind}:${i+1}`;
      let guid = byKey[key];
      if(!guid){ guid = newGuid(); byKey[key] = guid; updated = true; }
      pair.setAttribute('data-token-guid', guid);
      pair.setAttribute('data-token-key', key);
    });
  });
  if(updated){ saveTokenGuidMap({ byKey }); }
}

// Note GUID registry: byRowGuid → noteGuid (for endnotes mode)
function loadNoteGuidMap(){ return loadJSON(NOTE_GUIDS_KEY) || { byRowGuid:{} }; }
function saveNoteGuidMap(map){ saveJSON(NOTE_GUIDS_KEY, map); }
function assignNoteGuids(area){
  const tbl = area?.querySelector('table.chartshell'); if(!tbl) return;
  const noteLinks = Array.from(tbl.querySelectorAll('a.note-link'));
  if(!noteLinks.length) return; // only in endnotes mode
  const map = loadNoteGuidMap(); const byRowGuid = map.byRowGuid || {}; let updated = false;
  noteLinks.forEach(a=>{
    const tr = a.closest('tr'); if(!tr) return;
    const rowGuid = getOrAssignRowGuid(tr); if(!rowGuid) return;
    let ng = byRowGuid[rowGuid]; if(!ng){ ng = newGuid(); byRowGuid[rowGuid] = ng; updated = true; }
    a.setAttribute('data-note-guid', ng);
    const href = a.getAttribute('href') || '';
    if(href.startsWith('#')){
      const id = href.slice(1);
      const endnote = document.getElementById(id);
      if(endnote) endnote.setAttribute('data-note-guid', ng);
    }
  });
  if(updated){ saveNoteGuidMap({ byRowGuid }); }
}

// { mode: 'tooltip'|'inline', items: { [rowLabel:string]: string }, style: { fontSize?:string, color?:string, bg?:string } }
function loadFTPrefs(){ const d = loadJSON(FT_PREFS_KEY) || {}; return { mode: d.mode || 'tooltip', items: d.items || {}, style: d.style || {} }; }
function saveFTPrefs(p){ saveJSON(FT_PREFS_KEY, p); }

let globalState = {
  chartAbbrevLabels: [],
  listRefLabels: [],
  listRefPrefs: null,
  abbrevPrefs: null,
  beforeHtml: null,
  beforeHtmlName: '',
  afterHtml: null,
  afterHtmlName: '',
  postlogueHtml: '',
  postlogueAuto: true
};

// Set whenever a legacy (flat) settings key is written; the periodic sync below
// only copies legacy keys into the hierarchical store when something changed.
let legacyDirty = false;
function saveJSON(key, obj){
  try{
    localStorage.setItem(key, JSON.stringify(obj));
    if(key !== HIERARCHICAL_SETTINGS_KEY && key !== CURRENT_CONTEXT_KEY) legacyDirty = true;
  } catch(e){}
}
function loadJSON(key){ try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch(e){ return null; } }

/* ===== Hierarchical Settings Management ===== */
/**
 * Hierarchical structure:
 * {
 *   appSettings: { ... app-level settings ... },
 *   languages: {
 *     [languageId]: {
 *       id: string,
 *       name: string,
 *       ethnologueCode: string,
 *       abbrevs: { ... abbreviations settings ... },
 *       listRefs: { ... marker display settings ... },
 *       genres: {
 *         [genreId]: {
 *           id: string,
 *           name: string,
 *           salienceBands: { ... salience band definitions ... },
 *           documents: {
 *             [documentId]: {
 *               id: string,
 *               name: string,
 *               prologue: { ... },
 *               postlogue: { ... },
 *               freeTranslations: { ... },
 *               notes: { ... },
 *               salienceAssignments: { ... row assignments ... },
 *               rowGuids: { ... },
 *               tokenGuids: { ... },
 *               noteGuids: { ... }
 *             }
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 */

function loadHierarchicalSettings(){
  const data = loadJSON(HIERARCHICAL_SETTINGS_KEY);
  if(!data || typeof data !== 'object'){
    // Initialize with default structure
    return {
      appSettings: {
        printHeaders: false,
        freezeHeaders: false,
      },
      languages: {}
    };
  }
  return data;
}

function saveHierarchicalSettings(settings){
  saveJSON(HIERARCHICAL_SETTINGS_KEY, settings);
}

function loadCurrentContext(){
  const ctx = loadJSON(CURRENT_CONTEXT_KEY);
  if(!ctx || typeof ctx !== 'object'){
    return {
      languageId: null,
      genreId: null,
      documentId: null
    };
  }
  return ctx;
}

function saveCurrentContext(ctx){
  // Flush pending legacy-key edits into the context we are leaving before switching.
  syncLegacyToHierarchical();
  saveJSON(CURRENT_CONTEXT_KEY, ctx);
}

function ensureLanguage(settings, languageId){
  if(!settings.languages[languageId]){
    settings.languages[languageId] = {
      id: languageId,
      name: '',
      ethnologueCode: '',
      abbrevs: { include: true, position: 'top', items: [] },
      listRefs: { enforceMode: 'none', reverseOrder: false, items: [], groups: [] },
      genres: {}
    };
  }
  return settings.languages[languageId];
}

function ensureGenre(language, genreId){
  if(!language.genres[genreId]){
    language.genres[genreId] = {
      id: genreId,
      name: genreId === 'narrative' ? 'Narrative' : '',
      salienceBands: {
        enabled: true,
        showLegend: true,
        showColumn: false,
        cellOnly: false,
        opacity: 1,
        tree: []
      },
      documents: {}
    };
  }
  return language.genres[genreId];
}

function ensureDocument(genre, documentId){
  if(!genre.documents[documentId]){
    genre.documents[documentId] = {
      id: documentId,
      name: '',
      prologue: { titleTag: 'h2', titleText: '', prefaceHtml: '', prefaceAuto: true },
      postlogue: { html: '', auto: true },
      freeTranslations: { mode: 'tooltip', items: {}, style: {} },
      notes: { mode: 'inline', width: '' },
      salienceAssignments: {},
      rowGuids: { byIdx: {}, byLabel: {} },
      tokenGuids: { byKey: {} },
      noteGuids: { byRowGuid: {} },
      customColumns: { cols: [], cells: {} },
      beforeHtml: null,
      beforeHtmlName: '',
      afterHtml: null,
      afterHtmlName: ''
    };
  }
  return genre.documents[documentId];
}

function getCurrentLanguage(){
  const ctx = loadCurrentContext();
  if(!ctx.languageId) return null;
  const settings = loadHierarchicalSettings();
  return settings.languages[ctx.languageId] || null;
}

function getCurrentGenre(){
  const lang = getCurrentLanguage();
  if(!lang) return null;
  const ctx = loadCurrentContext();
  if(!ctx.genreId) return null;
  return lang.genres[ctx.genreId] || null;
}

function getCurrentDocument(){
  const genre = getCurrentGenre();
  if(!genre) return null;
  const ctx = loadCurrentContext();
  if(!ctx.documentId) return null;
  return genre.documents[ctx.documentId] || null;
}

function setCurrentContext(languageId, genreId, documentId){
  const ctx = { languageId, genreId, documentId };
  saveCurrentContext(ctx);
  // Update all dependent settings
  refreshAllSettingsFromContext();
}

function refreshAllSettingsFromContext(){
  // Copy the selected hierarchical scope into the legacy (flat) keys the panels read.
  // Keys the selected scope does not carry are removed, so a previous document's
  // data cannot leak into the new one through syncLegacyToHierarchical().
  const settings = loadHierarchicalSettings();
  const ctx = loadCurrentContext();
  const put = (key, value)=>{
    if(value) saveJSON(key, value);
    else { try{ localStorage.removeItem(key); }catch(_){ /* ignore */ } }
  };
  const lang = ctx.languageId ? settings.languages[ctx.languageId] : null;
  if(lang){
    put(ABBREV_PREFS_KEY, lang.abbrevs);
    put(LISTREF_PREFS_KEY, lang.listRefs);
    const genre = ctx.genreId ? lang.genres[ctx.genreId] : null;
    if(genre){
      put(SALIENCE_PREFS_KEY, genre.salienceBands);
      const doc = ctx.documentId ? genre.documents[ctx.documentId] : null;
      if(doc){
        put(TEXTCHART_PROLOGUE_KEY, doc.prologue);
        put(TEXTCHART_POSTLOGUE_KEY, doc.postlogue);
        put(FT_PREFS_KEY, doc.freeTranslations);
        put(NOTES_PREFS_KEY, doc.notes);
        put(ROW_GUIDS_KEY, doc.rowGuids);
        put(TOKEN_GUIDS_KEY, doc.tokenGuids);
        put(NOTE_GUIDS_KEY, doc.noteGuids);
        put(CUSTOM_COLS_PREFS_KEY, doc.customColumns);
      }
    }
  }
  // App-level settings
  if(settings.appSettings){
    if(typeof settings.appSettings.printHeaders !== 'undefined'){
      saveJSON(PRINT_HEADERS_KEY, { enabled: settings.appSettings.printHeaders });
    }
    if(typeof settings.appSettings.freezeHeaders !== 'undefined'){
      saveJSON(FREEZE_HEADERS_KEY, { enabled: settings.appSettings.freezeHeaders });
    }
  }
}

function syncLegacyToHierarchical(){
  // Sync changes from legacy storage back to hierarchical storage
  const settings = loadHierarchicalSettings();
  const ctx = loadCurrentContext();
  
  if(!ctx.languageId) return;
  
  const lang = settings.languages[ctx.languageId];
  if(!lang) return;
  
  // Sync language-level settings from legacy storage
  const abbrevs = loadJSON(ABBREV_PREFS_KEY);
  if(abbrevs) lang.abbrevs = abbrevs;
  
  const listRefs = loadJSON(LISTREF_PREFS_KEY);
  if(listRefs) lang.listRefs = listRefs;
  
  if(ctx.genreId && lang.genres[ctx.genreId]){
    const genre = lang.genres[ctx.genreId];
    
    // Sync genre-level settings
    const salience = loadJSON(SALIENCE_PREFS_KEY);
    if(salience) genre.salienceBands = salience;
    
    if(ctx.documentId && genre.documents[ctx.documentId]){
      const doc = genre.documents[ctx.documentId];
      
      // Sync document-level settings
      const prologue = loadJSON(TEXTCHART_PROLOGUE_KEY);
      if(prologue) doc.prologue = prologue;
      
      const postlogue = loadJSON(TEXTCHART_POSTLOGUE_KEY);
      if(postlogue) doc.postlogue = postlogue;
      
      const ft = loadJSON(FT_PREFS_KEY);
      if(ft) doc.freeTranslations = ft;
      
      const notes = loadJSON(NOTES_PREFS_KEY);
      if(notes) doc.notes = notes;
      
      const rowGuids = loadJSON(ROW_GUIDS_KEY);
      if(rowGuids) doc.rowGuids = rowGuids;
      
      const tokenGuids = loadJSON(TOKEN_GUIDS_KEY);
      if(tokenGuids) doc.tokenGuids = tokenGuids;
      
      const noteGuids = loadJSON(NOTE_GUIDS_KEY);
      if(noteGuids) doc.noteGuids = noteGuids;
      const customCols = loadJSON(CUSTOM_COLS_PREFS_KEY);
      if(customCols) doc.customColumns = customCols;
    }
  }
  
  // App-level settings
  const printHeaders = loadJSON(PRINT_HEADERS_KEY);
  if(printHeaders && typeof printHeaders.enabled !== 'undefined'){
    settings.appSettings.printHeaders = printHeaders.enabled;
  }
  
  const freezeHeaders = loadJSON(FREEZE_HEADERS_KEY);
  if(freezeHeaders && typeof freezeHeaders.enabled !== 'undefined'){
    settings.appSettings.freezeHeaders = freezeHeaders.enabled;
  }
  
  saveHierarchicalSettings(settings);
}

function migrateToHierarchical(){
  // Check if already migrated
  const existing = loadJSON(HIERARCHICAL_SETTINGS_KEY);
  if(existing && existing.migrated) return;
  
  const settings = loadHierarchicalSettings();
  
  // Create a default language from existing settings
  const defaultLangId = 'default';
  const lang = ensureLanguage(settings, defaultLangId);
  lang.name = 'Default Language';
  
  // Migrate language-level settings
  const abbrevs = loadJSON(ABBREV_PREFS_KEY);
  if(abbrevs) lang.abbrevs = abbrevs;
  
  const listRefs = loadJSON(LISTREF_PREFS_KEY);
  if(listRefs) lang.listRefs = listRefs;
  
  // Create default genre
  const defaultGenreId = 'narrative';
  const genre = ensureGenre(lang, defaultGenreId);
  
  // Migrate genre-level settings
  const salience = loadJSON(SALIENCE_PREFS_KEY);
  if(salience) genre.salienceBands = salience;
  
  // Create default document
  const defaultDocId = 'default';
  const doc = ensureDocument(genre, defaultDocId);
  doc.name = 'Current Document';
  
  // Migrate document-level settings
  const prologue = loadJSON(TEXTCHART_PROLOGUE_KEY);
  if(prologue) doc.prologue = prologue;
  
  const postlogue = loadJSON(TEXTCHART_POSTLOGUE_KEY);
  if(postlogue) doc.postlogue = postlogue;
  
  const ft = loadJSON(FT_PREFS_KEY);
  if(ft) doc.freeTranslations = ft;
  
  const notes = loadJSON(NOTES_PREFS_KEY);
  if(notes) doc.notes = notes;
  
  const rowGuids = loadJSON(ROW_GUIDS_KEY);
  if(rowGuids) doc.rowGuids = rowGuids;
  
  const tokenGuids = loadJSON(TOKEN_GUIDS_KEY);
  if(tokenGuids) doc.tokenGuids = tokenGuids;
  
  const noteGuids = loadJSON(NOTE_GUIDS_KEY);
  if(noteGuids) doc.noteGuids = noteGuids;
  const customCols = loadJSON(CUSTOM_COLS_PREFS_KEY);
  if(customCols) doc.customColumns = customCols;
  
  // App-level settings
  const printHeaders = loadJSON(PRINT_HEADERS_KEY);
  if(printHeaders && typeof printHeaders.enabled !== 'undefined'){
    settings.appSettings.printHeaders = printHeaders.enabled;
  }
  
  const freezeHeaders = loadJSON(FREEZE_HEADERS_KEY);
  if(freezeHeaders && typeof freezeHeaders.enabled !== 'undefined'){
    settings.appSettings.freezeHeaders = freezeHeaders.enabled;
  }
  
  settings.migrated = true;
  saveHierarchicalSettings(settings);
  
  // Set current context to the default
  setCurrentContext(defaultLangId, defaultGenreId, defaultDocId);
}

/* ===== File & UI wiring ===== */
// Put XML text into the input buffer. Used by the file picker and by hosts
// (e.g. a desktop shell) that obtain chart XML some other way.
function loadXmlText(text, sourceName){
  byId('xmlInput').value = text || '';
  const msg = byId('fileLoadedMsg');
  if(msg) msg.textContent = sourceName ? ('✓ ' + sourceName) : '';
}
byId('fileInput').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  byId('fileLoadedMsg').textContent = '';
  const reader = new FileReader();
  reader.onload = evt => {
    const text = evt.target.result;
    if(!text || !text.trim()){ alert('File appears to be empty or could not be read. Please check that the file was exported correctly from FLEx.'); return; }
    loadXmlText(text, f.name);
  };
  reader.onerror = () => { alert('Could not read the file. Please try again or paste the XML directly.'); };
  reader.readAsText(f);
});

byId('resetBtn').addEventListener('click', ()=>{
  byId('xmlInput').value = '';
  byId('fileInput').value = '';
  byId('fileLoadedMsg').textContent = '';
  byId('renderArea').innerHTML = '<div class="small-muted">Paste or upload an XML file, then click Preview.</div>';
  // Hide optional chart prologue controls when no chart is displayed
  showProloguePanel(false);
});

function collapseAboutPanel(){
  // Collapse About panel on preview (non-persistent when data-no-persist=1)
  const aboutPanel = byId('aboutPanel'); const aboutHeader = byId('aboutHeader');
  if(!aboutPanel || !aboutHeader || aboutPanel.getAttribute('data-collapsed') === '1') return;
  aboutPanel.setAttribute('data-collapsed','1');
  const chev = aboutHeader.querySelector('.chev'); if(chev) chev.textContent = '▸';
  aboutHeader.setAttribute('aria-expanded','false');
  if(aboutPanel.getAttribute('data-no-persist') !== '1'){
    const state = loadCollapseState(); state['aboutPanel'] = true; saveCollapseState(state);
  }
}

// Parse the current XML buffer and render it. Resolves to true on success.
async function previewCurrentXml(){
  const xmlText = byId('xmlInput').value.trim();
  if(!xmlText){ alert('Please paste or upload an XML document first.'); return false; }
  try {
    const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if(xmlDoc.querySelector('parsererror')) throw new Error('XML parse error');
    collapseAboutPanel();
    await renderDocument(xmlDoc);
    return true;
  } catch(err){
    alert('Error parsing XML: ' + err.message);
    return false;
  }
}
byId('transformBtn').addEventListener('click', ()=> previewCurrentXml());

// Export Discourse Chart: open exported chart in a new window with toolbar
byId('exportChartBtn').addEventListener('click', ()=>{
  const html = buildStandaloneHTML({ includeToolbar: true });
  const w = window.open('', '_blank');
  if(!w) {
    alert('Export window blocked. Please allow popups for this app.');
    return;
  }
  w.document.write(html);
  w.document.close();
});

function getExportTitleFromPrologue(){
  let exportTitle = 'FDAT Discourse Chart';
  const render = byId('renderArea');
  if(!render) return exportTitle;
  const prologueNode = render.querySelector(':scope > .chart-prologue');
  if (prologueNode) {
    const h1 = prologueNode.querySelector('h1');
    const anyHead = prologueNode.querySelector('h1,h2,h3,h4,h5,h6,div,p');
    const titleNode = h1 || anyHead;
    if (titleNode && titleNode.textContent) {
      const t = titleNode.textContent.replace(/\s+/g, ' ').trim();
      if (t) exportTitle = t;
    }
  }
  return exportTitle;
}

// Export / Import Settings (localStorage backup)
function collectAllSettings(){
  // First sync legacy to hierarchical
  syncLegacyToHierarchical();
  
  const keys = [
    TEXTCHART_PROLOGUE_KEY,
    TEXTCHART_POSTLOGUE_KEY,
    PRINT_HEADERS_KEY,
    FREEZE_HEADERS_KEY,
    ABBREV_PREFS_KEY,
    LISTREF_PREFS_KEY,
    FT_PREFS_KEY,
    SALIENCE_PREFS_KEY,
    CUSTOM_COLS_PREFS_KEY,
    NOTES_PREFS_KEY,
    ROW_GUIDS_KEY,
    TOKEN_GUIDS_KEY,
    NOTE_GUIDS_KEY,
    COLLAPSE_STATE_KEY,
    HIERARCHICAL_SETTINGS_KEY,
    CURRENT_CONTEXT_KEY
  ];
  const out = {};
  keys.forEach(k=>{ try{ const v = localStorage.getItem(k); if(v !== null) out[k] = JSON.parse(v); } catch(_){ /* ignore parse errors */ } });
  return out;
}
function importAllSettings(obj){
  if(!obj || typeof obj !== 'object') throw new Error('Invalid settings file');
  Object.keys(obj).forEach(k=>{ try{ localStorage.setItem(k, JSON.stringify(obj[k])); } catch(_){ /* ignore */ } });
}
function downloadJSON(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
const exportBtn = byId('exportSettingsBtn');
const importBtn = byId('importSettingsBtn');
const importInput = byId('settingsImportInput');
if(exportBtn){ exportBtn.addEventListener('click', ()=>{
  const data = collectAllSettings();
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  downloadJSON(`fdat-settings-${ts}.json`, { __meta:{ app:'fdat', version:1, exportedAt: new Date().toISOString() }, data });
}); }
if(importBtn && importInput){
  importBtn.addEventListener('click', ()=> importInput.click());
  importInput.addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    try{
      const txt = await f.text();
      const json = JSON.parse(txt);
      const payload = json && (json.data || json);
      importAllSettings(payload);
      alert('Settings imported. Reloading to apply…');
      location.reload();
    }catch(err){ alert('Failed to import settings: ' + (err?.message || String(err))); }
  });
}

/* ===== Print header repetition (Text Chart only) ===== */
function setPrintHeadersEnabled(enabled){
  const STYLE_ID = 'textchart-print-headers-style';
  let el = document.getElementById(STYLE_ID);
  if(enabled){
    // With thead emitted by XSL, most browsers repeat header automatically. Add guard CSS for reliability.
    const css = `@media print {\n  thead { display: table-header-group !important; }\n}`;
    if(!el){ el = document.createElement('style'); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = css;
  } else {
    if(el) el.remove();
  }
}
function initRepeatHeadersControl(){
  const box = byId('repeatHeaders');
  if(!box) return;
  const saved = loadJSON(PRINT_HEADERS_KEY);
  const enabled = !!(saved && saved.enabled);
  box.checked = enabled;
  setPrintHeadersEnabled(enabled);
  if(box.dataset.wired === '1') return;
  box.dataset.wired = '1';
  box.addEventListener('change', ()=>{
    const val = !!box.checked;
    setPrintHeadersEnabled(val);
    saveJSON(PRINT_HEADERS_KEY, { enabled: val });
  });
}
// Initialize once
initRepeatHeadersControl();

/* ===== Freeze headers (sticky title rows) ===== */
function setFreezeHeadersEnabled(enabled){
  const area = byId('renderArea');
  const tbl = area?.querySelector('table.chartshell');
  if(!tbl) return;
  const wrapper = tbl.closest('.chartshell-wrapper') || tbl.parentElement;
  if(enabled){
    tbl.classList.add('freeze-headers');
    // Ensure we have a spacer element right before the table to offset layout when headers stick
    let spacer = wrapper?.querySelector(':scope > .chartshell-sticky-spacer');
    if(!spacer){
      spacer = document.createElement('div');
      spacer.className = 'chartshell-sticky-spacer';
      if(wrapper) wrapper.insertBefore(spacer, tbl);
      else tbl.parentElement?.insertBefore(spacer, tbl);
    }
    computeStickyOffsets();
  } else {
    tbl.classList.remove('freeze-headers');
    const spacer = wrapper?.querySelector(':scope > .chartshell-sticky-spacer');
    if(spacer) spacer.remove();
    document.documentElement.style.removeProperty('--tc-sticky-top-1');
    document.documentElement.style.removeProperty('--tc-sticky-top-2');
    document.documentElement.style.removeProperty('--tc-sticky-spacer');
  }
}
function computeStickyOffsets(){
  const area = byId('renderArea');
  const tbl = area?.querySelector('table.chartshell');
  if(!tbl) return;
  const head = tbl.querySelector('thead');
  const r1 = head?.querySelector('tr.row.title1');
  const r2 = head?.querySelector('tr.row.title2');
  const rect1 = r1?.getBoundingClientRect();
  const rect2 = r2?.getBoundingClientRect();
  // Account for any fixed UI at the top (none by default). We can also consider header height.
  const topBase = 0;
  const h1 = rect1 ? Math.ceil(rect1.height) : 0;
  const h2 = rect2 ? Math.ceil(rect2.height) : 0;
  document.documentElement.style.setProperty('--tc-sticky-top-1', topBase + 'px');
  document.documentElement.style.setProperty('--tc-sticky-top-2', (topBase + h1) + 'px');
  document.documentElement.style.setProperty('--tc-sticky-spacer', (h1 + h2) + 'px');
}
// Header heights can change with the viewport; keep sticky offsets in step.
window.addEventListener('resize', ()=>{
  if(byId('renderArea')?.querySelector('table.chartshell.freeze-headers')) computeStickyOffsets();
});
function initFreezeHeadersControl(){
  const box = byId('freezeHeaders');
  if(!box) return;
  const saved = loadJSON(FREEZE_HEADERS_KEY);
  box.checked = !!(saved && saved.enabled);
  if(box.dataset.wired === '1') return;
  box.dataset.wired = '1';
  // Only applied after a chart is rendered; this function may run before the table exists
  box.addEventListener('change', ()=>{
    const val = !!box.checked; saveJSON(FREEZE_HEADERS_KEY, { enabled: val }); setFreezeHeadersEnabled(val);
  });
}

/* ===== Collapsible panels (Text Chart settings) ===== */
function loadCollapseState(){ return loadJSON(COLLAPSE_STATE_KEY) || {}; }
function saveCollapseState(s){ saveJSON(COLLAPSE_STATE_KEY, s); }
function wireCollapsible(panelId, headerId){
  const panel = byId(panelId); const header = byId(headerId);
  if(!panel || !header || header.dataset.wired === '1') return;
  header.dataset.wired = '1';
  const key = panelId;
  const noPersist = panel.getAttribute('data-no-persist') === '1';
  // default collapsed is taken from data-collapsed attribute if present; else default to true
  const defaultCollapsed = panel.hasAttribute('data-collapsed') ? (panel.getAttribute('data-collapsed') === '1') : true;
  const saved = loadCollapseState()[key];
  const collapsed = noPersist ? defaultCollapsed : (saved !== undefined ? !!saved : defaultCollapsed);
  panel.setAttribute('data-collapsed', collapsed ? '1' : '0');
  const chev = header.querySelector('.chev'); if(chev) chev.textContent = collapsed ? '▸' : '▾';
  header.setAttribute('role','button'); header.setAttribute('tabindex','0'); header.setAttribute('aria-expanded', (!collapsed).toString());
  function toggle(){
    const isCollapsed = panel.getAttribute('data-collapsed') === '1';
    panel.setAttribute('data-collapsed', isCollapsed ? '0' : '1');
    if(chev) chev.textContent = isCollapsed ? '▾' : '▸';
    header.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
    if(!noPersist){ const state = loadCollapseState(); state[key] = !isCollapsed; saveCollapseState(state); }
  }
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); } });
}

// Convert plain text to simple HTML when auto-convert is on and the text does not
// already look like HTML: blank lines separate paragraphs, single newlines become <br>.
function plainTextToHtml(text, autoConvert){
  const content = text || '';
  const appearsHtml = /<\s*[a-zA-Z!/]/.test(content);
  if(!autoConvert || appearsHtml) return content;
  const norm = content.replace(/\r\n?/g, '\n');
  const paras = norm.split(/\n{2,}/).map(s=> s.trim()).filter(Boolean);
  return paras.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`).join('\n');
}
// Map Enter to a paragraph break and Shift+Enter to a single line break inside a textarea.
function wireEnterAsParagraph(ta, onChange){
  ta.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const insertText = e.shiftKey ? '\n' : '\n\n';
    const start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
    ta.value = val.slice(0, start) + insertText + val.slice(end);
    ta.selectionStart = ta.selectionEnd = start + insertText.length;
    onChange();
  });
}

/* ===== Prologue (title + preface HTML) controls wiring ===== */
function loadProloguePrefs(){
  const d = loadJSON(TEXTCHART_PROLOGUE_KEY) || {};
  return {
    tag: d.tag || 'h1',
    titleText: d.titleText || '',
    prefaceHtml: d.prefaceHtml || '', // stores raw user text or HTML
    autoConvert: typeof d.autoConvert === 'boolean' ? d.autoConvert : true
  };
}
function saveProloguePrefs(p){ saveJSON(TEXTCHART_PROLOGUE_KEY, p); }
function initPrologueControls(){
  const panel = byId('prologuePanel');
  const tagSel = byId('titleTag');
  const titleIn = byId('titleText');
  const preTA = byId('prefaceHtml');
  const preAuto = byId('prefaceAuto');
  const clearTitleBtn = byId('clearTitleBtn');
  const clearPrefaceBtn = byId('clearPrefaceBtn');
  if(!panel || !tagSel || !titleIn || !preTA) return;
  const prefs = loadProloguePrefs();
  tagSel.value = prefs.tag || 'h1';
  titleIn.value = prefs.titleText || '';
  preTA.value = prefs.prefaceHtml || '';
  if(preAuto) preAuto.checked = !!prefs.autoConvert;
  const onChange = ()=>{
    const p = { tag: tagSel.value, titleText: titleIn.value, prefaceHtml: preTA.value, autoConvert: !!(preAuto && preAuto.checked) };
    saveProloguePrefs(p);
    // Live-update DOM if a text chart is displayed
    applyPrologueToRenderArea(p);
  };
  tagSel.addEventListener('change', onChange);
  titleIn.addEventListener('input', onChange);
  preTA.addEventListener('input', onChange);
  preAuto?.addEventListener('change', onChange);
  clearTitleBtn?.addEventListener('click', ()=>{ titleIn.value=''; onChange(); });
  clearPrefaceBtn?.addEventListener('click', ()=>{ preTA.value=''; onChange(); });

  wireEnterAsParagraph(preTA, onChange);
}
// Ensure controls are initialized on load
initPrologueControls();
function showProloguePanel(show){ byId('prologuePanel').style.display = show ? 'block' : 'none'; }

// Collapsible panels are static markup: wire them all once at load.
[
  ['aboutPanel','aboutHeader'],
  ['languageProjectsSection','languageProjectsHeader'],
  ['textGenresSection','textGenresHeader'],
  ['documentPartsSection','documentPartsHeader'],
  ['prologuePanel','prologueHeader'],
  ['abbrevPanel','abbrevHeader'],
  ['listRefPanel','listRefHeader'],
  ['appendHtmlPanel','appendHeader'],
  ['postloguePanel','postlogueHeader'],
  ['notesPanel','notesHeader'],
  ['ftPanel','ftHeader'],
  ['saliencePanel','salienceHeader'],
  ['salienceDisplayPanel','salienceDisplayHeader'],
  ['customColsPanel','customColsHeader']
].forEach(([p, h])=> wireCollapsible(p, h));

/* ===== Postlogue controls (stored and used only for export) ===== */
function loadPostloguePrefs(){
  const d = loadJSON(TEXTCHART_POSTLOGUE_KEY) || {};
  return {
    html: d.html || '',
    autoConvert: typeof d.autoConvert === 'boolean' ? d.autoConvert : true
  };
}
function savePostloguePrefs(p){ saveJSON(TEXTCHART_POSTLOGUE_KEY, p); }
function initPostlogueControls(){
  const panel = byId('postloguePanel'); if(!panel) return;
  const ta = byId('postlogueHtml');
  const auto = byId('postlogueAuto');
  const prefs = loadPostloguePrefs();
  if(ta) ta.value = prefs.html || '';
  if(auto) auto.checked = !!prefs.autoConvert;
  const onChange = ()=>{
    const p = { html: ta?.value || '', autoConvert: !!(auto && auto.checked) };
    savePostloguePrefs(p);
    globalState.postlogueHtml = p.html; globalState.postlogueAuto = p.autoConvert;
    applyEpilogueToRenderArea(p);
  };
  ta?.addEventListener('input', onChange);
  auto?.addEventListener('change', onChange);
  if(ta) wireEnterAsParagraph(ta, onChange);
}
function showPostloguePanel(show){ const p = byId('postloguePanel'); if(p) p.style.display = show ? 'block' : 'none'; }

function applyEpilogueToRenderArea(prefs){
  const area = byId('renderArea'); if(!area) return;
  // Remove existing epilogue block
  area.querySelectorAll(':scope > .chart-epilogue').forEach(n=> n.remove());
  const { html, autoConvert } = (prefs || loadPostloguePrefs());
  if(!html || !html.trim()) return;
  const content = plainTextToHtml(html, autoConvert);
  const block = document.createElement('div'); block.className = 'chart-epilogue';
  const wrapper = document.createElement('div'); wrapper.innerHTML = content;
  Array.from(wrapper.childNodes).forEach(n => block.appendChild(n));
  // Insert epilogue at the very end of render area
  area.appendChild(block);
}
/* ===== ListRef (hide/style/order) controls ===== */
function collectListRefLabelsFromRendered(area){
  const nodes = Array.from(area.querySelectorAll('.interlinear .pair.listRef[data-listref]'));
  const set = new Set();
  nodes.forEach(n=>{ const v=(n.getAttribute('data-listref')||'').trim(); if(v && !set.has(v)) set.add(v); });
  // Preserve first-encounter order; do not alphabetize
  return Array.from(set);
}
// Derive a suggested global order based on most common contiguous listRef patterns in the source XML
function computeListRefSuggestedOrderFromXml(xmlDoc){
  try{
    const runs = [];
    const mains = Array.from(xmlDoc.querySelectorAll('chart > row > cell > main'));
    mains.forEach(m => {
      const kids = Array.from(m.children || []);
      let i = 0;
      while(i < kids.length){
        if(kids[i].nodeName === 'listRef' || kids[i].nodeName === 'listref'){
          const run = [];
          let j = i;
          while(j < kids.length && (kids[j].nodeName === 'listRef' || kids[j].nodeName === 'listref')){
            const label = (kids[j].textContent || '').trim();
            if(label) run.push(label);
            j++;
          }
          if(run.length > 1) runs.push(run);
          i = j;
        } else {
          i++;
        }
      }
    });
  const labelsSet = new Set();
  const firstSeen = {};
  runs.forEach(r => r.forEach(l => { if(!labelsSet.has(l)){ firstSeen[l] = Object.keys(firstSeen).length; labelsSet.add(l); } }));
  const labels = Array.from(labelsSet);
    if(labels.length === 0) return [];
    // Pairwise precedence counts
    const wins = {}; const losses = {};
    labels.forEach(l => { wins[l] = {}; losses[l] = {}; labels.forEach(o => { wins[l][o] = 0; losses[l][o] = 0; }); });
    runs.forEach(run => {
      for(let a=0; a<run.length; a++){
        for(let b=a+1; b<run.length; b++){
          const x = run[a], y = run[b];
          if(x === y) continue;
          wins[x][y] = (wins[x][y]||0) + 1;
          losses[y][x] = (losses[y][x]||0) + 1;
        }
      }
    });
    const score = l => {
      let w = 0, d = 0;
      Object.keys(wins[l]||{}).forEach(k => { w += wins[l][k]||0; d += losses[l][k]||0; });
      return w - d;
    };
    const suggested = labels.sort((a,b)=>{
      const sa = score(a), sb = score(b);
      if(sb !== sa) return sb - sa; // higher score first (earlier)
      // Tie-breaker: first-seen order in XML, not alphabetical
      return (firstSeen[a]||0) - (firstSeen[b]||0);
    });
    return suggested;
  }catch(_){ return []; }
}
function loadListRefPrefs(){
  const d = loadJSON(LISTREF_PREFS_KEY) || {};
  return {
    entries: d.entries || {},
    order: Array.isArray(d.order) ? d.order : [],
    enforce: typeof d.enforce === 'boolean' ? d.enforce : undefined,
    enforceMode: d.enforceMode || (typeof d.enforce === 'boolean' ? (d.enforce ? 'global' : 'none') : 'global'),
    reverse: !!d.reverse,
    groups: Array.isArray(d.groups) ? d.groups : [] // [{id,name,order:[], styles:{hidden,bold,italic,underline,fontSize,color}}]
  };
}
function saveListRefPrefs(p){ saveJSON(LISTREF_PREFS_KEY, p); }
function reconcileListRefPrefs(prefs, labels, suggestedOrder){
  const out = { entries: { ...prefs.entries }, order: Array.from(prefs.order||[]), enforceMode: ['none','groups','global'].includes(prefs.enforceMode) ? prefs.enforceMode : 'global', reverse: !!prefs.reverse, groups: Array.isArray(prefs.groups) ? prefs.groups.map(g=>({...g})) : [] };
  // Remove stale entries
  Object.keys(out.entries).forEach(k=>{ if(!labels.includes(k)) delete out.entries[k]; });
  // Helper: normalize an entry so unset values are truly undefined
  function normalizeEntry(e){ if(!e) return e; ['hidden','bold','italic','underline'].forEach(k=>{ if(e[k] === false) delete e[k]; }); if(e.fontSize === '') delete e.fontSize; if(e.color === '') delete e.color; return e; }
  Object.keys(out.entries).forEach(k=>{ out.entries[k] = normalizeEntry(out.entries[k]); });
  // Add new labels with defaults
  labels.forEach(l=>{ if(!out.entries[l]) out.entries[l] = {}; });
  // Determine base order: prefer saved order; else suggested; else alphabetical
  let base = out.order && out.order.length ? out.order.slice() : (Array.isArray(suggestedOrder) && suggestedOrder.length ? suggestedOrder.slice() : labels.slice());
  // Compact to labels set and append any missing labels
  const ordered = base.filter(x => labels.includes(x));
  labels.forEach(l=>{ if(!ordered.includes(l)) ordered.push(l); });
  out.order = ordered;
  // Remove group members that no longer exist
  out.groups.forEach(g=>{ if(Array.isArray(g.order)) g.order = g.order.filter(x=> labels.includes(x)); });
  return out;
}
function showListRefPanel(show){ const p = byId('listRefPanel'); if(p) p.style.display = show ? 'block':'none'; }
// Live state for the marker (listRef) panel. The header-level controls are wired
// once and always act on the prefs of the most recent render; the per-row controls
// are rebuilt by renderRows() on every render.
const listRefUI = { prefs: null, labels: [], suggestedOrder: [], renderRows: null };
function listRefPersist(){ globalState.listRefPrefs = listRefUI.prefs; saveListRefPrefs(listRefUI.prefs); }
function listRefRefresh(){ listRefPersist(); applyListRefPrefsToArea(); if(listRefUI.renderRows) listRefUI.renderRows(); }
function updateListRefDirButton(){
  const dirBtn = byId('listRefToggleOrder'); const prefs = listRefUI.prefs;
  if(dirBtn && prefs) dirBtn.textContent = prefs.reverse ? '(bottom → top)' : '(top → bottom)';
}
function wireListRefHeaderControls(){
  const panel = byId('listRefPanel'); if(!panel || panel.dataset.wired === '1') return;
  panel.dataset.wired = '1';
  byId('listRefEnforceMode')?.addEventListener('change', (e)=>{ listRefUI.prefs.enforceMode = e.target.value; listRefPersist(); applyListRefPrefsToArea(); });
  byId('listRefToggleOrder')?.addEventListener('click', ()=>{ listRefUI.prefs.reverse = !listRefUI.prefs.reverse; listRefPersist(); applyListRefPrefsToArea(); updateListRefDirButton(); });
  byId('listRefShowAll')?.addEventListener('click', ()=>{ Object.values(listRefUI.prefs.entries).forEach(e=> { delete e.hidden; }); listRefRefresh(); });
  byId('listRefHideAll')?.addEventListener('click', ()=>{ Object.values(listRefUI.prefs.entries).forEach(e=> { e.hidden = true; }); listRefRefresh(); });
  byId('listRefResetAllStyles')?.addEventListener('click', ()=>{
    const p = listRefUI.prefs;
    Object.values(p.entries).forEach(e=>{ delete e.bold; delete e.italic; delete e.underline; delete e.fontSize; delete e.color; });
    (p.groups||[]).forEach(g=>{ const hidden = !!(g.styles && g.styles.hidden); g.styles = hidden ? { hidden: true } : {}; });
    listRefRefresh();
  });
  byId('listRefAddGroup')?.addEventListener('click', ()=>{
    const p = listRefUI.prefs;
    const id = 'g_' + Date.now().toString(36) + '_' + Math.floor(Math.random()*1000);
    p.groups = Array.isArray(p.groups) ? p.groups : [];
    p.groups.push({ id, name: 'Group', order: [], styles: {} });
    listRefRefresh();
  });
  byId('listRefResetOrder')?.addEventListener('click', ()=>{
    // Clear the saved order and adopt the order suggested by the current chart's XML
    const p = listRefUI.prefs;
    p.order = reconcileListRefPrefs({ entries: p.entries, order: [] }, listRefUI.labels, listRefUI.suggestedOrder).order;
    listRefRefresh();
  });
}
function buildListRefControls(labels, suggestedOrder){
  const panel = byId('listRefPanel'); if(!panel) return;
  const rowsHost = byId('listRefRows');
  const groupsHost = byId('listRefGroupList');
  const prefs = reconcileListRefPrefs(loadListRefPrefs(), labels, suggestedOrder||[]);
  listRefUI.prefs = prefs;
  listRefUI.labels = labels;
  listRefUI.suggestedOrder = Array.isArray(suggestedOrder) ? suggestedOrder.slice() : [];
  listRefPersist();
  wireListRefHeaderControls();
  const enforceSel = byId('listRefEnforceMode'); if(enforceSel) enforceSel.value = prefs.enforceMode || 'global';
  updateListRefDirButton();
  function renderRows(){
    rowsHost.innerHTML='';
    const groupedIds = new Set();
    // Render groups first
    if(groupsHost){
      groupsHost.innerHTML = '';
      (prefs.groups||[]).forEach((g, gi)=>{
        const groupDiv = document.createElement('div'); groupDiv.className='lr-group';
        const header = document.createElement('div'); header.className='lr-group-header';
        const nameIn = document.createElement('input'); nameIn.type='text'; nameIn.placeholder='Group name'; nameIn.value = g.name||''; nameIn.style.padding='4px 6px'; nameIn.style.border='1px solid #e5e5e5'; nameIn.style.borderRadius='6px';
        nameIn.addEventListener('input', ()=>{ g.name = nameIn.value; persist(); });
        const upBtn = document.createElement('button'); upBtn.className='small-btn secondary'; upBtn.textContent='↑'; upBtn.title='Move group earlier';
        const dnBtn = document.createElement('button'); dnBtn.className='small-btn secondary'; dnBtn.textContent='↓'; dnBtn.title='Move group later';
        upBtn.addEventListener('click', ()=>{ moveGroup(gi,-1); }); dnBtn.addEventListener('click', ()=>{ moveGroup(gi,1); });
        // Group style controls
        const hideBtn = document.createElement('button'); hideBtn.className='small-btn'; hideBtn.title='Toggle group visibility';
  g.styles = g.styles || {};
        function setHideIcon(){ hideBtn.textContent = g.styles.hidden ? '🙈' : '👁️'; }
        setHideIcon();
  hideBtn.addEventListener('click', ()=>{ if(g.styles.hidden){ delete g.styles.hidden; } else { g.styles.hidden = true; } setHideIcon(); persist(); applyListRefPrefsToArea(); renderRows(); });
  const b = mkToggle('B', 'Bold', !!g.styles.bold, v=>{ if(v) g.styles.bold=true; else delete g.styles.bold; persist(); applyListRefPrefsToArea(); });
  const i = mkToggle('I', 'Italic', !!g.styles.italic, v=>{ if(v) g.styles.italic=true; else delete g.styles.italic; persist(); applyListRefPrefsToArea(); });
  const u = mkToggle('U', 'Underline', !!g.styles.underline, v=>{ if(v) g.styles.underline=true; else delete g.styles.underline; persist(); applyListRefPrefsToArea(); });
        const sizeIn = document.createElement('input'); sizeIn.type='number'; sizeIn.placeholder='size px'; sizeIn.min='8'; sizeIn.max='48'; sizeIn.step='1'; sizeIn.style.width='84px'; sizeIn.value = g.styles.fontSize||'';
  sizeIn.addEventListener('input', ()=>{ if(sizeIn.value) g.styles.fontSize = sizeIn.value; else delete g.styles.fontSize; persist(); applyListRefPrefsToArea(); });
  const colorIn = document.createElement('input'); colorIn.type='color'; colorIn.value = g.styles.color || '#000000'; colorIn.title = 'Text color'; colorIn.addEventListener('input', ()=>{ if(colorIn.value) g.styles.color = colorIn.value; else delete g.styles.color; persist(); applyListRefPrefsToArea(); });
        const colorWrap = document.createElement('span'); colorWrap.className='lr-chip'; colorWrap.title='Text color'; colorWrap.appendChild(colorIn);
        const sizeWrap = document.createElement('span'); sizeWrap.className='lr-chip'; sizeWrap.title='Font size (px)'; sizeWrap.appendChild(sizeIn);
        // Remove group
        const resetStyleBtn = document.createElement('button'); resetStyleBtn.className='small-btn secondary'; resetStyleBtn.textContent='Reset style'; resetStyleBtn.title='Clear visibility and styles for this group and its items';
        resetStyleBtn.addEventListener('click', ()=>{
          // Clear group styles including visibility
          g.styles = {};
          // Also clear individual styles/visibility for items in this group
          (g.order||[]).forEach(id=>{ const e=prefs.entries[id]; if(e){ delete e.hidden; delete e.bold; delete e.italic; delete e.underline; delete e.fontSize; delete e.color; } });
          persist(); applyListRefPrefsToArea(); renderRows();
        });
  const del = document.createElement('button'); del.className='small-btn secondary'; del.textContent='Remove group'; del.addEventListener('click', ()=>{ prefs.groups.splice(gi,1); persist(); renderRows(); applyListRefPrefsToArea(); });
  header.appendChild(upBtn); header.appendChild(dnBtn); header.appendChild(nameIn); header.appendChild(hideBtn); header.appendChild(b); header.appendChild(i); header.appendChild(u); header.appendChild(sizeWrap); header.appendChild(colorWrap); header.appendChild(resetStyleBtn); header.appendChild(del);
        groupDiv.appendChild(header);
        // Items: ordered rows with membership toggle, up/down, and per-item style controls
        const itemsDiv = document.createElement('div'); itemsDiv.className='lr-group-items';
        const allIds = prefs.order.filter(id=> labels.includes(id));
        g.order = Array.isArray(g.order) ? g.order.filter(id=> allIds.includes(id)) : [];
        const inGroup = new Set(g.order);
        // Membership selector to add new items into group
        const addWrap = document.createElement('div'); addWrap.style.marginBottom='6px';
        const addSelect = document.createElement('select'); addSelect.title='Add item to group';
        const defaultOpt = document.createElement('option'); defaultOpt.value=''; defaultOpt.textContent='Add item to group…'; addSelect.appendChild(defaultOpt);
        allIds.forEach(id=>{ if(inGroup.has(id)) return; const opt=document.createElement('option'); opt.value=id; opt.textContent=id; addSelect.appendChild(opt); });
        addSelect.addEventListener('change', ()=>{
          const id = addSelect.value; if(!id) return; g.order.push(id); persist(); applyListRefPrefsToArea(); renderRows(); });
        addWrap.appendChild(addSelect); itemsDiv.appendChild(addWrap);
        // Render existing members in g.order
        g.order.forEach((id, idx)=>{
          groupedIds.add(id);
          const ent = prefs.entries[id]; if(!ent) return;
          const row = document.createElement('div'); row.className='lr-row';
          const upBtn = document.createElement('button'); upBtn.className='small-btn secondary'; upBtn.textContent='↑'; upBtn.title='Move earlier';
          const dnBtn = document.createElement('button'); dnBtn.className='small-btn secondary'; dnBtn.textContent='↓'; dnBtn.title='Move later';
          upBtn.addEventListener('click', ()=>{ moveInGroup(gi, idx, -1); });
          dnBtn.addEventListener('click', ()=>{ moveInGroup(gi, idx, +1); });
          row.appendChild(upBtn); row.appendChild(dnBtn);
          const abbr = document.createElement('span'); abbr.className='lr-abbr'; abbr.textContent=id; row.appendChild(abbr);
          const styleControls = document.createElement('div'); styleControls.style.display='flex'; styleControls.style.alignItems='center'; styleControls.style.gap='8px';
          const hideBtn = document.createElement('button'); hideBtn.className='small-btn'; hideBtn.title='Toggle visibility';
          function setHideIcon(){ hideBtn.textContent = ent.hidden ? '🙈' : '👁️'; }
          setHideIcon();
          hideBtn.addEventListener('click', ()=>{ if(ent.hidden){ delete ent.hidden; } else { ent.hidden = true; } setHideIcon(); persist(); applyListRefPrefsToArea(); renderRows(); });
          styleControls.appendChild(hideBtn);
          const b = mkToggle('B', 'Bold', !!ent.bold, v=>{ if(v) ent.bold=true; else delete ent.bold; persist(); applyListRefPrefsToArea(); });
          const i = mkToggle('I', 'Italic', !!ent.italic, v=>{ if(v) ent.italic=true; else delete ent.italic; persist(); applyListRefPrefsToArea(); });
          const u = mkToggle('U', 'Underline', !!ent.underline, v=>{ if(v) ent.underline=true; else delete ent.underline; persist(); applyListRefPrefsToArea(); });
          const sizeIn = document.createElement('input'); sizeIn.type='number'; sizeIn.placeholder='size px'; sizeIn.min='8'; sizeIn.max='48'; sizeIn.step='1'; sizeIn.style.width='84px'; sizeIn.value = ent.fontSize || '';
          sizeIn.addEventListener('input', ()=>{ if(sizeIn.value) ent.fontSize = sizeIn.value; else delete ent.fontSize; persist(); applyListRefPrefsToArea(); });
          const colorIn = document.createElement('input'); colorIn.type='color'; colorIn.value = ent.color || '#000000'; colorIn.title = 'Text color'; colorIn.addEventListener('input', ()=>{ if(colorIn.value) ent.color = colorIn.value; else delete ent.color; persist(); applyListRefPrefsToArea(); });
          const sizeWrap = document.createElement('span'); sizeWrap.className='lr-chip'; sizeWrap.title='Font size (px)'; sizeWrap.appendChild(sizeIn);
          const colorWrap = document.createElement('span'); colorWrap.className='lr-chip'; colorWrap.title='Text color'; colorWrap.appendChild(colorIn);
          const resetStyleBtn = document.createElement('button'); resetStyleBtn.className='small-btn secondary'; resetStyleBtn.textContent='Reset style'; resetStyleBtn.title='Clear visibility and styles for this item';
          resetStyleBtn.addEventListener('click', ()=>{ delete ent.hidden; delete ent.bold; delete ent.italic; delete ent.underline; delete ent.fontSize; delete ent.color; persist(); applyListRefPrefsToArea(); renderRows(); });
          // Remove from group
          const removeBtn = document.createElement('button'); removeBtn.className='small-btn secondary'; removeBtn.textContent='Remove from group'; removeBtn.addEventListener('click', ()=>{ g.order.splice(idx,1); persist(); applyListRefPrefsToArea(); renderRows(); });
          styleControls.appendChild(b); styleControls.appendChild(i); styleControls.appendChild(u); styleControls.appendChild(sizeWrap); styleControls.appendChild(colorWrap); styleControls.appendChild(resetStyleBtn); styleControls.appendChild(removeBtn);
          row.appendChild(styleControls);
          itemsDiv.appendChild(row);
        });
        groupDiv.appendChild(itemsDiv);
        groupsHost.appendChild(groupDiv);
      });
    }
    // Then render ungrouped items in the main list
    prefs.order.forEach(label=>{
      if(groupedIds.has(label)) return;
      const ent = prefs.entries[label]; if(!ent) return;
      const row = document.createElement('div'); row.className = 'lr-row';
      // Up/Down before abbreviation
      const upBtn = document.createElement('button'); upBtn.className='small-btn secondary'; upBtn.textContent='↑'; upBtn.title='Move earlier';
      const dnBtn = document.createElement('button'); dnBtn.className='small-btn secondary'; dnBtn.textContent='↓'; dnBtn.title='Move later';
      upBtn.addEventListener('click', ()=>{ move(label, -1); }); dnBtn.addEventListener('click', ()=>{ move(label, +1); });
      row.appendChild(upBtn); row.appendChild(dnBtn);
      // Abbreviation next
      const abbr = document.createElement('span'); abbr.className = 'lr-abbr'; abbr.textContent = label; row.appendChild(abbr);
      const styleControls = document.createElement('div');
      styleControls.style.display='flex'; styleControls.style.alignItems='center'; styleControls.style.gap='8px';
      // Hide as first style option (eye icon)
      const hideBtn = document.createElement('button'); hideBtn.className='small-btn'; hideBtn.title='Toggle visibility';
      function setHideIcon(){ hideBtn.textContent = ent.hidden ? '🙈' : '👁️'; }
      setHideIcon();
  hideBtn.addEventListener('click', ()=>{ if(ent.hidden){ delete ent.hidden; } else { ent.hidden = true; } setHideIcon(); persist(); applyListRefPrefsToArea(); renderHiddenVisual(); renderRows(); });
      styleControls.appendChild(hideBtn);
  const b = mkToggle('B', 'Bold', !!ent.bold, v=>{ if(v) ent.bold=true; else delete ent.bold; persist(); applyListRefPrefsToArea(); });
  const i = mkToggle('I', 'Italic', !!ent.italic, v=>{ if(v) ent.italic=true; else delete ent.italic; persist(); applyListRefPrefsToArea(); });
  const u = mkToggle('U', 'Underline', !!ent.underline, v=>{ if(v) ent.underline=true; else delete ent.underline; persist(); applyListRefPrefsToArea(); });
      const sizeIn = document.createElement('input'); sizeIn.type='number'; sizeIn.placeholder='size px'; sizeIn.min='8'; sizeIn.max='48'; sizeIn.step='1';
      sizeIn.value = ent.fontSize || '';
      sizeIn.style.width='84px';
  sizeIn.addEventListener('input', ()=>{ if(sizeIn.value) ent.fontSize = sizeIn.value; else delete ent.fontSize; persist(); applyListRefPrefsToArea(); });
  const colorIn = document.createElement('input'); colorIn.type='color'; colorIn.value = ent.color || '#000000'; colorIn.title = 'Text color'; colorIn.addEventListener('input', ()=>{ if(colorIn.value) ent.color = colorIn.value; else delete ent.color; persist(); applyListRefPrefsToArea(); });
      styleControls.appendChild(b); styleControls.appendChild(i); styleControls.appendChild(u);
  const sizeWrap = document.createElement('span'); sizeWrap.className='lr-chip'; sizeWrap.title='Font size (px)'; sizeWrap.appendChild(sizeIn);
      const colorWrap = document.createElement('span'); colorWrap.className='lr-chip'; colorWrap.title='Text color'; colorWrap.appendChild(colorIn);
  const resetStyleBtn = document.createElement('button'); resetStyleBtn.className='small-btn secondary'; resetStyleBtn.textContent='Reset style'; resetStyleBtn.title='Clear visibility and styles for this item';
  resetStyleBtn.addEventListener('click', ()=>{ delete ent.hidden; delete ent.bold; delete ent.italic; delete ent.underline; delete ent.fontSize; delete ent.color; persist(); applyListRefPrefsToArea(); renderHiddenVisual(); renderRows(); });
  styleControls.appendChild(sizeWrap);
      styleControls.appendChild(colorWrap);
  styleControls.appendChild(resetStyleBtn);
      row.appendChild(styleControls);
      function renderHiddenVisual(){ if(ent.hidden) abbr.classList.add('is-hidden'); else abbr.classList.remove('is-hidden'); }
      renderHiddenVisual();
      rowsHost.appendChild(row);
    });
  }
  function mkToggle(txt, title, on, cb){ const b = document.createElement('button'); b.className='small-btn'; b.textContent=txt; b.title=title; b.style.fontWeight= on?'700':'400'; b.style.textDecoration = txt==='U' && on ? 'underline':'none'; b.style.fontStyle = txt==='I' && on ? 'italic':'normal'; b.addEventListener('click', ()=>{ const v = !(txt==='B'? (b.style.fontWeight==='700') : txt==='I' ? (b.style.fontStyle==='italic') : (b.style.textDecoration==='underline')); if(txt==='B') b.style.fontWeight = v?'700':'400'; if(txt==='I') b.style.fontStyle = v?'italic':'normal'; if(txt==='U') b.style.textDecoration = v?'underline':'none'; cb(v); }); return b; }
  function move(label, delta){ const idx = prefs.order.indexOf(label); const j = idx + delta; if(j<0||j>=prefs.order.length) return; const t=prefs.order[idx]; prefs.order[idx]=prefs.order[j]; prefs.order[j]=t; persist(); renderRows(); applyListRefPrefsToArea(); }
  function moveInGroup(gi, idx, delta){ const g=prefs.groups[gi]; if(!g||!Array.isArray(g.order)) return; const j = idx + delta; if(j<0||j>=g.order.length) return; const t=g.order[idx]; g.order[idx]=g.order[j]; g.order[j]=t; persist(); renderRows(); applyListRefPrefsToArea(); }
  function moveGroup(gi, delta){ const j = gi + delta; if(j<0||j>=prefs.groups.length) return; const t=prefs.groups[gi]; prefs.groups[gi]=prefs.groups[j]; prefs.groups[j]=t; persist(); renderRows(); applyListRefPrefsToArea(); }
  function persist(){ listRefPersist(); }
  listRefUI.renderRows = renderRows;
  renderRows();
  applyListRefPrefsToArea();
}
function applyListRefPrefsToArea(){
  const area = byId('renderArea'); if(!area) return;
  const prefs = globalState.listRefPrefs || loadListRefPrefs();
  // For each interlinear cell, reorder contiguous runs of listRef pairs based on prefs.order (if enforce enabled)
  const cells = Array.from(area.querySelectorAll('.interlinear'));
  cells.forEach(cell=>{
    // collect siblings and identify listRef pairs
    const pairs = Array.from(cell.querySelectorAll(':scope > .pair'));
    // Walk and process runs of listRef pairs
    let i=0; while(i < pairs.length){
      if(!pairs[i].classList.contains('listRef')){ i++; continue; }
      let j=i; const run=[]; while(j<pairs.length && pairs[j].classList.contains('listRef')){ run.push(pairs[j]); j++; }
      const mode = prefs.enforceMode || (typeof prefs.enforce === 'boolean' ? (prefs.enforce ? 'global' : 'none') : 'global');
      if(mode !== 'none'){
        // Ensure we keep original order metadata for later restoration
        run.forEach((n, idx)=>{ if(!n.hasAttribute('data-orig-index')) n.setAttribute('data-orig-index', String(idx)); });
        // sort run by prefs.order using each node's data-listref
        // If groups are defined and a token is a member of a group, rank by group order first (index of group), then within-group order, then fallback to global order (only when mode==='global')
        const groupIndexFor = (lab)=>{
          const groups = prefs.groups||[];
          for(let gi=0; gi<groups.length; gi++){
            const g = groups[gi];
            if(Array.isArray(g.order) && g.order.includes(lab)) return gi;
          }
          return Number.MAX_SAFE_INTEGER;
        };
        const inGroupPos = (lab)=>{
          const groups = prefs.groups||[];
          for(let gi=0; gi<groups.length; gi++){
            const g = groups[gi];
            if(Array.isArray(g.order)){
              const k = g.order.indexOf(lab);
              if(k !== -1) return k;
            }
          }
          return Number.MAX_SAFE_INTEGER;
        };
        const globalIndex = (lab)=>{ const k=(lab||'').trim(); const idx=prefs.order.indexOf(k); return idx===-1? Number.MAX_SAFE_INTEGER: idx; };
        // In groups-only mode, we only sort within adjacent clusters of the same group.
        run.sort((a,b)=>{
          const la = (a.getAttribute('data-listref')||'').trim();
          const lb = (b.getAttribute('data-listref')||'').trim();
          const ga = groupIndexFor(la), gb = groupIndexFor(lb);
          if(ga !== gb){
            // Different groups or one ungrouped vs grouped: don't intermix in groups-only mode, keep original order for both
            if(mode === 'groups'){
              const oa = parseInt(a.getAttribute('data-orig-index')||'0',10);
              const ob = parseInt(b.getAttribute('data-orig-index')||'0',10);
              return oa - ob;
            }
            return ga - gb;
          }
          const pa = inGroupPos(la), pb = inGroupPos(lb);
          if(pa !== pb){
            if(mode === 'groups') return pa - pb; // same group cluster: apply within-group order
            return pa - pb;
          }
          if(mode === 'groups'){
            // identical positions (likely same token or ambiguous), keep source order
            const oa = parseInt(a.getAttribute('data-orig-index')||'0',10);
            const ob = parseInt(b.getAttribute('data-orig-index')||'0',10);
            return oa - ob;
          }
          return globalIndex(la) - globalIndex(lb);
        });
        if(prefs.reverse) run.reverse();
        // reinsert in DOM in this new order
        const before = pairs[j] || null; // node after run
        run.forEach(n=> cell.insertBefore(n, before));
      } else {
        // Restore to original XML order using data-orig-index (fallback to current order if not present)
        run.forEach((n, idx)=>{ if(!n.hasAttribute('data-orig-index')) n.setAttribute('data-orig-index', String(idx)); });
        run.sort((a,b)=> (parseInt(a.getAttribute('data-orig-index')||'0',10) - parseInt(b.getAttribute('data-orig-index')||'0',10)) );
        if(prefs.reverse) run.reverse();
        const before = pairs[j] || null;
        run.forEach(n=> cell.insertBefore(n, before));
      }
      i = j; // advance
    }
  });
  // In groups-only mode, surface warnings for group members that are not adjacent within a run
  try{
    const mode = (globalState.listRefPrefs || {}).enforceMode || 'global';
    const warnHost = byId('listRefWarnings');
    if(warnHost){ warnHost.style.display='none'; warnHost.innerHTML=''; }
    if(mode === 'groups'){
      const runs = [];
      const cells2 = Array.from(area.querySelectorAll('.interlinear'));
      cells2.forEach(cell=>{
        const pairs2 = Array.from(cell.querySelectorAll(':scope > .pair'));
        let i2=0; while(i2<pairs2.length){
          if(!pairs2[i2].classList.contains('listRef')){ i2++; continue; }
          let j2=i2; const runNodes=[]; while(j2<pairs2.length && pairs2[j2].classList.contains('listRef')){ runNodes.push(pairs2[j2]); j2++; }
          // Derive row/column context
          const td = cell.closest('td,th');
          let tr = null, col = 0, rowLabel = '';
          if(td){
            tr = td.parentElement;
            const cellsInRow = Array.from(tr.children);
            col = cellsInRow.indexOf(td) + 1;
            const firstCell = cellsInRow[0];
            if(firstCell){ rowLabel = (firstCell.textContent || '').trim(); }
          }
          runs.push({ nodes: runNodes, rowLabel, col });
          i2=j2;
        }
      });
      const problems = [];
      (globalState.listRefPrefs.groups||[]).forEach(g=>{
        if(!Array.isArray(g.order) || g.order.length<2) return;
        runs.forEach(run=>{
          const present = g.order.filter(id=> run.nodes.some(n => (n.getAttribute('data-listref')||'').trim() === id));
          if(present.length >= 2){
            // Check adjacency in the run
            const indices = present.map(id => run.nodes.findIndex(n => (n.getAttribute('data-listref')||'').trim() === id)).sort((a,b)=>a-b);
            // If any consecutive desired members are separated by others, warn
            for(let k=1;k<indices.length;k++){
              if(indices[k] !== indices[k-1]+1){
                problems.push({ group: g.name || '(unnamed group)', ids: present, row: run.rowLabel || '(row)', col: run.col });
                break;
              }
            }
          }
        });
      });
      if(problems.length && warnHost){
        const uniq = [];
        const seen = new Set();
        problems.forEach(p=>{ const key=p.group+':' + p.ids.join('|') + ':' + p.row + ':' + p.col; if(!seen.has(key)){ seen.add(key); uniq.push(p); } });
        warnHost.style.display='block';
        warnHost.innerHTML = 'Note: Some group members are not adjacent in the source. Consider adjusting the sequence in FLEx if strict adjacency matters.' +
          '<br>' + uniq.map(p => `• Group ${escapeHtml(p.group)} at row ${escapeHtml(p.row)}, column ${p.col}: ${p.ids.map(escapeHtml).join(', ')}`).join('<br>');
      }
    }
  }catch(_){/* non-fatal */}
  // Apply style/visibility per label, including group-level overrides (group styles apply first, item styles override when set)
  const nodes = Array.from(area.querySelectorAll('.interlinear .pair.listRef[data-listref]'));
  nodes.forEach(n=>{
    const lab = (n.getAttribute('data-listref')||'').trim(); const ent = prefs.entries && prefs.entries[lab];
    // Resolve group membership and styles
    let gstyles = {};
    const g = (prefs.groups||[]).find(g=> Array.isArray(g.order) && g.order.includes(lab));
    if(g && g.styles) gstyles = { ...gstyles, ...g.styles };
    const final = { ...gstyles };
    if(ent){
      ['hidden','bold','italic','underline','fontSize','color'].forEach(k=>{
        if(ent[k] !== undefined && ent[k] !== '' && ent[k] !== null) final[k] = ent[k];
      });
    }
    n.style.display = final.hidden ? 'none' : '';
    const w = n.querySelector(':scope > .w'); if(w){
      w.style.fontWeight = final.bold ? '700' : '';
      w.style.fontStyle = final.italic ? 'italic' : '';
      w.style.textDecoration = final.underline ? 'underline' : '';
      w.style.fontSize = final.fontSize ? (parseInt(final.fontSize,10)||0) + 'px' : '';
      w.style.color = final.color || '';
    }
  });
}
/* ===== Abbreviations (listRef) controls and render ===== */
function collectListRefLabelsFromXml(xmlDoc){
  if(!xmlDoc) return [];
  const nodes = Array.from(xmlDoc.getElementsByTagName('listRef'));
  const set = new Set();
  nodes.forEach(n=>{
    const t = (n.textContent || '').trim();
    if(t) set.add(t);
  });
  return Array.from(set).sort((a,b)=> a.localeCompare(b, undefined, { numeric:true, sensitivity:'base' }));
}
function loadAbbrevPrefs(){
  const d = loadJSON(ABBREV_PREFS_KEY) || {};
  return {
    include: typeof d.include === 'boolean' ? d.include : true,
    position: d.position === 'bottom' ? 'bottom' : 'top',
    entries: d.entries || {}
  };
}
function saveAbbrevPrefs(p){ saveJSON(ABBREV_PREFS_KEY, p); }
function reconcileAbbrevPrefsWithLabels(prefs, labels){
  const out = { include: prefs.include, position: prefs.position, entries: { ...prefs.entries } };
  // Remove stale CHART entries; keep MANUAL ones always
  Object.keys(out.entries).forEach(k=>{
    const e = out.entries[k] || {};
    const isManual = e.src === 'manual' || String(k).startsWith('__manual__');
    if(!isManual){
      // chart-sourced entries are removed if no longer present
      if(!labels.includes(e.abbr || k)) delete out.entries[k];
    }
  });
  // Ensure entry for each label
  labels.forEach(l=>{
    const existing = out.entries[l] || Object.values(out.entries).find(e => e.abbr === l && e.src !== 'manual');
    if(!existing){
      out.entries[l] = { abbr: l, name: '', def: '', src: 'chart' };
    } else {
      // migrate legacy shape {label, def} where label was previously editable: treat it as name
      const e = existing;
      if(e.label !== undefined && e.name === undefined){ e.name = e.label || ''; delete e.label; }
      if(e.abbr === undefined) e.abbr = l;
      if(e.def === undefined) e.def = '';
      if(e.src === undefined) e.src = 'chart';
      // If existing is not keyed by l, re-key it
      if(!out.entries[l]){
        // find its key
        const kFound = Object.keys(out.entries).find(k => out.entries[k] === e);
        if(kFound && kFound !== l){ delete out.entries[kFound]; out.entries[l] = e; }
      }
    }
  });
  return out;
}
function showAbbrevPanel(show){ byId('abbrevPanel').style.display = show ? 'block' : 'none'; }
function buildAbbrevControls(labels){
  const panel = byId('abbrevPanel'); if(!panel) return;
  const includeCb = byId('abbrevInclude');
  const posSel = byId('abbrevPosition');
  const rowsHost = byId('abbrevRows');
  const emptyMsg = byId('abbrevEmptyMsg');
  const resetBtn = byId('abbrevResetFromChart');
  const addBtn = byId('abbrevAddManual');
  globalState.abbrevPrefs = reconcileAbbrevPrefsWithLabels(loadAbbrevPrefs(), labels);
  includeCb.checked = !!globalState.abbrevPrefs.include;
  posSel.value = globalState.abbrevPrefs.position;
  function renderRows(){
    rowsHost.innerHTML = '';
    const keys = Object.keys(globalState.abbrevPrefs.entries);
    emptyMsg.style.display = keys.length ? 'none' : 'block';
    keys.sort((a,b)=> a.localeCompare(b, undefined, {numeric:true,sensitivity:'base'})).forEach(k=>{
      const ent = globalState.abbrevPrefs.entries[k];
      const row = document.createElement('div'); row.className = 'abbr-row';
      let abbrCell;
      const isManual = ent.src === 'manual' || String(k).startsWith('__manual__');
      if(isManual){
        const abbrIn = document.createElement('input'); abbrIn.type = 'text'; abbrIn.value = ent.abbr || ''; abbrIn.placeholder = 'Abbreviation (incl. parentheses)';
        abbrIn.addEventListener('input', ()=>{
          ent.abbr = abbrIn.value;
          // If abbr is valid and unique, migrate key
          const trimmed = (ent.abbr || '').trim();
          if(trimmed && !globalState.abbrevPrefs.entries[trimmed]){
            delete globalState.abbrevPrefs.entries[k];
            globalState.abbrevPrefs.entries[trimmed] = ent;
            saveAbbrevPrefs(globalState.abbrevPrefs);
            renderRows();
            applyAbbrevToRenderArea(globalState.abbrevPrefs);
          } else {
            saveAbbrevPrefs(globalState.abbrevPrefs);
            applyAbbrevToRenderArea(globalState.abbrevPrefs);
          }
        });
        abbrCell = abbrIn;
      } else {
        const abbrEl = document.createElement('span'); abbrEl.className = 'abbr-abbr'; abbrEl.textContent = ent.abbr || k; abbrCell = abbrEl;
      }
      const nameIn = document.createElement('input'); nameIn.type = 'text'; nameIn.value = ent.name || ''; nameIn.placeholder = 'Name';
      const defIn = document.createElement('input'); defIn.type = 'text'; defIn.value = ent.def || ''; defIn.placeholder = 'Description (optional)';
      nameIn.addEventListener('input', ()=>{ ent.name = nameIn.value; saveAbbrevPrefs(globalState.abbrevPrefs); applyAbbrevToRenderArea(globalState.abbrevPrefs); });
      defIn.addEventListener('input', ()=>{ ent.def = defIn.value; saveAbbrevPrefs(globalState.abbrevPrefs); applyAbbrevToRenderArea(globalState.abbrevPrefs); });
      row.appendChild(abbrCell); row.appendChild(nameIn); row.appendChild(defIn);
      if(isManual){
        const delBtn = document.createElement('button'); delBtn.className = 'small-btn secondary'; delBtn.textContent = 'Remove';
        delBtn.addEventListener('click', ()=>{
          delete globalState.abbrevPrefs.entries[k];
          saveAbbrevPrefs(globalState.abbrevPrefs);
          renderRows();
          applyAbbrevToRenderArea(globalState.abbrevPrefs);
        });
        // make a 4th column for remove button
        row.style.gridTemplateColumns = 'auto 1fr 2fr auto';
        row.appendChild(delBtn);
      }
      rowsHost.appendChild(row);
    });
  }
  if(panel.dataset.wired !== '1'){
    includeCb.addEventListener('change', ()=>{ globalState.abbrevPrefs.include = !!includeCb.checked; saveAbbrevPrefs(globalState.abbrevPrefs); applyAbbrevToRenderArea(globalState.abbrevPrefs); });
    posSel.addEventListener('change', ()=>{ globalState.abbrevPrefs.position = posSel.value === 'bottom' ? 'bottom':'top'; saveAbbrevPrefs(globalState.abbrevPrefs); applyAbbrevToRenderArea(globalState.abbrevPrefs); });
    resetBtn.addEventListener('click', ()=>{
      globalState.abbrevPrefs = reconcileAbbrevPrefsWithLabels(globalState.abbrevPrefs, globalState.chartAbbrevLabels || []);
      saveAbbrevPrefs(globalState.abbrevPrefs); renderRows(); applyAbbrevToRenderArea(globalState.abbrevPrefs);
    });
    addBtn.addEventListener('click', ()=>{
      // create a placeholder manual entry with a temp key
      const tempKey = '__manual__' + Date.now() + '_' + Math.floor(Math.random()*10000);
      globalState.abbrevPrefs.entries[tempKey] = { abbr: '', name: '', def: '', src: 'manual' };
      saveAbbrevPrefs(globalState.abbrevPrefs);
      renderRows();
      applyAbbrevToRenderArea(globalState.abbrevPrefs);
    });
    panel.dataset.wired = '1';
  }
  saveAbbrevPrefs(globalState.abbrevPrefs);
  renderRows();
  // Apply immediately to current render
  applyAbbrevToRenderArea(globalState.abbrevPrefs);
}
function applyAbbrevToRenderArea(prefs){
  const area = byId('renderArea'); if(!area) return;
  // Remove any existing blocks
  area.querySelectorAll(':scope > .chart-abbrev-block').forEach(n=> n.remove());
  if(!prefs || !prefs.include) return;
  const entries = Object.values(prefs.entries || {});
  if(!entries.length) return;
  const block = document.createElement('div'); block.className = 'chart-abbrev-block';
  const heading = document.createElement('h3'); heading.textContent = 'Abbreviations'; block.appendChild(heading);
  const list = document.createElement('ul');
  entries
    .sort((a,b)=> (a.abbr||'').localeCompare(b.abbr||'', undefined, {numeric:true,sensitivity:'base'}))
    .forEach(ent=>{
      const li = document.createElement('li');
      const abbr = (ent.abbr || '').trim();
      const name = (ent.name || '').trim();
      const def = (ent.def || '').trim();
      if(!abbr) return; // must have abbreviation
      let tail = '';
      if(name && def) tail = ` — ${escapeHtml(name)} — ${escapeHtml(def)}`;
      else if(name) tail = ` — ${escapeHtml(name)}`;
      else if(def) tail = ` — ${escapeHtml(def)}`;
      li.innerHTML = `<strong>${escapeHtml(abbr)}</strong>${tail}`;
      list.appendChild(li);
    });
  if(!list.childNodes.length) return;
  block.appendChild(list);
  // Insert at chosen position
  const prologue = area.querySelector(':scope > .chart-prologue');
  const table = area.querySelector('table.chartshell')?.closest('.chartshell-wrapper') || area.querySelector('table.chartshell');
  if(prefs.position === 'top'){
    if(prologue && prologue.nextSibling) area.insertBefore(block, prologue.nextSibling);
    else area.insertBefore(block, area.firstChild || null);
  } else {
    if(table && table.nextSibling) area.insertBefore(block, table.nextSibling);
    else area.appendChild(block);
  }
}
function applyPrologueToRenderArea(prefs){
  const area = byId('renderArea');
  if(!area) return;
  // Ensure a fixed container exists as the first child for prologue content
  let prologue = area.querySelector(':scope > .chart-prologue');
  if(!prologue){
    prologue = document.createElement('div');
    prologue.className = 'chart-prologue';
    // Insert after any before-prologue HTML if present
    const beforeBlock = area.querySelector(':scope > .inserted-html-before-prologue');
    if(beforeBlock && beforeBlock.nextSibling){
      area.insertBefore(prologue, beforeBlock.nextSibling);
    } else if(beforeBlock){
      area.appendChild(prologue);
    } else {
      area.insertBefore(prologue, area.firstChild || null);
    }
  }
  prologue.innerHTML = '';
  const { tag, titleText } = (prefs || loadProloguePrefs());
  let { prefaceHtml, autoConvert } = (prefs || loadProloguePrefs());
  if(titleText && tag){
    const t = document.createElement(tag);
    t.textContent = titleText;
    prologue.appendChild(t);
  }
  if(prefaceHtml && prefaceHtml.trim()){
    // Convert plain text to HTML when auto-convert is on and content appears to be plain text.
    const appearsHtml = /<\s*[a-zA-Z!/]/.test(prefaceHtml);
    let htmlOut = prefaceHtml;
    if(autoConvert && !appearsHtml){
      // Treat double newlines as paragraph breaks, single newline as <br /> within a paragraph
      const norm = prefaceHtml.replace(/\r\n?/g, '\n');
      const paras = norm.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
      htmlOut = paras.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`).join('\n');
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlOut;
    Array.from(wrapper.childNodes).forEach(n => prologue.appendChild(n));
  }
  // If both are empty, remove the container to avoid extra spacing
  if(!prologue.childNodes.length){ prologue.remove(); }
  // After updating prologue, re-render the Salience legend position
  try{ renderSalienceLegend(); }catch(_){ }
}

/* ===== Append external HTML before/after the chart ===== */
function showAppendHtmlPanel(show){ const p = byId('appendHtmlPanel'); if(p) p.style.display = show ? 'block' : 'none'; }
function sanitizeUserHtml(html){
  // strip <script> tags for safety
  try{
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    tmp.querySelectorAll('script').forEach(s=> s.remove());
    return tmp.innerHTML;
  }catch(_){ return html || ''; }
}
function applyAppendedHtmlToRenderArea(){
  const area = byId('renderArea'); if(!area) return;
  // Before-prologue block
  let before = area.querySelector(':scope > .inserted-html-before-prologue');
  if(globalState.beforeHtml){
    if(!before){ before = document.createElement('div'); before.className = 'inserted-html-before-prologue'; area.insertBefore(before, area.firstChild || null); }
    before.innerHTML = globalState.beforeHtml;
  } else if(before){ before.remove(); }

  // After-chart block: place after table, but before abbreviations if they are at bottom
  let after = area.querySelector(':scope > .inserted-html-after-chart');
  if(globalState.afterHtml){
    if(!after){ after = document.createElement('div'); after.className = 'inserted-html-after-chart'; }
    after.innerHTML = globalState.afterHtml;
    const tableWrap = area.querySelector('table.chartshell')?.closest('.chartshell-wrapper') || area.querySelector('table.chartshell');
    const abbrBlock = area.querySelector(':scope > .chart-abbrev-block');
    const abbrBottom = (globalState.abbrevPrefs && globalState.abbrevPrefs.include && globalState.abbrevPrefs.position === 'bottom');
    if(abbrBottom && abbrBlock){
      area.insertBefore(after, abbrBlock);
    } else if(tableWrap){
      if(tableWrap.nextSibling){ area.insertBefore(after, tableWrap.nextSibling); }
      else { area.appendChild(after); }
    } else {
      // fallback to end
      area.appendChild(after);
    }
  } else if(after){ after.remove(); }

  // Update small statuses
  const bstat = byId('beforeHtmlStatus'); if(bstat) bstat.textContent = globalState.beforeHtmlName ? `Attached: ${globalState.beforeHtmlName}` : '';
  const astat = byId('afterHtmlStatus'); if(astat) astat.textContent = globalState.afterHtmlName ? `Attached: ${globalState.afterHtmlName}` : '';
}
function initAppendHtmlControls(){
  const beforeIn = byId('beforeHtmlInput');
  const afterIn = byId('afterHtmlInput');
  const clearB = byId('clearBeforeHtmlBtn');
  const clearA = byId('clearAfterHtmlBtn');
  if(!beforeIn || !afterIn) return;
  const readFile = async (file)=>{ if(!file) return null; const txt = await file.text(); return sanitizeUserHtml(txt); };
  beforeIn.addEventListener('change', async e=>{
    const f = e.target.files && e.target.files[0];
    if(!f){ globalState.beforeHtml = null; globalState.beforeHtmlName=''; applyAppendedHtmlToRenderArea(); return; }
    globalState.beforeHtml = await readFile(f); globalState.beforeHtmlName = f.name || '';
    applyAppendedHtmlToRenderArea();
    // Re-insert prologue after the before block if needed
    applyPrologueToRenderArea(loadProloguePrefs());
    // Abbrev may need to shift down
    applyAbbrevToRenderArea(globalState.abbrevPrefs || loadAbbrevPrefs());
  });
  afterIn.addEventListener('change', async e=>{
    const f = e.target.files && e.target.files[0];
    if(!f){ globalState.afterHtml = null; globalState.afterHtmlName=''; applyAppendedHtmlToRenderArea(); return; }
    globalState.afterHtml = await readFile(f); globalState.afterHtmlName = f.name || '';
    applyAppendedHtmlToRenderArea();
  });
  clearB.addEventListener('click', ()=>{ globalState.beforeHtml=null; globalState.beforeHtmlName=''; beforeIn.value=''; applyAppendedHtmlToRenderArea(); applyPrologueToRenderArea(loadProloguePrefs()); applyAbbrevToRenderArea(globalState.abbrevPrefs || loadAbbrevPrefs()); });
  clearA.addEventListener('click', ()=>{ globalState.afterHtml=null; globalState.afterHtmlName=''; afterIn.value=''; applyAppendedHtmlToRenderArea(); });
}

/* ===== Main detection & dispatch ===== */
function showChartPanels(show){
  showLanguageProjectsSection(show);
  showTextGenresSection(show);
  showDocumentPartsSection(show);
  const rhc = byId('repeatHeadersContainer'); if(rhc) rhc.style.display = show ? 'flex' : 'none';
  const fhc = byId('freezeHeadersContainer'); if(fhc) fhc.style.display = show ? 'flex' : 'none';
}
async function renderDocument(xmlDoc){
  const area = byId('renderArea');
  area.innerHTML = '';

  // This tool only handles Discourse Charts (Text Charts); point other FLEx exports at the general viewer.
  if(!isTextChartDocument(xmlDoc)){
    showChartPanels(false);
    setPrintHeadersEnabled(false);
    const msg = create('div');
    msg.innerHTML = `
      <div style="padding:20px;text-align:center">
        <h3 style="color:#d32f2f;margin-bottom:12px">This tool only supports Discourse Charts (Text Charts)</h3>
        <p style="margin-bottom:16px">For Lists, Phonology, Wordforms, and other FLEx XML export types,<br>please use the
          <strong><a href="https://rulingants.github.io/flexml_display/" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline">FLEx XML Viewer</a></strong>.</p>
      </div>
    `;
    area.appendChild(msg);
    return;
  }

  const rendered = await renderTextChart(xmlDoc);
  area.innerHTML = '';
  showChartPanels(true);

  // Panels are static markup; their controls are wired once and re-synced from prefs on each render.
  showAppendHtmlPanel(true);
  if(!byId('appendHtmlPanel').dataset.wired){ initAppendHtmlControls(); byId('appendHtmlPanel').dataset.wired = '1'; }
  // Apply any previously selected before-html prior to placing prologue
  applyAppendedHtmlToRenderArea();
  showProloguePanel(true);
  applyPrologueToRenderArea(loadProloguePrefs());
  showPostloguePanel(true);
  if(!byId('postloguePanel').dataset.wired){ initPostlogueControls(); byId('postloguePanel').dataset.wired = '1'; }
  showNotesPanel(true);
  initNotesControls();
  showFTPanel(true);
  initFTControls();
  showSaliencePanel(true);
  initSalienceControls();
  showCustomColsPanel(true);
  if(!byId('customColsPanel').dataset.wired){ initCustomColsControls(); byId('customColsPanel').dataset.wired = '1'; }
  // Scan listRef abbreviations and show Abbrev controls
  globalState.chartAbbrevLabels = collectListRefLabelsFromXml(xmlDoc);
  showAbbrevPanel(true);
  buildAbbrevControls(globalState.chartAbbrevLabels);
  // ListRef controls: labels come from the rendered DOM; the suggested order comes from the XML
  const suggestedOrder = computeListRefSuggestedOrderFromXml(xmlDoc);
  showListRefPanel(true);

  if(rendered){
    area.appendChild(rendered);
    // Assign persistent GUIDs to body rows for stable associations
    try{
      const tbl = area.querySelector('table.chartshell');
      if(tbl){
        Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
          if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
          getRowGuidFromTr(tr); // keeps a GUID the source supplied (data-row-guid), else assigns one
        });
      }
    }catch(_){ }
    // Wire note tooltips after chart content is in the DOM
    if(window.wireNoteTooltips){ try{ window.wireNoteTooltips(); }catch(e){ console.error('Error wiring note tooltips:', e); } }
    // Enable column resizing on the text chart table
    enableTextChartColumnResize(area);
    // Wire Free Translation add/edit buttons and apply current display mode
    wireFreeTranslationButtons(area);
    applyFreeTranslationsToArea(area);
    // Wire Salience band buttons and apply to rows
    wireSalienceButtons(area);
    applySalienceBandsToArea(area);
    toggleSalienceColumn();
    applyCustomColumnsToArea(area);
    // Apply freeze headers if saved
    initFreezeHeadersControl();
    const savedFreeze = loadJSON(FREEZE_HEADERS_KEY); setTimeout(()=> setFreezeHeadersEnabled(!!(savedFreeze && savedFreeze.enabled)), 0);
    // Ensure abbreviations block is positioned correctly relative to chart
    applyAbbrevToRenderArea(globalState.abbrevPrefs || loadAbbrevPrefs());
    // Now insert after-chart HTML in final position
    applyAppendedHtmlToRenderArea();
    // Insert/refresh salience legend below prologue and above chart
    renderSalienceLegend();
    // Insert Epilogue live preview at end
    applyEpilogueToRenderArea(loadPostloguePrefs());
    // Collect ListRef labels from rendered DOM (data-listref set by XSL), build controls with suggested order, and apply prefs
    globalState.listRefLabels = collectListRefLabelsFromRendered(area);
    buildListRefControls(globalState.listRefLabels, suggestedOrder);
  } else {
    area.textContent = 'Failed to render Text Chart.';
  }

  // Print-headers toggle: reflect saved preference and apply it
  initRepeatHeadersControl();
}

/* ===== Salience Legend and Column ===== */
function renderSalienceLegend(){
  const area = byId('renderArea'); if(!area) return;
  // Remove existing legend
  area.querySelectorAll(':scope > .chart-salience-legend').forEach(n=> n.remove());
  const prefs = loadSaliencePrefs();
  if(!(prefs.enabled && prefs.showLegend)) return;
  // Build flat list from tree
  const nums = computeSalienceNumbers(prefs.tree);
  const items = [];
  (function walk(list){ (list||[]).forEach(n=>{ items.push({ id:n.id, num:nums[n.id]||'', label:n.label||'', color:n.color||findParentColor(prefs.tree, n.id)||'#fffad1' }); walk(n.children||[]); }); })(prefs.tree||[]);
  if(!items.length) return;
  const legend = document.createElement('div'); legend.className='chart-salience-legend';
  const h = document.createElement('h3'); h.textContent = 'Salience Scheme'; legend.appendChild(h);
  items.forEach(it=>{
    const row = document.createElement('div'); row.className='sal-row';
    const sw = document.createElement('span'); sw.className='sal-color'; sw.style.background = alphaColor(it.color, prefs.opacity);
    const num = document.createElement('strong'); num.textContent = it.num;
    const lab = document.createElement('span'); lab.textContent = it.label || '(unnamed)';
    row.appendChild(sw); row.appendChild(num); row.appendChild(lab); legend.appendChild(row);
  });
  // Insert after prologue, before chart
  const prologue = area.querySelector(':scope > .chart-prologue');
  if(prologue && prologue.nextSibling) area.insertBefore(legend, prologue.nextSibling);
  else area.insertBefore(legend, area.firstChild || null);
}
// Centralized visual refresh for salience after any change
function refreshSalienceVisuals(area){
  try{
    area = area || byId('renderArea');
    if(!area) return;
    // Apply row shading and ensure column content matches current prefs
    applySalienceBandsToArea(area);
    // Ensure salience column visibility and cells reflect the latest labels/colors
    toggleSalienceColumn();
    // Refresh the per-row picker button text and titles
    updateSalienceButtons(area);
    // Rebuild the legend
    renderSalienceLegend();
    // Re-apply custom columns in case salience column visibility changed
    applyCustomColumnsToArea(area);
  }catch(_){ /* non-fatal */ }
}
function alphaColor(hex, a){
  try{
    const m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex||'').trim());
    if(!m) return hex;
    let r,g,b; const h=m[1];
    if(h.length===3){ r=parseInt(h[0]+h[0],16); g=parseInt(h[1]+h[1],16); b=parseInt(h[2]+h[2],16); }
    else { r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16); }
    const alpha = Math.max(0, Math.min(1, (typeof a==='number'?a:1)));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }catch(_){ return hex; }
}
function toggleSalienceColumn(){
  const area = byId('renderArea'); if(!area) return;
  const prefs = loadSaliencePrefs();
  const tbl = area.querySelector('table.chartshell'); if(!tbl) return;
  const want = !!prefs.showColumn;
  // Determine if a salience column exists (look for th/td with data-sal-col="1")
  const has = !!tbl.querySelector('[data-sal-col="1"]');
  if(want && has){ updateSalienceColumnCells(tbl); return; }
  if(!want && has){ removeSalienceColumn(tbl); return; }
  if(want && !has){ addSalienceColumn(tbl); return; }
}
function addSalienceColumn(tbl){
  // Add a leading column in header rows and body rows
  const headRows = tbl.querySelectorAll('thead tr.row.title1, thead tr.row.title2');
  headRows.forEach(r=>{
    const th = document.createElement('th'); th.className='cell sal-cell'; th.textContent = r.classList.contains('title2') ? 'Salience' : '';
    th.setAttribute('data-sal-col','1');
    r.insertBefore(th, r.firstChild);
  });
  const bodyRows = tbl.querySelectorAll('tbody tr');
  bodyRows.forEach(r=>{
    if(r.classList.contains('ft-inline')) return;
    const td = document.createElement('td'); td.className='sal-cell'; td.setAttribute('data-sal-col','1');
    r.insertBefore(td, r.firstChild);
  });
  // One matching <col> at the very start of the table (first colgroup) so widths line up
  const firstGroup = tbl.querySelector('colgroup');
  if(firstGroup){
    const c = document.createElement('col'); c.setAttribute('data-sal-col','1');
    firstGroup.insertBefore(c, firstGroup.firstChild);
  }
  updateSalienceColumnCells(tbl);
}
function removeSalienceColumn(tbl){
  tbl.querySelectorAll('[data-sal-col="1"]').forEach(n=> n.remove());
}
function updateSalienceColumnCells(tbl){
  const prefs = loadSaliencePrefs(); const nums = computeSalienceNumbers(prefs.tree);
  const idTo = {}; (function walk(list){ (list||[]).forEach(n=>{ idTo[n.id] = { num: nums[n.id]||'', label: n.label||'', color: n.color||findParentColor(prefs.tree, n.id)||'#fffad1' }; walk(n.children||[]); }); })(prefs.tree||[]);
  const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('ft-inline'));
  rows.forEach(r=>{
    const td = r.querySelector(':scope > td[data-sal-col="1"]'); if(!td) return;
    const label = computeRowLabelFromRow(r); const id = (prefs.assignments||{})[label];
    if(!id){ td.textContent = ''; td.style.background=''; return; }
    const meta = idTo[id]; if(!meta){ td.textContent=''; td.style.background=''; return; }
    td.innerHTML = `<span class="sal-pill">${meta.num}</span> ${escapeHtml(meta.label)}`;
    td.style.background = prefs.enabled ? alphaColor(meta.color, prefs.opacity) : '';
  });
}

/* ===== Custom columns (user-defined, per-row text) ===== */
function loadCustomColsPrefs(){ const d = loadJSON(CUSTOM_COLS_PREFS_KEY) || {}; return { cols: Array.isArray(d.cols)?d.cols:[], cells: d.cells || {} }; }
function saveCustomColsPrefs(p){ saveJSON(CUSTOM_COLS_PREFS_KEY, p); syncLegacyToHierarchical(); }
function initCustomColsControls(){
  const addBtn = byId('ccAdd'); const listHost = byId('ccList'); const showAll = byId('ccShowAll'); const hideAll = byId('ccHideAll');
  if(!addBtn || !listHost) return;
  function render(){
    const prefs = loadCustomColsPrefs();
    const cols = prefs.cols || [];
    listHost.innerHTML = '';
    if(!cols.length){ listHost.innerHTML = '<div class="small-muted">No custom columns. Click "Add column".</div>'; return; }
    cols.forEach((col, idx)=>{
      const row = document.createElement('div'); row.className='lr-row'; row.style.gridTemplateColumns = 'auto auto 1fr auto auto';
      const visible = document.createElement('label'); visible.className='small-muted';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = col.visible !== false; visible.appendChild(cb); visible.appendChild(document.createTextNode(' show'));
      const lab = document.createElement('input'); lab.type='text'; lab.value = col.label || ('Column ' + (idx+1)); lab.placeholder='Column title'; lab.style.minWidth='0';
      const up = document.createElement('button'); up.className='small-btn secondary'; up.textContent='▲'; up.title='Move up';
      const down = document.createElement('button'); down.className='small-btn secondary'; down.textContent='▼'; down.title='Move down';
      const del = document.createElement('button'); del.className='small-btn secondary'; del.textContent='Remove'; del.title='Remove column';
      row.appendChild(visible); row.appendChild(document.createTextNode('')); row.appendChild(lab); row.appendChild(up); row.appendChild(down); row.appendChild(del);
      listHost.appendChild(row);
      cb.addEventListener('change', ()=>{ const p=loadCustomColsPrefs(); (p.cols||[])[idx].visible = !!cb.checked; saveCustomColsPrefs(p); applyCustomColumnsToArea(); });
      lab.addEventListener('change', ()=>{ const p=loadCustomColsPrefs(); (p.cols||[])[idx].label = lab.value.trim() || ('Column ' + (idx+1)); saveCustomColsPrefs(p); applyCustomColumnsToArea(); render(); });
      up.addEventListener('click', ()=>{ const p=loadCustomColsPrefs(); if(idx>0){ const t=p.cols[idx]; p.cols[idx]=p.cols[idx-1]; p.cols[idx-1]=t; saveCustomColsPrefs(p); applyCustomColumnsToArea(); render(); } });
      down.addEventListener('click', ()=>{ const p=loadCustomColsPrefs(); if(idx<p.cols.length-1){ const t=p.cols[idx]; p.cols[idx]=p.cols[idx+1]; p.cols[idx+1]=t; saveCustomColsPrefs(p); applyCustomColumnsToArea(); render(); } });
      del.addEventListener('click', ()=>{ if(!confirm('Remove this column?')) return; const p=loadCustomColsPrefs(); const removed = p.cols.splice(idx,1)[0]; if(removed && removed.id){ Object.keys(p.cells||{}).forEach(r=>{ if(p.cells[r] && p.cells[r][removed.id] !== undefined) delete p.cells[r][removed.id]; }); } saveCustomColsPrefs(p); applyCustomColumnsToArea(); render(); });
    });
  }
  addBtn.addEventListener('click', ()=>{
    const p = loadCustomColsPrefs(); p.cols = p.cols || []; p.cols.push({ id: 'cc_'+Date.now().toString(36)+'_'+Math.floor(Math.random()*1000), label: 'Column '+(p.cols.length+1), visible: true }); saveCustomColsPrefs(p); applyCustomColumnsToArea(); render();
  });
  showAll?.addEventListener('click', ()=>{ const p=loadCustomColsPrefs(); (p.cols||[]).forEach(c=> c.visible = true); saveCustomColsPrefs(p); applyCustomColumnsToArea(); render(); });
  hideAll?.addEventListener('click', ()=>{ const p=loadCustomColsPrefs(); (p.cols||[]).forEach(c=> c.visible = false); saveCustomColsPrefs(p); applyCustomColumnsToArea(); render(); });
  render();
}
function getRownumColumnIndex(tbl){
  try{
    const row = Array.from(tbl.querySelectorAll('tbody tr')).find(tr=> !tr.classList.contains('title1') && !tr.classList.contains('title2') && !tr.classList.contains('ft-inline'));
    if(!row) return 0;
    let idx = 0; let foundIdx = 0;
    Array.from(row.children).some(td=>{
      const span = Number(td.getAttribute('colspan')||'1');
      const isRownumCell = !!td.querySelector('.interlinear .pair .w.rownum');
      if(isRownumCell){ foundIdx = idx; return true; }
      idx += span; return false;
    });
    return foundIdx;
  }catch(_){ return 0; }
}
function removeCustomColumns(tbl){ tbl.querySelectorAll('[data-cc-col="1"]').forEach(n=> n.remove()); }
// Locate the <col> covering a 0-based global column index, honouring span attributes.
function findColAtGlobalIndex(tbl, idx){
  let i = 0;
  for(const group of tbl.querySelectorAll('colgroup')){
    for(const col of group.querySelectorAll('col')){
      const span = Number(col.getAttribute('span')||'1');
      if(idx >= i && idx < i + span) return { group, col };
      i += span;
    }
  }
  return null;
}
function applyCustomColumnsToArea(area){
  area = area || byId('renderArea'); if(!area) return;
  const tbl = area.querySelector('table.chartshell'); if(!tbl) return;
  expandColgroupsToIndividualCols(tbl);
  // Remove existing resize handles; will re-add after columns update
  try{ tbl.querySelectorAll('.col-resizer').forEach(h=> h.remove()); }catch(_){ }
  removeCustomColumns(tbl);
  const prefs = loadCustomColsPrefs(); const defs = (prefs.cols||[]).filter(c=> c.visible !== false);
  if(!defs.length) return;
  const baseIdx = getRownumColumnIndex(tbl);
  // Insert one <col> per custom column right after the row-number column, in the
  // colgroup that holds it (colgroups were expanded to one <col> per column above).
  const anchor = findColAtGlobalIndex(tbl, baseIdx);
  if(anchor){
    const ref = anchor.col.nextSibling;
    for(let i=0;i<defs.length;i++){
      const c = document.createElement('col'); c.setAttribute('data-cc-col','1');
      anchor.group.insertBefore(c, ref);
    }
  }
  // Insert header cells in title rows at the matching position
  const headRows = tbl.querySelectorAll('thead tr.row.title1, thead tr.row.title2');
  headRows.forEach(r=>{
    // Find the cell covering baseIdx (row number)
    let ci=0; let cellIdx=0; let coverCell=null;
    const cells = Array.from(r.children);
    for(let i=0;i<cells.length;i++){
      const sp = Number(cells[i].getAttribute('colspan')||'1');
      const covers = (baseIdx >= ci) && (baseIdx < ci+sp);
      if(covers){ coverCell = cells[i]; cellIdx = i; break; }
      ci += sp;
    }
    const insertAfter = coverCell || cells[0] || null;
    const insParent = r;
    for(let j=defs.length-1;j>=0;j--){ const d = defs[j];
      const th = document.createElement('th'); th.className='cell cc-header'; th.textContent = d.label || ('Column'); th.setAttribute('data-cc-col','1');
      if(insertAfter && insertAfter.nextSibling){ insParent.insertBefore(th, insertAfter.nextSibling); }
      else if(insertAfter){ insParent.appendChild(th); }
      else { insParent.appendChild(th); }
    }
  });
  // Insert body cells per row after the row number cell
  const bodyRows = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('title1') && !r.classList.contains('title2') && !r.classList.contains('ft-inline'));
  bodyRows.forEach(r=>{
    const rowGuid = getRowGuidFromTr(r);
    const rownumCell = Array.from(r.children).find(td=> !!td.querySelector('.interlinear .pair .w.rownum')) || r.querySelector('td');
    for(let k=defs.length-1;k>=0;k--){ const d = defs[k];
      const td = document.createElement('td'); td.className='cc-cell'; td.setAttribute('data-cc-col','1');
      const div = document.createElement('div'); div.className='cc-edit'; div.contentEditable = 'true'; div.setAttribute('data-cc-id', d.id);
      div.textContent = ((prefs.cells||{})[rowGuid]||{})[d.id] || '';
      div.addEventListener('input', ()=>{
        const p = loadCustomColsPrefs(); p.cells = p.cells || {}; p.cells[rowGuid] = p.cells[rowGuid] || {}; p.cells[rowGuid][d.id] = div.textContent; saveCustomColsPrefs(p);
      });
      td.appendChild(div);
      if(rownumCell && rownumCell.nextSibling){ r.insertBefore(td, rownumCell.nextSibling); }
      else if(rownumCell){ r.appendChild(td); }
      else { r.appendChild(td); }
    }
  });
  // Re-wire resizers now that columns changed
  addResizeHandles(tbl);
}

/* ===== Text Chart detection and rendering (XSLT) ===== */
function isTextChartDocument(xmlDoc){
  if(!xmlDoc || !xmlDoc.documentElement) return false;
  // Typical structure: <document><chart>...</chart></document> or a top-level <chart>
  return !!(xmlDoc.querySelector('document > chart > row') || xmlDoc.querySelector('chart > row'));
}

async function loadTextChartXSL(){
  // Freshness is handled by the service worker (network-first); no cache-buster needed.
  const resp = await fetch('textchart/textchart-to-html.xsl');
  if(!resp.ok) throw new Error(`Failed to fetch XSL (${resp.status})`);
  const txt = await resp.text();
  const doc = new DOMParser().parseFromString(txt, 'text/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if(err) throw new Error('XSL parse error: ' + err.textContent.trim());
  return doc;
}

async function renderTextChart(xmlDoc){
  if(typeof XSLTProcessor === 'undefined'){
    const frag = document.createDocumentFragment();
    frag.appendChild(create('div', {cls:'small-muted'}, 'XSLTProcessor not supported in this browser.'));
    return frag;
  }
  const xslDoc = await loadTextChartXSL();
  const proc = new XSLTProcessor();
  proc.importStylesheet(xslDoc);
  try{
    // Optional: pass through debug param from URL (?debug=1)
    const urlParams = new URLSearchParams(window.location.search);
    const dbg = urlParams.get('debug');
    if(dbg && ['1','true','yes','on'].includes(dbg.toLowerCase())){
      proc.setParameter(null, 'debug', 'true');
    }
    // Enable compact print class in-app; exports will remove the class
    proc.setParameter(null, 'printCompact', 'true');
    // Notes options from saved prefs
    const np = loadNotesPrefs();
    if(np && np.mode) proc.setParameter(null, 'notesAction', np.mode);
    if(np && typeof np.width === 'string') proc.setParameter(null, 'notesColWidth', np.width);
  }catch(_){/* no-op if params unsupported */}

  // Run transform to a fragment, then extract the body contents if present
  const frag = proc.transformToFragment(xmlDoc, document);
  const wrapper = document.createElement('div');
  wrapper.appendChild(frag);
  // If XSL produced a <head>, merge its styles into the page once
  const head = wrapper.querySelector('head');
  if (head) {
    // Inline <style>
    const styleEl = head.querySelector('style');
    if (styleEl) {
      const EXISTING_ID = 'textchart-xsl-style';
      let dest = document.getElementById(EXISTING_ID);
      if (!dest) {
        dest = document.createElement('style');
        dest.id = EXISTING_ID;
        document.head.appendChild(dest);
      }
      dest.textContent = styleEl.textContent || '';
    }
    // Linked stylesheets (if any in future)
    head.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      // Avoid duplicates by href
      const exists = Array.from(document.head.querySelectorAll('link[rel="stylesheet"][href]'))
        .some(l => l.getAttribute('href') === href);
      if (!exists) {
        const copy = document.createElement('link');
        copy.rel = 'stylesheet';
        copy.href = href;
        document.head.appendChild(copy);
      }
    });
  }
  const body = wrapper.querySelector('body');
  const outFrag = document.createDocumentFragment();
  const source = body || wrapper; // prefer body if the XSL produced a full HTML doc
  Array.from(source.childNodes).forEach(n => outFrag.appendChild(n));
  return outFrag;
}

/* ===== Build standalone HTML (for open/save) — note escaped closing tag to avoid template literal issues ===== */
function buildStandaloneHTML(opts){
  opts = opts || {};
  const render = byId('renderArea');
  // Gather prologue (if any) + current render content (without duplicating prologue)
  let content = '';
  const prologueNode = render.querySelector(':scope > .chart-prologue');
  const clone = render.cloneNode(true);
  // Remove in-app only controls from export snapshot
  try{ clone.querySelectorAll('.add-trans-btn, .add-band-btn').forEach(n=> n.remove()); }catch(e){ console.error('Error removing in-app buttons:', e); }
  // Ensure any editable regions are exported as static text, and drop in-app wiring markers
  try{ clone.querySelectorAll('[contenteditable]').forEach(n=> n.removeAttribute('contenteditable')); }catch(_){ }
  try{ clone.querySelectorAll('[data-tip-wired]').forEach(n=> n.removeAttribute('data-tip-wired')); }catch(_){ }
  // Remove interactive wiring attributes if any and re-render legend based on saved prefs post-prologue in export clone (legend already present in clone if rendered)
  // Helper: ensure destination table has individual <col> elements (no span)
  function ensureIndividualCols(tbl){
    const groups = Array.from(tbl.querySelectorAll('colgroup'));
    groups.forEach(g=>{
      const c = g.querySelector('col');
      if(!c) return;
      const span = Number(c.getAttribute('span')||'1');
      if(span > 1){
        c.removeAttribute('span');
        const frag = document.createDocumentFragment();
        for(let i=0;i<span;i++) frag.appendChild(document.createElement('col'));
        g.replaceChild(frag, c);
      }
    });
  }
  // Helper: freeze current column widths from live table into the cloned table
  function freezeChartColumnWidthsInClone(sourceRoot, cloneRoot){
    const srcTbl = sourceRoot.querySelector('table.chartshell');
    const dstTbl = cloneRoot.querySelector('table.chartshell');
    if(!srcTbl || !dstTbl) return;
    // Make sure destination has one <col> per column
    ensureIndividualCols(dstTbl);
    const dstCols = Array.from(dstTbl.querySelectorAll('col'));
    if(!dstCols.length) return;
    // Build widths array by measuring header (prefer title2), then fill from body rows as needed
    const widths = new Array(dstCols.length).fill(0);
    const srcHeader = srcTbl.querySelector('tr.row.title2') || srcTbl.querySelector('tr.row.title1');
    let colIndex = 0;
    if(srcHeader){
      srcHeader.querySelectorAll('th.cell').forEach(th=>{
        const span = Number(th.getAttribute('colspan')||'1');
        let w = Math.max(0, Math.round(th.getBoundingClientRect().width));
        
        // Special handling for custom columns - ensure minimum width
        if(th.classList.contains('cc-header')) {
          const textContent = th.textContent || '';
          const minTextWidth = Math.max(80, textContent.length * 8); // Estimate based on text length
          w = Math.max(w, minTextWidth);
        }
        
        const per = Math.max(0, Math.floor(w / span));
        for(let i=0;i<span && (colIndex + i) < widths.length;i++){
          widths[colIndex + i] = per;
        }
        colIndex += span;
      });
    }
    const srcBodyRows = Array.from(srcTbl.querySelectorAll('tbody tr'));
    function fillFromRow(row){
      let idx = 0;
      Array.from(row.children).forEach(td=>{
        const span = Number(td.getAttribute('colspan')||'1');
        let w = Math.max(0, Math.round(td.getBoundingClientRect().width));
        
        // Special handling for custom column cells - measure content
        if(td.classList.contains('cc-cell')) {
          const editDiv = td.querySelector('.cc-edit');
          if(editDiv) {
            const textContent = editDiv.textContent || '';
            const minTextWidth = Math.max(80, textContent.length * 8); // Estimate based on text length
            w = Math.max(w, minTextWidth);
          }
        }
        
        const per = Math.max(0, Math.floor(w / span));
        for(let i=0;i<span && (idx + i) < widths.length;i++){
          if(widths[idx + i] === 0) widths[idx + i] = per;
        }
        idx += span;
      });
    }
    if(widths.some(v=>v===0) && srcBodyRows.length){
      for(let r=0; r<Math.min(10, srcBodyRows.length); r++){
        fillFromRow(srcBodyRows[r]);
        if(!widths.some(v=>v===0)) break;
      }
    }
    // Apply a floor and assign to destination <col> style.width, with higher minimum for custom columns
    for(let i=0;i<widths.length;i++){
      const col = dstCols[i];
      if(!col) continue;
      
      // Check if this is a custom column by looking at corresponding header
      let isCustomCol = false;
      try {
        const headerRow = dstTbl.querySelector('tr.row.title2') || dstTbl.querySelector('tr.row.title1');
        if(headerRow) {
          const headers = Array.from(headerRow.querySelectorAll('th.cell'));
          if(headers[i] && headers[i].classList.contains('cc-header')) {
            isCustomCol = true;
          }
        }
      } catch(_) {}
      
      const minWidth = isCustomCol ? 80 : 40; // Custom columns get higher minimum
      const px = Math.max(minWidth, widths[i] || 0);
      col.style.width = px + 'px';
    }
    // Enforce fixed layout so widths render consistently in the export
    dstTbl.style.tableLayout = 'fixed';
    dstTbl.style.width = 'auto';
    dstTbl.style.maxWidth = '100%';
  }
  // Freeze widths before stripping interactive bits
  try{ freezeChartColumnWidthsInClone(render, clone); }catch(_){ /* non-fatal */ }
  // Keep column resizers in export so users can continue adjusting widths
  // Ensure destination table is marked as resizable for any styling hooks (optional)
  const dstTblForFlag = clone.querySelector('table.chartshell');
  if (dstTblForFlag) {
    dstTblForFlag.setAttribute('data-resizable', '1');
    // Drop compact print styling in exported snapshot; users can still toggle via CSS if desired
    dstTblForFlag.classList.remove('print-compact');
  }
  if(prologueNode){
    content += prologueNode.outerHTML; // put prologue first
    const cPrologue = clone.querySelector(':scope > .chart-prologue');
    if(cPrologue) cPrologue.remove(); // remove from rest of content
  }
  content += clone.innerHTML;

  // Epilogue: the live preview already carries it; add it only if that block is missing.
  if(!clone.querySelector(':scope > .chart-epilogue')){
    const { html: postHtml, autoConvert } = loadPostloguePrefs();
    if(postHtml && postHtml.trim()) content += `\n<div class="chart-epilogue">${plainTextToHtml(postHtml, autoConvert)}</div>`;
  }

  const exportTitle = getExportTitleFromPrologue();
  // Collect all current styles from <head> including any injected at runtime
  function collectCurrentHeadCSS(){
    let css = '';
    // Inline <style> tags in order
    document.head.querySelectorAll('style').forEach((s, idx)=>{
      const label = s.id ? `style#${s.id}` : `style[${idx}]`;
      const txt = s.textContent || '';
      if(txt) css += `\n/* ${label} */\n` + txt + '\n';
    });
    // Attempt to inline same-origin linked stylesheets (unchanged; include all rules)
    Array.from(document.styleSheets || []).forEach(ss => {
      try{
        if(ss && ss.ownerNode && ss.ownerNode.tagName === 'LINK' && ss.cssRules){
          css += `\n/* linked stylesheet: ${ss.href || ''} */\n`;
          for(const rule of ss.cssRules){ css += rule.cssText + '\n'; }
        }
      }catch(e){ /* likely a cross-origin stylesheet; skip */ }
    });
    return css.trim();
  }
  const headCSS = collectCurrentHeadCSS();
  const savedFreeze = loadJSON(FREEZE_HEADERS_KEY);
  const freezeEnabled = !!(savedFreeze && savedFreeze.enabled);
  // Free translation inline style variables for export
  let ftVarsCSS = '';
  try{
    const ftp = loadJSON(FT_PREFS_KEY) || {};
    const st = ftp.style || {};
    const vars = [];
    if(st.fontSize) vars.push(`--ft-inline-font-size: ${st.fontSize}`);
    if(st.color) vars.push(`--ft-inline-color: ${st.color}`);
    if(st.bg) vars.push(`--ft-inline-bg: ${st.bg}`);
    if(vars.length){ ftVarsCSS = `:root{ ${vars.join('; ')}; }`; }
  }catch(e){ console.error(e); }
  // Add minimal sticky header CSS to ensure freeze works even if outer CSS is pruned
  const stickyCSS = `
  .chartshell.freeze-headers thead tr.row.title1 th,
  .chartshell.freeze-headers thead tr.row.title2 th{position:sticky;z-index:3;background:#fff}
  .chartshell.freeze-headers thead tr.row.title1 th{top:var(--tc-sticky-top-1,0px)}
  .chartshell.freeze-headers thead tr.row.title2 th{top:var(--tc-sticky-top-2,32px);z-index:4}
  .chartshell-sticky-spacer{height:var(--tc-sticky-spacer,0px)}
  /* Custom columns export styling */
  .cc-cell{ min-width: 80px; word-wrap: break-word; }
  .cc-header{ min-width: 80px; }
  .cc-edit{ min-width: 70px; padding: 4px 6px; word-wrap: break-word; border: 1px solid #e5e7eb; border-radius: 6px; }
  `;
  // Optional export toolbar markup
  const exportToolbar = opts.includeToolbar ? (
    '<div class="export-toolbar" role="region" aria-label="Export toolbar" style="position:sticky;top:0;z-index:1000;background:#f7faff;border-bottom:1px solid #dbe7ff;padding:8px 10px;display:flex;gap:8px;align-items:center;box-shadow:0 1px 0 rgba(0,0,0,0.03)">\
      <button id="exportSaveBtn" style="background:#0b6edb;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer">Save Chart As… (HTML)</button>\
      <button id="exportPrintBtn" style="background:#ddd;color:#111;border:none;padding:6px 10px;border-radius:6px;cursor:pointer">Print / Export to PDF</button>\
      <div class="small-muted" style="margin-left:auto;color:#666">Toolbar is not printed</div>\
    </div>'
  ) : '';
  const doc = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(exportTitle)}</title>
${freezeEnabled ? '<meta name="flex-freeze-headers" content="1" />' : ''}
<style>${headCSS}\n${stickyCSS}
/* Hide export toolbar in print */
@media print { .export-toolbar { display: none !important; } }
${ftVarsCSS}
</style>
</head>
<body>
${exportToolbar}
${content}
<script>
  // Persisted freeze headers behavior from source document
  (function(){
    function computeStickyOffsets(){
      const tbl = document.querySelector('table.chartshell');
      if(!tbl) return;
      const head = tbl.querySelector('thead');
      const r1 = head?.querySelector('tr.row.title1');
      const r2 = head?.querySelector('tr.row.title2');
      const rect1 = r1?.getBoundingClientRect();
      const rect2 = r2?.getBoundingClientRect();
      // Offset by export toolbar height so sticky headers stay below it
      const toolbar = document.querySelector('.export-toolbar');
      const topBase = toolbar ? Math.ceil(toolbar.getBoundingClientRect().height || 0) : 0;
      const h1 = rect1 ? Math.ceil(rect1.height) : 0;
      const h2 = rect2 ? Math.ceil(rect2.height) : 0;
      document.documentElement.style.setProperty('--tc-sticky-top-1', topBase + 'px');
      document.documentElement.style.setProperty('--tc-sticky-top-2', (topBase + h1) + 'px');
      document.documentElement.style.setProperty('--tc-sticky-spacer', (h1 + h2) + 'px');
    }
    function applyFreezeHeaders(){
      const tbl = document.querySelector('table.chartshell');
      if(!tbl) return;
      tbl.classList.add('freeze-headers');
      const wrapper = tbl.closest('.chartshell-wrapper') || tbl.parentElement;
      let spacer = wrapper?.querySelector(':scope > .chartshell-sticky-spacer');
      if(!spacer){ spacer = document.createElement('div'); spacer.className = 'chartshell-sticky-spacer'; if(wrapper) wrapper.insertBefore(spacer, tbl); else tbl.parentElement?.insertBefore(spacer, tbl); }
      computeStickyOffsets();
  window.addEventListener('resize', computeStickyOffsets);
  window.addEventListener('scroll', computeStickyOffsets, true);
    }
    // Read preference from embedded data attribute if present
    const root = document.documentElement;
    const shouldFreeze = (function(){
      try{
        const meta = document.querySelector('meta[name="flex-freeze-headers"]');
        return meta && meta.getAttribute('content') === '1';
      }catch(_){ return false; }
    })();
    if(shouldFreeze){
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', applyFreezeHeaders);
      else applyFreezeHeaders();
      // One more pass after load to account for toolbar height
      window.addEventListener('load', computeStickyOffsets);
      setTimeout(computeStickyOffsets, 50);
      setTimeout(computeStickyOffsets, 200);
    }
  })();
  // Re-enable column resizing for Text Chart in exported document
  (function(){
    function wireHandleDrag(handle, allCols){
      let startX = 0, startWidth = 0, colEl = null;
      function computeMinColWidth(tbl, idx){
        let minW = 40;
        const rows = Array.from(tbl.querySelectorAll('tbody tr')).slice(0, 200);
        rows.forEach(row=>{
          let ci = 0; let cell = null;
          Array.from(row.children).some(td=>{
            const sp = Number(td.getAttribute('colspan')||'1');
            const covers = (idx >= ci) && (idx < ci + sp);
            ci += sp; if(covers){ cell = td; return true; } return false;
          });
          if(cell){
            let pairs = cell.querySelectorAll('.interlinear .pair:not(.note)');
            if(!pairs.length) pairs = cell.querySelectorAll('.interlinear .pair');
            pairs.forEach(p=>{ const w = Math.ceil(p.getBoundingClientRect().width); if(w > minW) minW = w; });
          }
        });
        return Math.max(40, minW);
      }
      function onMove(e){
        const dx = e.clientX - startX;
        const tbl = handle.closest('table');
        const idx = Number(handle.dataset.colEnd||'0');
        const minAllowed = computeMinColWidth(tbl, idx);
        const newW = Math.max(minAllowed, startWidth + dx);
        colEl.style.width = newW + 'px';
        handle.classList.add('dragging');
      }
      function onUp(){
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        handle.classList.remove('dragging');
      }
      handle.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        const idx = Number(handle.dataset.colEnd||'0');
        colEl = allCols[idx];
        if(!colEl) return;
        const tbl = handle.closest('table');
        const bodyRow = tbl.querySelector('tbody tr');
        let probeCell = null;
        if(bodyRow){
          let ci = 0; probeCell = Array.from(bodyRow.children).find(td=>{
            const sp = Number(td.getAttribute('colspan')||'1');
            const covers = (idx >= ci) && (idx < ci + sp);
            ci += sp; return covers;
          });
        }
        const rect = (probeCell || handle.parentElement).getBoundingClientRect();
        if(!colEl.style.width){ colEl.style.width = Math.max(40, Math.round(rect.width)) + 'px'; }
        startX = e.clientX;
        startWidth = parseFloat(colEl.style.width) || Math.max(40, Math.round(rect.width));
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
    function initExportResizing(){
      const tbl = document.querySelector('table.chartshell');
      if(!tbl) return;
      // Ensure fixed layout and individual cols
      tbl.style.tableLayout = 'fixed';
      tbl.style.width = 'auto';
      tbl.style.maxWidth = '100%';
      const groups = Array.from(tbl.querySelectorAll('colgroup'));
      const allCols = groups.flatMap(g => Array.from(g.querySelectorAll('col')));
      // Re-wire existing handles
      tbl.querySelectorAll('.col-resizer').forEach(h => wireHandleDrag(h, allCols));
      tbl.setAttribute('data-resizable', '1');
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initExportResizing);
    else initExportResizing();
  })();
  // Endnote HTML tooltip wiring (exported doc)
  (function(){
    let tipEl = null; let hideTimer = null;
    function ensureTip(){ if(!tipEl){ tipEl = document.createElement('div'); tipEl.className = 'note-tooltip'; const arrow = document.createElement('div'); arrow.className='arrow'; tipEl.appendChild(arrow); document.body.appendChild(tipEl); } return tipEl; }
    function setTipContent(html){ const arrow = tipEl.querySelector('.arrow'); tipEl.innerHTML=''; tipEl.appendChild(arrow); const box = document.createElement('div'); box.innerHTML = html; tipEl.appendChild(box); }
    function positionTipFor(target, evt){
      const rect = target.getBoundingClientRect();
      const margin = 8; const arrow = tipEl.querySelector('.arrow');
      tipEl.style.visibility='hidden'; tipEl.style.display='block';
      const vw = window.innerWidth, vh = window.innerHeight;
      const tipW = Math.min(400, tipEl.offsetWidth || 0), tipH = tipEl.offsetHeight || 0;
      let top = rect.bottom + margin; let left = rect.left;
      if(evt && typeof evt.clientX==='number'){ left = evt.clientX + 12; }
      if(top + tipH > vh - margin){ top = Math.max(margin, rect.top - tipH - margin); }
      left = Math.max(margin, Math.min(left, vw - tipW - margin));
  tipEl.style.top = Math.round(top) + 'px';
  tipEl.style.left = Math.round(left) + 'px';
  const aSize = 10; arrow.style.width = aSize + 'px'; arrow.style.height = aSize + 'px';
  const arrowTop = (top >= rect.bottom) ? (tipEl.offsetHeight - 1) : (-aSize/2);
  arrow.style.top = arrowTop + 'px';
  const centerX = rect.left + rect.width/2; const ax = Math.max(aSize, Math.min(centerX - left - aSize/2, tipW - 2*aSize));
  arrow.style.left = ax + 'px';
      tipEl.style.visibility='visible';
    }
    function showTip(link, evt){
      clearTimeout(hideTimer);
      const contentEl = (link.parentElement && (link.parentElement.querySelector('.note-tooltip-content') || link.parentElement.querySelector('.ft-tooltip-content')));
      if(!contentEl) return;
      ensureTip(); setTipContent(contentEl.innerHTML); positionTipFor(link, evt);
    }
    function scheduleHide(){ clearTimeout(hideTimer); hideTimer = setTimeout(()=>{ if(tipEl) tipEl.style.display='none'; }, 200); }
    function cancelHide(){ clearTimeout(hideTimer); }
    function wire(){
      const links = Array.from(document.querySelectorAll('.note-link, .ft-link'));
      links.forEach(l=>{
        l.addEventListener('mouseenter', (e)=>{ cancelHide(); showTip(l, e); });
        l.addEventListener('mousemove', (e)=>{ if(tipEl && tipEl.style.display!=='none'){ positionTipFor(l, e); } });
        l.addEventListener('mouseleave', scheduleHide);
        l.addEventListener('focus', (e)=>{ cancelHide(); showTip(l, e); });
        l.addEventListener('blur', scheduleHide);
      });
      document.addEventListener('scroll', ()=>{ if(tipEl) tipEl.style.display='none'; }, true);
      window.addEventListener('resize', ()=>{ if(tipEl){ tipEl.style.display='none'; } });
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();
  })();
  // Export toolbar handlers (save and print)
  (function(){
    function suggestExportFilename(){
      try{
        var titleNode = document.querySelector('.chart-prologue h1, .chart-prologue h2, .chart-prologue h3, .chart-prologue div, .chart-prologue p');
        var t = (titleNode && titleNode.textContent || '').trim().replace(/\s+/g,' ');
        var base = t || 'FDAT Discourse Chart';
        var name = base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g,' ').trim();
        if(!/\.html?$/i.test(name)) name += '.html';
        return name;
      }catch(_){ return 'FDAT Discourse Chart.html'; }
    }
    function saveAsHtml(){
      try{
        var html = document.documentElement.outerHTML;
        var filename = suggestExportFilename();
        if(window.showSaveFilePicker){
          (async function(){
            try{
              const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'HTML Document', accept: { 'text/html': ['.html', '.htm'] } }] });
              const writable = await handle.createWritable();
              await writable.write(new Blob([html], {type:'text/html'}));
              await writable.close();
            }catch(err){ if(!(err && err.name==='AbortError')) fallbackDownload(html, filename); }
          })();
        } else {
          fallbackDownload(html, filename);
        }
      }catch(e){ console.warn('Save as HTML failed:', e); }
    }
    function fallbackDownload(html, filename){
      var blob = new Blob([html], {type:'text/html'});
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    }
    function printNow(){ try{ window.focus(); window.print(); }catch(_){ /* ignore */ } }
    var saveBtn = document.getElementById('exportSaveBtn'); if(saveBtn) saveBtn.addEventListener('click', saveAsHtml);
    var printBtn = document.getElementById('exportPrintBtn'); if(printBtn) printBtn.addEventListener('click', printNow);
  })();
<\/script>
</body>
</html>`;
  return doc;
}

/* ===== Column resizing for Text Chart in-app ===== */
function expandColgroupsToIndividualCols(tbl){
  const groups = Array.from(tbl.querySelectorAll('colgroup'));
  groups.forEach(g=>{
    const c = g.querySelector('col');
    if(!c) return;
    const span = Number(c.getAttribute('span')||'1');
    if(span > 1){
      c.removeAttribute('span');
      const frag = document.createDocumentFragment();
      for(let i=0;i<span;i++) frag.appendChild(document.createElement('col'));
      g.replaceChild(frag, c);
    }
  });
}
function addResizeHandles(tbl){
  const header2 = tbl.querySelector('tr.row.title2');
  const header = header2 || tbl.querySelector('tr.row.title1');
  if(!header) return;
  let colIndex = 0;
  const groups = Array.from(tbl.querySelectorAll('colgroup'));
  const allCols = groups.flatMap(g => Array.from(g.querySelectorAll('col')));
  header.querySelectorAll('th.cell').forEach(th=>{
    const span = Number(th.getAttribute('colspan')||'1');
    const targetColEnd = colIndex + span - 1;
    const handle = document.createElement('div');
    handle.className = 'col-resizer';
    handle.title = 'Drag to resize column';
    handle.dataset.colEnd = String(targetColEnd);
    th.appendChild(handle);
    wireHandleDrag(handle, allCols);
    colIndex += span;
  });
}
function wireHandleDrag(handle, allCols){
  let startX = 0, startWidth = 0, colEl = null;
    function computeMinColWidth(tbl, idx){
      let minW = 40;
      const rows = Array.from(tbl.querySelectorAll('tbody tr')).slice(0, 200);
      rows.forEach(row=>{
        let ci = 0; let cell = null;
        Array.from(row.children).some(td=>{
          const sp = Number(td.getAttribute('colspan')||'1');
          const covers = (idx >= ci) && (idx < ci + sp);
          ci += sp; if(covers){ cell = td; return true; } return false;
        });
        if(cell){
          let pairs = cell.querySelectorAll('.interlinear .pair:not(.note)');
          if(!pairs.length) pairs = cell.querySelectorAll('.interlinear .pair');
          pairs.forEach(p=>{ const w = Math.ceil(p.getBoundingClientRect().width); if(w > minW) minW = w; });
        }
      });
      return Math.max(40, minW);
    }
  function onMove(e){
    const dx = e.clientX - startX;
      const tbl = handle.closest('table');
      const idx = Number(handle.dataset.colEnd||'0');
      const minAllowed = computeMinColWidth(tbl, idx);
      const newW = Math.max(minAllowed, startWidth + dx);
    colEl.style.width = newW + 'px';
    handle.classList.add('dragging');
  }
  function onUp(){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    handle.classList.remove('dragging');
  }
  handle.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    const idx = Number(handle.dataset.colEnd||'0');
    colEl = allCols[idx];
    if(!colEl) return;
    const tbl = handle.closest('table');
    const bodyRow = tbl.querySelector('tbody tr');
    let probeCell = null;
    if(bodyRow){
      let ci = 0; probeCell = Array.from(bodyRow.children).find(td=>{
        const sp = Number(td.getAttribute('colspan')||'1');
        const covers = (idx >= ci) && (idx < ci + sp);
        ci += sp; return covers;
      });
    }
    const rect = (probeCell || handle.parentElement).getBoundingClientRect();
    if(!colEl.style.width){ colEl.style.width = Math.max(40, Math.round(rect.width)) + 'px'; }
    startX = e.clientX;
    startWidth = parseFloat(colEl.style.width) || Math.max(40, Math.round(rect.width));
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
function enableTextChartColumnResize(root){
  const tbl = (root instanceof Element ? root : document).querySelector('table.chartshell');
  if(!tbl || tbl.dataset.resizable === '1') return;
  expandColgroupsToIndividualCols(tbl);
  addResizeHandles(tbl);
  tbl.dataset.resizable = '1';
    tbl.style.tableLayout = 'fixed';
    tbl.style.width = 'auto';
    tbl.style.maxWidth = '100%';
}

/* ===== Endnote tooltip (HTML) ===== */
(function(){
  let tipEl = null; let hideTimer = null;
  function ensureTip(){ if(!tipEl){ tipEl = document.createElement('div'); tipEl.className = 'note-tooltip'; const arrow = document.createElement('div'); arrow.className='arrow'; tipEl.appendChild(arrow); document.body.appendChild(tipEl); } return tipEl; }
  function setTipContent(html){ const arrow = tipEl.querySelector('.arrow'); tipEl.innerHTML=''; tipEl.appendChild(arrow); const box = document.createElement('div'); box.innerHTML = html; tipEl.appendChild(box); }
  function positionTipFor(target, evt){
    const rect = target.getBoundingClientRect();
    const margin = 8; const arrow = tipEl.querySelector('.arrow');
    tipEl.style.visibility='hidden'; tipEl.style.display='block';
    const vw = window.innerWidth, vh = window.innerHeight;
    const tipW = Math.min(400, tipEl.offsetWidth || 0), tipH = tipEl.offsetHeight || 0;
    let top = rect.bottom + margin; let left = rect.left;
    if(evt && typeof evt.clientX==='number'){ left = evt.clientX + 12; }
    // if overflow bottom, place above
    if(top + tipH > vh - margin){ top = Math.max(margin, rect.top - tipH - margin); }
    // clamp horizontally
    left = Math.max(margin, Math.min(left, vw - tipW - margin));
    tipEl.style.top = `${Math.round(top)}px`;
    tipEl.style.left = `${Math.round(left)}px`;
    // arrow placement
    const aSize = 10; arrow.style.width=`${aSize}px`; arrow.style.height=`${aSize}px`;
    const arrowTop = (top >= rect.bottom) ? (tipEl.offsetHeight - 1) : (-aSize/2);
    arrow.style.top = `${arrowTop}px`;
    const centerX = rect.left + rect.width/2; const ax = Math.max(aSize, Math.min(centerX - left - aSize/2, tipW - 2*aSize));
    arrow.style.left = `${ax}px`;
    tipEl.style.visibility='visible';
  }
  function showTip(link, evt){
    clearTimeout(hideTimer);
    const contentEl = link.parentElement?.querySelector('.note-tooltip-content') || link.parentElement?.querySelector('.ft-tooltip-content');
    if(!contentEl) return;
    const html = contentEl.innerHTML;
    ensureTip(); setTipContent(html); positionTipFor(link, evt);
  }
  function scheduleHide(){ clearTimeout(hideTimer); hideTimer = setTimeout(()=>{ if(tipEl) tipEl.style.display='none'; }, 200); }
  function cancelHide(){ clearTimeout(hideTimer); }
  // Idempotent: links already wired (data-tip-wired) are skipped, so this can run after every DOM update.
  function wire(container){
    if(!container) return;
    container.querySelectorAll('.note-link, .ft-link').forEach(l=>{
      if(l.dataset.tipWired === '1') return;
      l.dataset.tipWired = '1';
      l.addEventListener('mouseenter', (e)=>{ cancelHide(); showTip(l, e); });
      l.addEventListener('mouseleave', scheduleHide);
      l.addEventListener('mousemove', (e)=>{ if(tipEl && tipEl.style.display!=='none'){ positionTipFor(l, e); } });
      l.addEventListener('focus', (e)=>{ cancelHide(); showTip(l, e); });
      l.addEventListener('blur', scheduleHide);
    });
  }
  document.addEventListener('scroll', ()=>{ if(tipEl) tipEl.style.display='none'; }, true);
  window.addEventListener('resize', ()=>{ if(tipEl){ tipEl.style.display='none'; } });
  // Global hook used by the render flow after DOM updates
  window.wireNoteTooltips = function(){ try{ wire(byId('renderArea')); }catch(_){} };
})();

/* ===== Free translations feature ===== */
function showFTPanel(show){ const p = byId('ftPanel'); if(p) p.style.display = show ? 'block' : 'none'; }
function initFTControls(){
  const panel = byId('ftPanel'); if(!panel) return;
  const modeSel = byId('ftMode'); const clearAll = byId('ftClearAll');
  const fontSizeIn = byId('ftFontSize'); const colorIn = byId('ftColor'); const bgIn = byId('ftBg');
  const prefs = loadFTPrefs();
  if(modeSel) modeSel.value = prefs.mode || 'tooltip';
  if(fontSizeIn) fontSizeIn.value = prefs.style?.fontSize || '';
  if(colorIn) colorIn.value = prefs.style?.color || '#333333';
  if(bgIn) bgIn.value = prefs.style?.bg || '#fbfcff';
  if(panel.dataset.wired === '1') return;
  panel.dataset.wired = '1';
  function onModeChange(){ const p = loadFTPrefs(); p.mode = modeSel.value; saveFTPrefs(p); const area = byId('renderArea'); applyFreeTranslationsToArea(area); }
  modeSel?.addEventListener('change', onModeChange);
  function onStyleChange(){
    const p = loadFTPrefs(); p.style = p.style || {};
    p.style.fontSize = (fontSizeIn?.value || '').trim();
    p.style.color = (colorIn?.value || '').trim();
    p.style.bg = (bgIn?.value || '').trim();
    // cleanup empties
    if(!p.style.fontSize) delete p.style.fontSize;
    if(!p.style.color) delete p.style.color;
    if(!p.style.bg) delete p.style.bg;
    saveFTPrefs(p);
    const area = byId('renderArea'); applyFreeTranslationsToArea(area);
  }
  fontSizeIn?.addEventListener('change', onStyleChange);
  colorIn?.addEventListener('input', onStyleChange);
  bgIn?.addEventListener('input', onStyleChange);
  clearAll?.addEventListener('click', ()=>{
    if(!confirm('Clear all free translations for this chart?')) return;
    const p = loadFTPrefs(); p.items = {}; saveFTPrefs(p);
    const area = byId('renderArea'); applyFreeTranslationsToArea(area); wireFreeTranslationButtons(area);
  });
}
function computeRowLabelFromRow(tr){
  try{
    const rn = tr?.querySelector('td .interlinear .pair .w.rownum');
    const t = rn?.textContent?.trim();
    if(t) return t;
  }catch(e){ console.error('Error computing row label from row:', e); }
  // fallback: sequence number among body rows (1-based)
  try{
    const all = Array.from(tr.parentElement?.querySelectorAll(':scope > tr') || []).filter(r=> !r.classList.contains('title1') && !r.classList.contains('title2') && !r.classList.contains('ft-inline'));
    const idx = all.indexOf(tr);
    return String(idx + 1);
  }catch(e){ console.error('Error in computeRowLabelFromRow:', e); return ''; }
}
function computeTotalColumns(tbl){
  const colCount = tbl.querySelectorAll('colgroup col').length;
  if(colCount > 0) return colCount;
  const ths = tbl.querySelectorAll('thead tr.row.title1 th');
  if(ths && ths.length){ let sum = 0; ths.forEach(th=>{ sum += Number(th.getAttribute('colspan')||'1'); }); return sum; }
  // fallback: count cells in first body row
  const r = tbl.querySelector('tbody tr'); if(r){ let sum=0; r.querySelectorAll(':scope > *').forEach(c=> sum += Number(c.getAttribute('colspan')||'1')); return sum; }
  return 1;
}
function wireFreeTranslationButtons(area){
  const tbl = area?.querySelector('table.chartshell'); if(!tbl) return;
  // Remove any existing buttons first
  tbl.querySelectorAll('.add-trans-btn').forEach(b=> b.remove());
  const prefs = loadFTPrefs(); const items = prefs.items || {};
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
    if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
    const firstCell = tr.querySelector('td'); if(!firstCell) return;
    const rownumSpan = firstCell.querySelector('.interlinear .pair .w.rownum');
    if(!rownumSpan) return;
  const label = computeRowLabelFromRow(tr);
    const btn = document.createElement('button');
    btn.type='button'; btn.className='add-trans-btn'; btn.textContent = items[label] ? 'Edit trans…' : 'Add trans…';
    btn.title = 'Add or edit free translation for this row';
    btn.addEventListener('click', async ()=>{
  const pcur = loadFTPrefs();
  const current = (pcur.items||{})[label] || '';
      const next = await showFTEditor('Free translation — row ' + label, current);
      if(next === null) return; // cancelled
  const p = loadFTPrefs(); p.items = p.items || {}; const val = (next||'').trim();
  if(val){ p.items[label] = val; } else { delete p.items[label]; }
      saveFTPrefs(p);
      btn.textContent = (val ? 'Edit trans…' : 'Add trans…');
      applyFreeTranslationsToArea(area);
    });
    rownumSpan.parentElement?.appendChild(btn);
  });
}

// Simple modal text editor used for Free Translations
function showFTEditor(title, initial){
  return new Promise(resolve=>{
    const overlay = document.createElement('div'); overlay.className='modal-overlay';
    const modal = document.createElement('div'); modal.className='modal'; overlay.appendChild(modal);
    const h = document.createElement('h3'); h.textContent = title || 'Free translation'; modal.appendChild(h);
    const ta = document.createElement('textarea'); ta.value = initial || ''; modal.appendChild(ta);
    const actions = document.createElement('div'); actions.className='modal-actions'; modal.appendChild(actions);
    const cancel = document.createElement('button'); cancel.className='secondary'; cancel.textContent='Cancel';
    const save = document.createElement('button'); save.textContent='Save';
    actions.appendChild(cancel); actions.appendChild(save);
    function done(val){ document.body.removeChild(overlay); resolve(val); }
    cancel.addEventListener('click', ()=> done(null));
    save.addEventListener('click', ()=> done(ta.value));
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) done(null); });
    ta.addEventListener('keydown', (e)=>{ if(e.key==='Escape') done(null); if((e.metaKey||e.ctrlKey)&&e.key==='Enter') done(ta.value); });
    document.body.appendChild(overlay); ta.focus(); ta.select();
  });
}
function clearExistingFTArtifacts(area){
  if(!area) area = byId('renderArea'); if(!area) return;
  // Remove inline rows
  area.querySelectorAll('tr.ft-inline').forEach(r=> r.remove());
  // Remove link markers and tooltip content
  area.querySelectorAll('.ft-link').forEach(a=>{ const p=a.parentElement; const sib = p?.querySelector('.ft-tooltip-content'); a.remove(); if(sib) sib.remove(); });
  // Remove appended section
  area.querySelectorAll(':scope > .chart-freetrans').forEach(n=> n.remove());
}
function applyFT_TooltipMode(area, tbl, items){
  // Insert link markers by row number
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
    if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
    const label = computeRowLabelFromRow(tr); const text = items[label]; if(!text) return;
    const firstCell = tr.querySelector('td'); if(!firstCell) return;
  const rownumSpan = firstCell.querySelector('.interlinear .pair .w.rownum'); if(!rownumSpan) return;
  // ensure a stable back-link anchor on the row number
  if(!rownumSpan.id) rownumSpan.id = 'row-' + label + '-ftsrc';
    // avoid duplicates
    if(rownumSpan.parentElement?.querySelector('.ft-link')) return;
    const a = document.createElement('a'); a.className='ft-link'; a.href = '#ft-' + CSS.escape(label);
    const sup = document.createElement('sup'); sup.textContent='T'; a.appendChild(sup);
    const tip = document.createElement('div'); tip.className='ft-tooltip-content'; tip.style.display='none'; tip.textContent = text;
    rownumSpan.parentElement?.appendChild(a);
    rownumSpan.parentElement?.appendChild(tip);
  });
  // Build section before Notes
  const wrap = document.createElement('div'); wrap.className='chart-freetrans';
  const h = document.createElement('h3'); h.textContent='Free translations'; wrap.appendChild(h);
  // Render FT items in row order by scanning rows and using GUID lookup
  const rowOrder = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('title1') && !r.classList.contains('title2') && !r.classList.contains('ft-inline'));
  rowOrder.forEach(tr=>{
    const label = computeRowLabelFromRow(tr); const text = items[label]; if(!text) return;
    const item = document.createElement('div'); item.className='ft-item'; item.id = 'ft-' + label;
    const lab = document.createElement('div'); lab.className='ft-label';
    const back = document.createElement('a'); back.href = '#row-' + label + '-ftsrc'; back.textContent = label; // back to row number
    lab.appendChild(back);
    const body = document.createElement('div'); body.textContent = text;
    item.appendChild(lab); item.appendChild(body); wrap.appendChild(item);
  });
  // Insert wrap after table, before .chart-endnotes if present
  const areaRoot = byId('renderArea');
  const tableWrap = areaRoot.querySelector('table.chartshell')?.closest('.chartshell-wrapper') || areaRoot.querySelector('table.chartshell');
  const notes = areaRoot.querySelector(':scope > .chart-endnotes');
  if(notes) areaRoot.insertBefore(wrap, notes); else if(tableWrap){ if(tableWrap.nextSibling) areaRoot.insertBefore(wrap, tableWrap.nextSibling); else areaRoot.appendChild(wrap); }
  // rewire tooltip handlers for newly added links
  if(window.wireNoteTooltips){ try{ window.wireNoteTooltips(); }catch(_){} }
}
function applyFT_InlineMode(area, tbl, items){
  const total = computeTotalColumns(tbl);
  // Apply CSS variables for inline styling from prefs
  try{
    const p = loadFTPrefs(); const st = p.style || {};
    const root = tbl.closest('.viewer') || document.documentElement;
    if(st.fontSize) root.style.setProperty('--ft-inline-font-size', st.fontSize); else root.style.removeProperty('--ft-inline-font-size');
    if(st.color) root.style.setProperty('--ft-inline-color', st.color); else root.style.removeProperty('--ft-inline-color');
    if(st.bg) root.style.setProperty('--ft-inline-bg', st.bg); else root.style.removeProperty('--ft-inline-bg');
  }catch(_){ /* ignore */ }
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
    if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
    const label = computeRowLabelFromRow(tr); const text = items[label]; if(!text) return;
    const row = document.createElement('tr'); row.className='ft-inline';
    const td = document.createElement('td'); td.colSpan = total; const lab = document.createElement('span'); lab.className='ft-label'; lab.textContent = 'Free translation:'; td.appendChild(lab); const span = document.createElement('span'); span.textContent=' ' + text; td.appendChild(span); row.appendChild(td);
    if(tr.nextSibling) tr.parentElement.insertBefore(row, tr.nextSibling); else tr.parentElement.appendChild(row);
  });
}
function applyFreeTranslationsToArea(area){
  area = area || byId('renderArea'); if(!area) return;
  const tbl = area.querySelector('table.chartshell'); if(!tbl) return;
  clearExistingFTArtifacts(area);
  const prefs = loadFTPrefs(); const mode = prefs.mode || 'tooltip'; const items = prefs.items || {};
  if(mode === 'inline') applyFT_InlineMode(area, tbl, items);
  else applyFT_TooltipMode(area, tbl, items);
}

/* ===== Notes options controls ===== */
function loadNotesPrefs(){ const d = loadJSON(NOTES_PREFS_KEY) || {}; return { mode: d.mode || 'inline', width: d.width || '' }; }
function saveNotesPrefs(p){ saveJSON(NOTES_PREFS_KEY, p); }
function showNotesPanel(show){ const p = byId('notesPanel'); if(p) p.style.display = show ? 'block' : 'none'; }
function showCustomColsPanel(show){ const p = byId('customColsPanel'); if(p) p.style.display = show ? 'block' : 'none'; }
function initNotesControls(){
  const panel = byId('notesPanel');
  const modeSel = byId('notesMode'); const widthIn = byId('notesWidth');
  if(!panel || !modeSel || !widthIn) return;
  const prefs = loadNotesPrefs();
  modeSel.value = prefs.mode || 'inline';
  widthIn.value = prefs.width || '';
  if(panel.dataset.wired === '1') return;
  panel.dataset.wired = '1';
  const onChange = ()=>{
    saveNotesPrefs({ mode: modeSel.value, width: widthIn.value.trim() });
    // Notes handling is an XSL parameter, so re-run the transform if a chart is loaded
    const xmlText = byId('xmlInput').value.trim();
    if(xmlText){
      try{
        const dom = new DOMParser().parseFromString(xmlText, 'application/xml');
        if(!dom.querySelector('parsererror')) renderDocument(dom);
      }catch(_){/* ignore */}
    }
  };
  modeSel.addEventListener('change', onChange);
  widthIn.addEventListener('change', onChange);
  byId('notesReset')?.addEventListener('click', ()=>{ modeSel.value='inline'; widthIn.value=''; onChange(); });
}

/* ===== Salience Bands (row color coding) ===== */
function showSaliencePanel(show){ const p = byId('saliencePanel'); if(p) p.style.display = show ? 'block' : 'none'; }

// Section visibility functions
function showLanguageProjectsSection(show){ const p = byId('languageProjectsSection'); if(p) p.style.display = show ? 'block' : 'none'; }
function showTextGenresSection(show){ const p = byId('textGenresSection'); if(p) p.style.display = show ? 'block' : 'none'; }
function showDocumentPartsSection(show){ const p = byId('documentPartsSection'); if(p) p.style.display = show ? 'block' : 'none'; }

function loadSaliencePrefs(){
  const d = loadJSON(SALIENCE_PREFS_KEY) || {};
  return {
    enabled: d.enabled !== false,
    showLegend: d.showLegend !== false,
    showColumn: !!d.showColumn,
    cellOnly: !!d.cellOnly,
    opacity: (typeof d.opacity === 'number') ? d.opacity : 1,
    tree: Array.isArray(d.tree) ? d.tree : [],
    // assignments: map of rowGuid -> bandId; support legacy label keys and migrate lazily
    assignments: d.assignments || {}
  };
}
function saveSaliencePrefs(p){
  const out = {
    enabled: (typeof p.enabled === 'boolean') ? p.enabled : true,
    showLegend: (typeof p.showLegend === 'boolean') ? p.showLegend : true,
    showColumn: !!p.showColumn,
    cellOnly: !!p.cellOnly,
    opacity: (typeof p.opacity === 'number') ? p.opacity : 1,
    tree: Array.isArray(p.tree)?p.tree:[],
    // Keep assignments as-is; explicit delete flows (e.g., removeNode) will clean up invalid IDs
    assignments: p.assignments || {}
  };
  // Inherit colors: fill missing child colors from nearest ancestor on save
  (function inherit(list, parentColor){
    (list||[]).forEach(n=>{
      if(!n.color && parentColor) n.color = parentColor;
      inherit(n.children||[], n.color || parentColor);
    });
  })(out.tree, null);
  saveJSON(SALIENCE_PREFS_KEY, out);
}
function newSalNode(label){ return { id: 'sal_'+Date.now().toString(36)+'_'+Math.floor(Math.random()*1000), label: label||'Band', color: '#fffad1', children: [] }; }
function findNode(rootList, id){
  const stack = rootList.map((n,idx)=>({ node:n, parent:null, index:idx, list:rootList }));
  while(stack.length){ const cur = stack.pop(); if(cur.node.id===id) return cur; (cur.node.children||[]).forEach((c,i)=> stack.push({ node:c, parent:cur.node, index:i, list:cur.node.children })); }
  return null;
}
function computeSalienceNumbers(tree){
  const map = {};
  (function walk(list, prefix){
    (list||[]).forEach((n, i)=>{
      const num = prefix ? (prefix + '.' + (i+1)) : String(i+1);
      map[n.id] = num;
      walk(n.children||[], num);
    });
  })(tree||[], '');
  return map;
}
// Live state for the salience panels: display checkboxes are wired once and act on
// the prefs of the most recent render; the band tree editor is rebuilt per render.
const salienceUI = { prefs: null };
function saliencePersist(options){
  const prefs = salienceUI.prefs; if(!prefs) return;
  const mergeAssignments = !options || options.mergeAssignments !== false;
  if(mergeAssignments){
    try{
      const latest = loadSaliencePrefs();
      // Union storage and in-memory assignments to avoid clobbering recent row picks
      const curA = prefs.assignments || {};
      const latA = (latest && latest.assignments) || {};
      prefs.assignments = Object.assign({}, latA, curA);
      // Ensure tree is at least defined to avoid accidental pruning when an empty object is saved from elsewhere
      if(!Array.isArray(prefs.tree)){
        if(Array.isArray(latest.tree)) prefs.tree = latest.tree;
        else prefs.tree = [];
      }
    }catch(_){ /* ignore */ }
  }
  saveSaliencePrefs(prefs);
  refreshSalienceVisuals(byId('renderArea'));
}
function syncSalienceDisplayControls(prefs){
  const enabledCb = byId('salienceEnabled'); if(enabledCb) enabledCb.checked = !!prefs.enabled;
  const legendCb = byId('salienceShowLegend'); if(legendCb) legendCb.checked = !!prefs.showLegend;
  const colCb = byId('salienceShowColumn'); if(colCb) colCb.checked = !!prefs.showColumn;
  const cellOnlyCb = byId('salienceCellOnly'); if(cellOnlyCb) cellOnlyCb.checked = !!prefs.cellOnly;
  const opacityRange = byId('salienceOpacity'); if(opacityRange) opacityRange.value = String((typeof prefs.opacity==='number'?prefs.opacity:1));
}
function wireSalienceDisplayControls(){
  const panel = byId('salienceDisplayPanel'); if(!panel || panel.dataset.wired === '1') return;
  panel.dataset.wired = '1';
  byId('salienceEnabled')?.addEventListener('change', (e)=>{ salienceUI.prefs.enabled = !!e.target.checked; saliencePersist(); });
  byId('salienceShowLegend')?.addEventListener('change', (e)=>{ salienceUI.prefs.showLegend = !!e.target.checked; saliencePersist(); });
  byId('salienceShowColumn')?.addEventListener('change', (e)=>{ salienceUI.prefs.showColumn = !!e.target.checked; saliencePersist(); });
  byId('salienceCellOnly')?.addEventListener('change', (e)=>{ salienceUI.prefs.cellOnly = !!e.target.checked; saliencePersist(); });
  byId('salienceOpacity')?.addEventListener('input', (e)=>{ salienceUI.prefs.opacity = Number(e.target.value); saliencePersist(); });
}
function initSalienceControls(){
  const listHost = byId('salienceList'); if(!listHost) return;
  const addRootBtn = byId('salAddRoot');
  const clearAssignBtn = byId('salClearAssignments');
  const prefs = loadSaliencePrefs();
  salienceUI.prefs = prefs;
  syncSalienceDisplayControls(prefs);
  wireSalienceDisplayControls();
  const persist = saliencePersist;
  function removeNode(id){
    function rec(list){
      const idx = list.findIndex(x=> x.id===id);
      if(idx!==-1){ list.splice(idx,1); return true; }
      return list.some(n=> rec(n.children||[]));
    }
    rec(prefs.tree);
    // Remove assignments to this node and all descendants
    const toDelete = new Set(); (function collect(id){ const hit = findNode(prefs.tree, id); if(hit){ toDelete.add(hit.node.id); (hit.node.children||[]).forEach(c=> collect(c.id)); } })(id);
    Object.keys(prefs.assignments).forEach(row=>{ if(toDelete.has(prefs.assignments[row])) delete prefs.assignments[row]; });
  }
  function moveUp(id){ const loc = findNode(prefs.tree, id); if(!loc) return; const arr = loc.list; const i = loc.index; if(i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; persist(); render(); } }
  function moveDown(id){ const loc = findNode(prefs.tree, id); if(!loc) return; const arr = loc.list; const i = loc.index; if(i < arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; persist(); render(); } }
  function promote(id){
    const loc = findNode(prefs.tree, id); if(!loc || !loc.parent) return; // already root
    const parentLoc = findNode(prefs.tree, loc.parent.id);
    const grandList = parentLoc ? parentLoc.list : prefs.tree;
    // Remove from current list
    loc.list.splice(loc.index,1);
    // Insert after parent
    const parentIndex = grandList.indexOf(loc.parent);
    grandList.splice(parentIndex+1, 0, loc.node);
    persist(); render();
  }
  function demote(id){
    const loc = findNode(prefs.tree, id); if(!loc) return; const arr = loc.list; const i = loc.index; if(i<=0) return; // need a previous sibling
    const prev = arr[i-1]; prev.children = Array.isArray(prev.children) ? prev.children : [];
    // Remove from current and push into prev.children
    arr.splice(i,1); prev.children.push(loc.node);
    persist(); render();
  }
  function addChild(id){ const loc = findNode(prefs.tree, id); if(!loc) return; loc.node.children = Array.isArray(loc.node.children) ? loc.node.children : []; loc.node.children.push(newSalNode('Child')); persist(); render(); }
  function render(){
    const nums = computeSalienceNumbers(prefs.tree);
    listHost.innerHTML='';
    function renderList(list, level){
      const ul = document.createElement('ul'); ul.className='salience-tree'; if(level>0) ul.style.marginLeft = (level*16) + 'px';
      (list||[]).forEach((n)=>{
        const li = document.createElement('li'); li.className='sal-item';
    const num = document.createElement('span'); num.className='sal-num'; num.textContent = nums[n.id] || '';
  const color = document.createElement('input'); color.type='color'; color.value = n.color || (level>0 ? (findParentColor(prefs.tree, n.id)||'#fffad1') : '#fffad1'); color.title='Row background'; color.addEventListener('input', ()=>{ n.color=color.value; persist(); /* ensure all visuals sync immediately */ refreshSalienceVisuals(byId('renderArea')); });
        const colorSw = document.createElement('span'); colorSw.className='sal-color'; colorSw.style.background = color.value; color.addEventListener('input', ()=>{ colorSw.style.background=color.value; });
  const label = document.createElement('input'); label.type='text'; label.value = n.label || ''; label.placeholder='Label (e.g., secondary event line)'; label.addEventListener('input', ()=>{ n.label = label.value; persist(); refreshSalienceVisuals(byId('renderArea')); });
        const up = document.createElement('button'); up.className='sal-btn'; up.title='Move up'; up.textContent='↑'; up.addEventListener('click', ()=> moveUp(n.id));
        const down = document.createElement('button'); down.className='sal-btn'; down.title='Move down'; down.textContent='↓'; down.addEventListener('click', ()=> moveDown(n.id));
        const prom = document.createElement('button'); prom.className='sal-btn'; prom.title='Promote (outdent)'; prom.textContent='←'; prom.addEventListener('click', ()=> promote(n.id));
        const demo = document.createElement('button'); demo.className='sal-btn'; demo.title='Demote (indent)'; demo.textContent='→'; demo.addEventListener('click', ()=> demote(n.id));
        const add = document.createElement('button'); add.className='sal-btn'; add.title='Add sub-band'; add.textContent='＋'; add.addEventListener('click', ()=> addChild(n.id));
  const del = document.createElement('button'); del.className='sal-btn'; del.title='Delete band'; del.textContent='🗑'; del.addEventListener('click', ()=>{ if(confirm('Delete this band and any sub-bands?')){ removeNode(n.id); persist({ mergeAssignments: false }); render(); } });
        li.appendChild(num); li.appendChild(colorSw); li.appendChild(color); li.appendChild(label); li.appendChild(up); li.appendChild(down); li.appendChild(prom); li.appendChild(demo); li.appendChild(add); li.appendChild(del);
        ul.appendChild(li);
        if(n.children && n.children.length){ ul.appendChild(renderList(n.children, level+1)); }
      });
      return ul;
    }
    listHost.appendChild(renderList(prefs.tree, 0));
  }
  if(addRootBtn){ addRootBtn.onclick = ()=>{ prefs.tree.push(newSalNode('Band')); persist(); render(); }; }
  if(clearAssignBtn){ clearAssignBtn.onclick = ()=>{ if(confirm('Clear all row salience assignments?')){ prefs.assignments = {}; persist({ mergeAssignments: false }); render(); } }; }
  // First render
  render();
}
function findParentColor(tree, id){
  const loc = findNode(tree, id); if(!loc || !loc.parent) return null; return loc.parent.color || findParentColor(tree, loc.parent.id);
}
function buildSalienceOptions(){
  const prefs = loadSaliencePrefs(); const nums = computeSalienceNumbers(prefs.tree);
  const opts = [];
  (function walk(list){ (list||[]).forEach(n=>{ opts.push({ id:n.id, number: nums[n.id]||'', label: n.label||'', color: n.color||'#fffad1' }); walk(n.children||[]); }); })(prefs.tree||[]);
  return opts;
}
function showSaliencePicker(title, currentId){
  return new Promise(resolve=>{
    const overlay = document.createElement('div'); overlay.className='modal-overlay';
    const modal = document.createElement('div'); modal.className='modal'; overlay.appendChild(modal);
    const h = document.createElement('h3'); h.textContent = title || 'Select salience band'; modal.appendChild(h);
    const sel = document.createElement('select'); sel.style.width='100%'; sel.style.padding='8px'; sel.style.border='1px solid #e5e5e5'; sel.style.borderRadius='6px';
    const none = document.createElement('option'); none.value=''; none.textContent='(None)'; sel.appendChild(none);
    const opts = buildSalienceOptions();
    opts.forEach(o=>{ const opt = document.createElement('option'); opt.value=o.id; opt.textContent = `${o.number} — ${o.label || '(unnamed)'}`; if(currentId===o.id) opt.selected=true; sel.appendChild(opt); });
    modal.appendChild(sel);
    const actions = document.createElement('div'); actions.className='modal-actions'; modal.appendChild(actions);
    const cancel = document.createElement('button'); cancel.className='secondary'; cancel.textContent='Cancel';
    const save = document.createElement('button'); save.textContent='Save';
    actions.appendChild(cancel); actions.appendChild(save);
    function done(val){ document.body.removeChild(overlay); resolve(val); }
    cancel.addEventListener('click', ()=> done(null));
    save.addEventListener('click', ()=> done(sel.value || ''));
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) done(null); });
    document.body.appendChild(overlay);
  });
}
function wireSalienceButtons(area){
  const tbl = area?.querySelector('table.chartshell'); if(!tbl) return;
  // Remove any existing buttons first
  tbl.querySelectorAll('.add-band-btn').forEach(b=> b.remove());
  const prefs = loadSaliencePrefs();
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
    if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
    const firstCell = tr.querySelector('td'); if(!firstCell) return;
    const rownumSpan = firstCell.querySelector('.interlinear .pair .w.rownum'); if(!rownumSpan) return;
    const rowLabel = computeRowLabelFromRow(tr);
    const btn = document.createElement('button'); btn.type='button'; btn.className='add-band-btn';
    function setBtnText(){
      const a = (loadSaliencePrefs().assignments||{});
      const id = a[rowLabel];
      if(!id){ btn.textContent = 'Salience band…'; btn.title='Assign a salience band to this row'; }
      else {
        const opts = buildSalienceOptions(); const x = opts.find(o=>o.id===id);
        const num = x ? x.number : ''; const lab = x ? x.label : '';
        btn.textContent = num ? `Band ${num}` : 'Band'; btn.title = lab ? lab : 'Assigned band';
      }
    }
    setBtnText();
    btn.addEventListener('click', async ()=>{
  const prefs = loadSaliencePrefs(); const a = prefs.assignments||{}; const current = a[rowLabel] ?? '';
      const hasBands = (buildSalienceOptions().length > 0);
      if(!hasBands){
        if(confirm('No salience bands defined yet. Open Salience Bands panel to add one?')){
          // Expand the panel
          const panel = byId('saliencePanel'); const header = byId('salienceHeader');
          if(panel && header && panel.getAttribute('data-collapsed')==='1'){ header.click(); }
        }
        return;
      }
      const sel = await showSaliencePicker('Salience band — row '+rowLabel, current);
      if(sel === null) return; // cancelled
  const p = loadSaliencePrefs(); p.assignments = p.assignments || {};
  if(sel){ p.assignments[rowLabel] = sel; }
  else { delete p.assignments[rowLabel]; }
      saveSaliencePrefs(p);
      setBtnText();
      refreshSalienceVisuals(area);
    });
    rownumSpan.parentElement?.appendChild(btn);
  });
}
function updateSalienceButtons(area){
  const tbl = area?.querySelector('table.chartshell'); if(!tbl) return;
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
    if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
    const firstCell = tr.querySelector('td'); if(!firstCell) return;
    const rownumSpan = firstCell.querySelector('.interlinear .pair .w.rownum'); if(!rownumSpan) return;
    const rowLabel = computeRowLabelFromRow(tr);
    const btn = rownumSpan.parentElement?.querySelector('.add-band-btn'); if(!btn) return;
    const a = (loadSaliencePrefs().assignments||{}); const id = a[rowLabel];
    if(!id){ btn.textContent='Salience band…'; btn.title='Assign a salience band to this row'; }
    else { const opts = buildSalienceOptions(); const x = opts.find(o=>o.id===id); const num = x?x.number:''; const lab=x?x.label:''; btn.textContent = num?`Band ${num}`:'Band'; btn.title = lab||'Assigned band'; }
  });
}
function applySalienceBandsToArea(area){
  area = area || byId('renderArea'); if(!area) return;
  const tbl = area.querySelector('table.chartshell'); if(!tbl) return;
  // Clear previous coloring
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{
    if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return;
    Array.from(tr.children).forEach(td=>{ if(td.dataset.salApplied==='1'){ td.style.backgroundColor=''; delete td.dataset.salApplied; } });
  });
  const prefs = loadSaliencePrefs();
  if(!prefs.enabled){ return; }
  const idToColor = {}; (function walk(list){ (list||[]).forEach(n=>{ idToColor[n.id]=n.color||'#fffad1'; walk(n.children||[]); }); })(prefs.tree||[]);
  // Apply
  // Apply assignments by scanning rows to resolve GUIDs on the fly
  const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('title1') && !r.classList.contains('title2') && !r.classList.contains('ft-inline'));
  rows.forEach(tr=>{
    const label = computeRowLabelFromRow(tr);
    const bandId = prefs.assignments[label];
    const color = bandId ? idToColor[bandId] : null; if(!color) return;
    if(!tr) return;
    const bg = alphaColor(color, prefs.opacity);
    if(prefs.cellOnly){
      const cell = tr.querySelector(':scope > td[data-sal-col="1"]') || tr.firstElementChild;
      if(cell){ cell.style.backgroundColor = bg; cell.dataset.salApplied='1'; }
    } else {
      Array.from(tr.children).forEach(td=>{ td.style.backgroundColor = bg; td.dataset.salApplied='1'; });
    }
  });
  // Keep column cells in sync if present
  updateSalienceColumnCells(tbl);
}

/* ===== Hierarchical Settings UI Management ===== */
function initHierarchicalSettingsUI(){
  // Run migration first
  migrateToHierarchical();
  
  // Initialize language controls
  initLanguageControls();
  initGenreControls();
  initDocumentControls();
  
  // Update UI to reflect current context
  updateContextUI();
}

function initLanguageControls(){
  const select = byId('currentLanguageSelect');
  const nameInput = byId('languageName');
  const ethnoInput = byId('ethnologueCode');
  const addBtn = byId('addLanguageBtn');
  const editBtn = byId('editLanguageBtn');
  const exportBtn = byId('exportLanguageBtn');
  const importBtn = byId('importLanguageBtn');
  
  if(!select) return;
  
  // Populate language dropdown
  function updateLanguageList(){
    const settings = loadHierarchicalSettings();
    const ctx = loadCurrentContext();
    select.innerHTML = '<option value="">(Select a language)</option>';
    Object.values(settings.languages).forEach(lang=>{
      const opt = document.createElement('option');
      opt.value = lang.id;
      opt.textContent = lang.name || lang.id;
      if(ctx.languageId === lang.id) opt.selected = true;
      select.appendChild(opt);
    });
    updateLanguageInputs();
  }
  
  function updateLanguageInputs(){
    const lang = getCurrentLanguage();
    if(lang){
      nameInput.value = lang.name || '';
      ethnoInput.value = lang.ethnologueCode || '';
      nameInput.disabled = false;
      ethnoInput.disabled = false;
    } else {
      nameInput.value = '';
      ethnoInput.value = '';
      nameInput.disabled = true;
      ethnoInput.disabled = true;
    }
  }
  
  select.addEventListener('change', ()=>{
    const ctx = loadCurrentContext();
    ctx.languageId = select.value || null;
    // Reset genre and document when changing language
    ctx.genreId = null;
    ctx.documentId = null;
    saveCurrentContext(ctx);
    updateLanguageInputs();
    updateGenreList();
    updateDocumentList();
    refreshAllSettingsFromContext();
  });
  
  nameInput.addEventListener('change', ()=>{
    const settings = loadHierarchicalSettings();
    const ctx = loadCurrentContext();
    if(ctx.languageId && settings.languages[ctx.languageId]){
      settings.languages[ctx.languageId].name = nameInput.value.trim();
      saveHierarchicalSettings(settings);
      updateLanguageList();
    }
  });
  
  ethnoInput.addEventListener('change', ()=>{
    const settings = loadHierarchicalSettings();
    const ctx = loadCurrentContext();
    if(ctx.languageId && settings.languages[ctx.languageId]){
      settings.languages[ctx.languageId].ethnologueCode = ethnoInput.value.trim();
      saveHierarchicalSettings(settings);
    }
  });
  
  addBtn?.addEventListener('click', ()=>{
    const name = prompt('Enter language name:');
    if(!name) return;
    const id = 'lang_' + Date.now().toString(36);
    const settings = loadHierarchicalSettings();
    const lang = ensureLanguage(settings, id);
    lang.name = name.trim();
    // Create default genre
    const genreId = 'narrative';
    const genre = ensureGenre(lang, genreId);
    saveHierarchicalSettings(settings);
    setCurrentContext(id, genreId, null);
    updateLanguageList();
    updateGenreList();
  });
  
  editBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.languageId){
      alert('Please select a language first.');
      return;
    }
    nameInput.disabled = false;
    ethnoInput.disabled = false;
    nameInput.focus();
  });
  
  exportBtn?.addEventListener('click', ()=>{
    const settings = loadHierarchicalSettings();
    const ctx = loadCurrentContext();
    if(!ctx.languageId || !settings.languages[ctx.languageId]){
      alert('Please select a language first.');
      return;
    }
    const lang = settings.languages[ctx.languageId];
    const data = { language: lang };
    const filename = `fdat-language-${lang.name || ctx.languageId}-${new Date().toISOString().slice(0,10)}.json`;
    downloadJSON(filename, data);
  });
  
  importBtn?.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      try{
        const txt = await f.text();
        const data = JSON.parse(txt);
        if(!data.language || !data.language.id){
          alert('Invalid language export file.');
          return;
        }
        const settings = loadHierarchicalSettings();
        // Generate new ID to avoid conflicts
        const newId = 'lang_' + Date.now().toString(36);
        data.language.id = newId;
        settings.languages[newId] = data.language;
        saveHierarchicalSettings(settings);
        setCurrentContext(newId, null, null);
        updateLanguageList();
        updateGenreList();
        alert('Language imported successfully.');
      }catch(err){
        alert('Failed to import language: ' + (err?.message || String(err)));
      }
    });
    input.click();
  });
  
  updateLanguageList();
}

function initGenreControls(){
  const select = byId('currentGenreSelect');
  const nameInput = byId('genreName');
  const addBtn = byId('addGenreBtn');
  const editBtn = byId('editGenreBtn');
  const exportBtn = byId('exportGenreBtn');
  const importBtn = byId('importGenreBtn');
  
  if(!select) return;
  
  function updateGenreInputs(){
    const genre = getCurrentGenre();
    if(genre){
      nameInput.value = genre.name || '';
      nameInput.disabled = false;
    } else {
      nameInput.value = '';
      nameInput.disabled = true;
    }
  }
  
  select.addEventListener('change', ()=>{
    const ctx = loadCurrentContext();
    ctx.genreId = select.value || null;
    // Reset document when changing genre
    ctx.documentId = null;
    saveCurrentContext(ctx);
    updateGenreInputs();
    updateDocumentList();
    refreshAllSettingsFromContext();
  });
  
  nameInput.addEventListener('change', ()=>{
    const lang = getCurrentLanguage();
    const ctx = loadCurrentContext();
    if(lang && ctx.genreId && lang.genres[ctx.genreId]){
      lang.genres[ctx.genreId].name = nameInput.value.trim();
      const settings = loadHierarchicalSettings();
      saveHierarchicalSettings(settings);
      updateGenreList();
    }
  });
  
  addBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.languageId){
      alert('Please select a language first.');
      return;
    }
    const name = prompt('Enter genre name:', 'Narrative');
    if(!name) return;
    const id = 'genre_' + Date.now().toString(36);
    const settings = loadHierarchicalSettings();
    const lang = settings.languages[ctx.languageId];
    if(!lang) return;
    const genre = ensureGenre(lang, id);
    genre.name = name.trim();
    saveHierarchicalSettings(settings);
    ctx.genreId = id;
    ctx.documentId = null;
    saveCurrentContext(ctx);
    updateGenreList();
    updateDocumentList();
    refreshAllSettingsFromContext();
  });
  
  editBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.genreId){
      alert('Please select a genre first.');
      return;
    }
    nameInput.disabled = false;
    nameInput.focus();
  });
  
  exportBtn?.addEventListener('click', ()=>{
    const genre = getCurrentGenre();
    const ctx = loadCurrentContext();
    if(!genre){
      alert('Please select a genre first.');
      return;
    }
    const data = { genre: genre };
    const filename = `fdat-genre-${genre.name || ctx.genreId}-${new Date().toISOString().slice(0,10)}.json`;
    downloadJSON(filename, data);
  });
  
  importBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.languageId){
      alert('Please select a language first.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      try{
        const txt = await f.text();
        const data = JSON.parse(txt);
        if(!data.genre || !data.genre.id){
          alert('Invalid genre export file.');
          return;
        }
        const settings = loadHierarchicalSettings();
        const lang = settings.languages[ctx.languageId];
        if(!lang) return;
        // Generate new ID to avoid conflicts
        const newId = 'genre_' + Date.now().toString(36);
        data.genre.id = newId;
        lang.genres[newId] = data.genre;
        saveHierarchicalSettings(settings);
        ctx.genreId = newId;
        ctx.documentId = null;
        saveCurrentContext(ctx);
        updateGenreList();
        updateDocumentList();
        refreshAllSettingsFromContext();
        alert('Genre imported successfully.');
      }catch(err){
        alert('Failed to import genre: ' + (err?.message || String(err)));
      }
    });
    input.click();
  });
  
  updateGenreInputs();
}

function updateGenreList(){
  const select = byId('currentGenreSelect');
  if(!select) return;
  const lang = getCurrentLanguage();
  const ctx = loadCurrentContext();
  select.innerHTML = '<option value="">(Select a genre)</option>';
  if(lang){
    Object.values(lang.genres).forEach(genre=>{
      const opt = document.createElement('option');
      opt.value = genre.id;
      opt.textContent = genre.name || genre.id;
      if(ctx.genreId === genre.id) opt.selected = true;
      select.appendChild(opt);
    });
  }
  const genre = getCurrentGenre();
  const nameInput = byId('genreName');
  if(genre && nameInput){
    nameInput.value = genre.name || '';
    nameInput.disabled = false;
  } else if(nameInput){
    nameInput.value = '';
    nameInput.disabled = true;
  }
}

function initDocumentControls(){
  const select = byId('currentDocumentSelect');
  const nameInput = byId('documentName');
  const addBtn = byId('addDocumentBtn');
  const editBtn = byId('editDocumentBtn');
  const exportBtn = byId('exportDocumentBtn');
  const importBtn = byId('importDocumentBtn');
  
  if(!select) return;
  
  function updateDocumentInputs(){
    const doc = getCurrentDocument();
    if(doc){
      nameInput.value = doc.name || '';
      nameInput.disabled = false;
    } else {
      nameInput.value = '';
      nameInput.disabled = true;
    }
  }
  
  select.addEventListener('change', ()=>{
    const ctx = loadCurrentContext();
    ctx.documentId = select.value || null;
    saveCurrentContext(ctx);
    updateDocumentInputs();
    refreshAllSettingsFromContext();
  });
  
  nameInput.addEventListener('change', ()=>{
    const doc = getCurrentDocument();
    if(doc){
      doc.name = nameInput.value.trim();
      const settings = loadHierarchicalSettings();
      saveHierarchicalSettings(settings);
      updateDocumentList();
    }
  });
  
  addBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.genreId){
      alert('Please select a genre first.');
      return;
    }
    const name = prompt('Enter document name:');
    if(!name) return;
    const id = 'doc_' + Date.now().toString(36);
    const genre = getCurrentGenre();
    if(!genre) return;
    const doc = ensureDocument(genre, id);
    doc.name = name.trim();
    const settings = loadHierarchicalSettings();
    saveHierarchicalSettings(settings);
    ctx.documentId = id;
    saveCurrentContext(ctx);
    updateDocumentList();
    refreshAllSettingsFromContext();
  });
  
  editBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.documentId){
      alert('Please select a document first.');
      return;
    }
    nameInput.disabled = false;
    nameInput.focus();
  });
  
  exportBtn?.addEventListener('click', ()=>{
    const doc = getCurrentDocument();
    const ctx = loadCurrentContext();
    if(!doc){
      alert('Please select a document first.');
      return;
    }
    const data = { document: doc };
    const filename = `fdat-document-${doc.name || ctx.documentId}-${new Date().toISOString().slice(0,10)}.json`;
    downloadJSON(filename, data);
  });
  
  importBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.genreId){
      alert('Please select a genre first.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      try{
        const txt = await f.text();
        const data = JSON.parse(txt);
        if(!data.document || !data.document.id){
          alert('Invalid document export file.');
          return;
        }
        const genre = getCurrentGenre();
        if(!genre) return;
        // Generate new ID to avoid conflicts
        const newId = 'doc_' + Date.now().toString(36);
        data.document.id = newId;
        genre.documents[newId] = data.document;
        const settings = loadHierarchicalSettings();
        saveHierarchicalSettings(settings);
        ctx.documentId = newId;
        saveCurrentContext(ctx);
        updateDocumentList();
        refreshAllSettingsFromContext();
        alert('Document imported successfully.');
      }catch(err){
        alert('Failed to import document: ' + (err?.message || String(err)));
      }
    });
    input.click();
  });
  
  updateDocumentInputs();
}

function updateDocumentList(){
  const select = byId('currentDocumentSelect');
  if(!select) return;
  const genre = getCurrentGenre();
  const ctx = loadCurrentContext();
  select.innerHTML = '<option value="">(Select a document)</option>';
  if(genre){
    Object.values(genre.documents).forEach(doc=>{
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = doc.name || doc.id;
      if(ctx.documentId === doc.id) opt.selected = true;
      select.appendChild(opt);
    });
  }
  const doc = getCurrentDocument();
  const nameInput = byId('documentName');
  if(doc && nameInput){
    nameInput.value = doc.name || '';
    nameInput.disabled = false;
  } else if(nameInput){
    nameInput.value = '';
    nameInput.disabled = true;
  }
}

function updateContextUI(){
  updateGenreList();
  updateDocumentList();
}

// Initialize on page load
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initHierarchicalSettingsUI);
} else {
  initHierarchicalSettingsUI();
}

// Sync legacy storage to hierarchical before page unload, and periodically when something changed
window.addEventListener('beforeunload', syncLegacyToHierarchical);
setInterval(()=>{ if(!legacyDirty) return; legacyDirty = false; syncLegacyToHierarchical(); }, 5000);

// Open links that leave the app in a new browser window (the desktop shell hands those
// to the system browser). "In the app" means the same origin, under the app's own base path.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  let url; try{ url = new URL(a.getAttribute('href'), location.href); }catch(_){ return; }
  const basePath = location.pathname.replace(/[^/]*$/, '');
  const inScope = url.origin === location.origin && url.pathname.startsWith(basePath);
  if (!inScope) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer external';
  }
});

// Small, stable surface for hosts (desktop shell, automated tests).
window.FDAT = Object.freeze({ loadXmlText, previewCurrentXml, renderDocument });
