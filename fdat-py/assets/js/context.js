// Keys
const LANG_PREFS_KEY = 'flex_xml_viewer_lang_prefs_v1';
const WORDFORM_PREFS_KEY = 'flex_xml_viewer_wordform_prefs_v1';
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
const HIERARCHICAL_SETTINGS_KEY = 'fdat_hierarchical_settings_v1';
const CURRENT_CONTEXT_KEY = 'fdat_current_context_v1';

// Hierarchical settings
function loadHierarchicalSettings(){
  const data = loadJSON(HIERARCHICAL_SETTINGS_KEY);
  if(!data || typeof data !== 'object'){
    return {
      appSettings: { printHeaders: false, freezeHeaders: false, showNames: false },
      languages: {}
    };
  }
  return data;
}
function saveHierarchicalSettings(settings){ saveJSON(HIERARCHICAL_SETTINGS_KEY, settings); }
function loadCurrentContext(){
  const ctx = loadJSON(CURRENT_CONTEXT_KEY);
  if(!ctx || typeof ctx !== 'object'){
    return { languageId: null, genreId: null, documentId: null };
  }
  return ctx;
}
function saveCurrentContext(ctx){ saveJSON(CURRENT_CONTEXT_KEY, ctx); }
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
      salienceBands: { enabled: true, showLegend: true, showColumn: false, cellOnly: false, opacity: 1, tree: [] },
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
  refreshAllSettingsFromContext();
}
function refreshAllSettingsFromContext(){
  const settings = loadHierarchicalSettings();
  const ctx = loadCurrentContext();
  if(ctx.languageId && settings.languages[ctx.languageId]){
    const lang = settings.languages[ctx.languageId];
    if(lang.abbrevs) saveJSON(ABBREV_PREFS_KEY, lang.abbrevs);
    if(lang.listRefs) saveJSON(LISTREF_PREFS_KEY, lang.listRefs);
    if(ctx.genreId && lang.genres[ctx.genreId]){
      const genre = lang.genres[ctx.genreId];
      if(genre.salienceBands) saveJSON(SALIENCE_PREFS_KEY, genre.salienceBands);
      if(ctx.documentId && genre.documents[ctx.documentId]){
        const doc = genre.documents[ctx.documentId];
        if(doc.prologue) saveJSON(TEXTCHART_PROLOGUE_KEY, doc.prologue);
        if(doc.postlogue) saveJSON(TEXTCHART_POSTLOGUE_KEY, doc.postlogue);
        if(doc.freeTranslations) saveJSON(FT_PREFS_KEY, doc.freeTranslations);
        if(doc.notes) saveJSON(NOTES_PREFS_KEY, doc.notes);
        if(doc.rowGuids) saveJSON(ROW_GUIDS_KEY, doc.rowGuids);
        if(doc.tokenGuids) saveJSON(TOKEN_GUIDS_KEY, doc.tokenGuids);
        if(doc.noteGuids) saveJSON(NOTE_GUIDS_KEY, doc.noteGuids);
        if(doc.customColumns) saveJSON(CUSTOM_COLS_PREFS_KEY, doc.customColumns);
      }
    }
  }
  const app = settings.appSettings || {};
  if(typeof app.printHeaders !== 'undefined') saveJSON(PRINT_HEADERS_KEY, { enabled: app.printHeaders });
  if(typeof app.freezeHeaders !== 'undefined') saveJSON(FREEZE_HEADERS_KEY, { enabled: app.freezeHeaders });
}
function syncLegacyToHierarchical(){
  const settings = loadHierarchicalSettings();
  const ctx = loadCurrentContext();
  if(!ctx.languageId) return;
  const lang = settings.languages[ctx.languageId];
  if(!lang) return;
  const abbrevs = loadJSON(ABBREV_PREFS_KEY); if(abbrevs) lang.abbrevs = abbrevs;
  const listRefs = loadJSON(LISTREF_PREFS_KEY); if(listRefs) lang.listRefs = listRefs;
  if(ctx.genreId && lang.genres[ctx.genreId]){
    const genre = lang.genres[ctx.genreId];
    const salience = loadJSON(SALIENCE_PREFS_KEY); if(salience) genre.salienceBands = salience;
    if(ctx.documentId && genre.documents[ctx.documentId]){
      const doc = genre.documents[ctx.documentId];
      const prologue = loadJSON(TEXTCHART_PROLOGUE_KEY); if(prologue) doc.prologue = prologue;
      const postlogue = loadJSON(TEXTCHART_POSTLOGUE_KEY); if(postlogue) doc.postlogue = postlogue;
      const ft = loadJSON(FT_PREFS_KEY); if(ft) doc.freeTranslations = ft;
      const notes = loadJSON(NOTES_PREFS_KEY); if(notes) doc.notes = notes;
      const rowGuids = loadJSON(ROW_GUIDS_KEY); if(rowGuids) doc.rowGuids = rowGuids;
      const tokenGuids = loadJSON(TOKEN_GUIDS_KEY); if(tokenGuids) doc.tokenGuids = tokenGuids;
      const noteGuids = loadJSON(NOTE_GUIDS_KEY); if(noteGuids) doc.noteGuids = noteGuids;
      const customCols = loadJSON(CUSTOM_COLS_PREFS_KEY); if(customCols) doc.customColumns = customCols;
    }
  }
  const printHeaders = loadJSON(PRINT_HEADERS_KEY);
  if(printHeaders && typeof printHeaders.enabled !== 'undefined') settings.appSettings.printHeaders = printHeaders.enabled;
  const freezeHeaders = loadJSON(FREEZE_HEADERS_KEY);
  if(freezeHeaders && typeof freezeHeaders.enabled !== 'undefined') settings.appSettings.freezeHeaders = freezeHeaders.enabled;
  saveHierarchicalSettings(settings);
}
function migrateToHierarchical(){
  const existing = loadJSON(HIERARCHICAL_SETTINGS_KEY);
  if(existing && existing.migrated) return;
  const settings = loadHierarchicalSettings();
  const defaultLangId = 'default';
  const lang = ensureLanguage(settings, defaultLangId);
  lang.name = 'Default Language';
  const abbrevs = loadJSON(ABBREV_PREFS_KEY); if(abbrevs) lang.abbrevs = abbrevs;
  const listRefs = loadJSON(LISTREF_PREFS_KEY); if(listRefs) lang.listRefs = listRefs;
  const defaultGenreId = 'narrative';
  const genre = ensureGenre(lang, defaultGenreId);
  const salience = loadJSON(SALIENCE_PREFS_KEY); if(salience) genre.salienceBands = salience;
  const defaultDocId = 'default';
  const doc = ensureDocument(genre, defaultDocId);
  doc.name = 'Current Document';
  const prologue = loadJSON(TEXTCHART_PROLOGUE_KEY); if(prologue) doc.prologue = prologue;
  const postlogue = loadJSON(TEXTCHART_POSTLOGUE_KEY); if(postlogue) doc.postlogue = postlogue;
  const ft = loadJSON(FT_PREFS_KEY); if(ft) doc.freeTranslations = ft;
  const notes = loadJSON(NOTES_PREFS_KEY); if(notes) doc.notes = notes;
  const rowGuids = loadJSON(ROW_GUIDS_KEY); if(rowGuids) doc.rowGuids = rowGuids;
  const tokenGuids = loadJSON(TOKEN_GUIDS_KEY); if(tokenGuids) doc.tokenGuids = tokenGuids;
  const noteGuids = loadJSON(NOTE_GUIDS_KEY); if(noteGuids) doc.noteGuids = noteGuids;
  const customCols = loadJSON(CUSTOM_COLS_PREFS_KEY); if(customCols) doc.customColumns = customCols;
  const printHeaders = loadJSON(PRINT_HEADERS_KEY);
  if(printHeaders && typeof printHeaders.enabled !== 'undefined') settings.appSettings.printHeaders = printHeaders.enabled;
  const freezeHeaders = loadJSON(FREEZE_HEADERS_KEY);
  if(freezeHeaders && typeof freezeHeaders.enabled !== 'undefined') settings.appSettings.freezeHeaders = freezeHeaders.enabled;
  settings.migrated = true;
  saveHierarchicalSettings(settings);
  setCurrentContext(defaultLangId, defaultGenreId, defaultDocId);
}
function updateContextUI(){
  updateGenreList();
  updateDocumentList();
}
function initHierarchicalSettingsUI(){
  migrateToHierarchical();
  initLanguageControls();
  initGenreControls();
  initDocumentControls();
  updateContextUI();
}

// Initialize on page load
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initHierarchicalSettingsUI);
} else {
  initHierarchicalSettingsUI();
}

// Sync legacy storage periodically and on unload
window.addEventListener('beforeunload', syncLegacyToHierarchical);
setInterval(syncLegacyToHierarchical, 5000);
