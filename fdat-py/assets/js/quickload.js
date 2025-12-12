(function(){
  function by(id){ return document.getElementById(id); }
  function populateLanguages(sel){
    const settings = (window.loadHierarchicalSettings && window.loadHierarchicalSettings()) || { languages:{} };
    const ctx = (window.loadCurrentContext && window.loadCurrentContext()) || { languageId:null };
    sel.innerHTML = '';
    const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent='(Select a language)'; sel.appendChild(placeholder);
    Object.values(settings.languages || {}).forEach(lang=>{
      const opt = document.createElement('option'); opt.value = lang.id; opt.textContent = lang.name || lang.id; if(ctx.languageId===lang.id) opt.selected=true; sel.appendChild(opt);
    });
  }
  function populateGenres(sel){
    const lang = (window.getCurrentLanguage && window.getCurrentLanguage()) || null;
    const ctx = (window.loadCurrentContext && window.loadCurrentContext()) || { genreId:null };
    sel.innerHTML = '';
    const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent='(Select a genre)'; sel.appendChild(placeholder);
    if(!lang) return;
    Object.values(lang.genres || {}).forEach(genre=>{
      const opt = document.createElement('option'); opt.value = genre.id; opt.textContent = genre.name || genre.id; if(ctx.genreId===genre.id) opt.selected=true; sel.appendChild(opt);
    });
  }
  function populateDocuments(sel){
    const genre = (window.getCurrentGenre && window.getCurrentGenre()) || null;
    const ctx = (window.loadCurrentContext && window.loadCurrentContext()) || { documentId:null };
    sel.innerHTML = '';
    const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent='(Select a document)'; sel.appendChild(placeholder);
    if(!genre) return;
    Object.values(genre.documents || {}).forEach(doc=>{
      const opt = document.createElement('option'); opt.value = doc.id; opt.textContent = doc.name || doc.id; if(ctx.documentId===doc.id) opt.selected=true; sel.appendChild(opt);
    });
  }
  function refreshAll(){
    const langSel = by('quickLanguageSelect');
    const genreSel = by('quickGenreSelect');
    const docSel = by('quickDocumentSelect');
    if(!langSel || !genreSel || !docSel) return;
    populateLanguages(langSel);
    populateGenres(genreSel);
    populateDocuments(docSel);
    updateLoadButtonState();
  }
  function updateLoadButtonState(){
    const btn = by('quickLoadBtn'); if(!btn) return;
    const doc = (window.getCurrentDocument && window.getCurrentDocument()) || null;
    const canLoad = !!(doc && doc.sourceXmlPath);
    btn.disabled = !canLoad;
    btn.title = canLoad ? 'Load and render the saved XML for this document' : 'Select a document with saved XML';
  }
  function wire(){
    const langSel = by('quickLanguageSelect');
    const genreSel = by('quickGenreSelect');
    const docSel = by('quickDocumentSelect');
    const loadBtn = by('quickLoadBtn');
    if(!langSel || !genreSel || !docSel || !loadBtn) return;

    langSel.addEventListener('change', ()=>{
      const ctx = (window.loadCurrentContext && window.loadCurrentContext()) || { languageId:null, genreId:null, documentId:null };
      const languageId = langSel.value || null;
      // Reset genre/doc when language changes
      (window.setCurrentContext && window.setCurrentContext(languageId, null, null));
      refreshAll();
      // also let the rest of the app update
      if(window.updateGenreList) window.updateGenreList();
      if(window.updateDocumentList) window.updateDocumentList();
    });

    genreSel.addEventListener('change', ()=>{
      const ctx = (window.loadCurrentContext && window.loadCurrentContext()) || { languageId:null, genreId:null, documentId:null };
      const genreId = genreSel.value || null;
      (window.setCurrentContext && window.setCurrentContext(ctx.languageId || null, genreId, null));
      refreshAll();
      if(window.updateDocumentList) window.updateDocumentList();
    });

    docSel.addEventListener('change', async ()=>{
      const ctx = (window.loadCurrentContext && window.loadCurrentContext()) || { languageId:null, genreId:null, documentId:null };
      const documentId = docSel.value || null;
      (window.setCurrentContext && window.setCurrentContext(ctx.languageId || null, ctx.genreId || null, documentId));
      updateLoadButtonState();
      // Auto-load if available
      try{
        const doc = (window.getCurrentDocument && window.getCurrentDocument()) || null;
        if(doc && doc.sourceXmlPath && window.loadDocumentXmlAndRender){ await window.loadDocumentXmlAndRender(); }
      }catch(_){ /* non-fatal */ }
    });

    loadBtn.addEventListener('click', async ()=>{
      try{ if(window.loadDocumentXmlAndRender) await window.loadDocumentXmlAndRender(); }catch(err){ alert('Error loading document: ' + (err?.message || String(err))); }
    });

    window.addEventListener('fdat:context-changed', refreshAll);
    refreshAll();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
