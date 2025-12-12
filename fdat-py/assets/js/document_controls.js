function initDocumentControls(){
  const select = byId('currentDocumentSelect');
  const nameInput = byId('documentName');
  const loadBtn = byId('loadDocumentBtn');
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
      if(loadBtn){ const canLoad = !!doc.sourceXmlPath; loadBtn.disabled = !canLoad; loadBtn.title = canLoad ? 'Load and render the saved XML for this document' : 'No saved XML path found for this document'; }
    } else {
      nameInput.value = '';
      nameInput.disabled = true;
      if(loadBtn){ loadBtn.disabled = true; loadBtn.title = 'Select a document first'; }
    }
  }
  select.addEventListener('change', ()=>{
    const ctx = loadCurrentContext();
    ctx.documentId = select.value || null; saveCurrentContext(ctx); updateDocumentInputs(); refreshAllSettingsFromContext();
    const doc = getCurrentDocument(); if(doc && doc.sourceXmlPath){ loadDocumentXmlAndRender(); }
  });
  nameInput.addEventListener('change', ()=>{
    const doc = getCurrentDocument(); if(doc){ doc.name = nameInput.value.trim(); const settings = loadHierarchicalSettings(); saveHierarchicalSettings(settings); updateDocumentList(); }
  });
  addBtn?.addEventListener('click', async ()=>{
    const ctx = loadCurrentContext(); if(!ctx.languageId){ alert('Please select a language first.'); return; } if(!ctx.genreId){ alert('Please select a genre first.'); return; }
    const xmlText = byId('xmlInput')?.value?.trim() || ''; if(!xmlText){ alert('Paste or open an XML document first, then try again.'); return; }
    const name = prompt('Enter document name to save:', 'Document'); if(!name) return;
    try{
      if(window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_document_xml === 'function'){
        let result = await window.pywebview.api.save_document_xml(ctx.languageId, ctx.genreId, name.trim(), xmlText, false);
        if(result && result.success){
          const genre = getCurrentGenre(); if(!genre) return;
          const id = result.doc_id || ('doc_' + Date.now().toString(36)); const doc = ensureDocument(genre, id);
          doc.name = name.trim(); doc.sourceXmlPath = result.path || '';
          const settings = loadHierarchicalSettings(); saveHierarchicalSettings(settings);
          ctx.documentId = id; saveCurrentContext(ctx); updateDocumentList(); refreshAllSettingsFromContext(); alert('Document saved successfully.');
        } else if(result && result.error === 'exists'){
          result = await window.pywebview.api.save_document_xml(ctx.languageId, ctx.genreId, name.trim(), xmlText, true);
          if(result && result.success){
            const genre = getCurrentGenre(); if(!genre) return;
            const id = result.doc_id || ('doc_' + Date.now().toString(36)); const doc = ensureDocument(genre, id);
            doc.name = name.trim(); doc.sourceXmlPath = result.path || '';
            const settings = loadHierarchicalSettings(); saveHierarchicalSettings(settings);
            ctx.documentId = id; saveCurrentContext(ctx); updateDocumentList(); refreshAllSettingsFromContext(); alert('Document overwritten successfully.');
          } else { alert('Failed to overwrite document: ' + (result?.error || 'Unknown error')); }
        } else { alert('Failed to save document: ' + (result?.error || 'Unknown error')); }
      } else { alert('Saving documents is not available in this environment.'); }
    } catch(err){ alert('Failed to save document: ' + (err?.message || String(err))); }
  });
  editBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext(); if(!ctx.documentId){ alert('Please select a document first.'); return; }
    nameInput.disabled = false; nameInput.focus();
  });
  exportBtn?.addEventListener('click', ()=>{
    const doc = getCurrentDocument(); const ctx = loadCurrentContext(); if(!doc){ alert('Please select a document first.'); return; }
    const data = { document: doc };
    const filename = `fdat-document-${doc.name || ctx.documentId}-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  });
  importBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext(); if(!ctx.genreId){ alert('Please select a genre first.'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0]; if(!f) return;
      try{
        const txt = await f.text(); const data = JSON.parse(txt);
        if(!data.document || !data.document.id){ alert('Invalid document export file.'); return; }
        const genre = getCurrentGenre(); if(!genre) return;
        const newId = 'doc_' + Date.now().toString(36);
        data.document.id = newId; genre.documents[newId] = data.document;
        const settings = loadHierarchicalSettings(); saveHierarchicalSettings(settings);
        ctx.documentId = newId; saveCurrentContext(ctx); updateDocumentList(); refreshAllSettingsFromContext(); alert('Document imported successfully.');
      }catch(err){ alert('Failed to import document: ' + (err?.message || String(err))); }
    });
    input.click();
  });
  updateDocumentInputs();
  loadBtn?.addEventListener('click', loadDocumentXmlAndRender);
}

function updateDocumentList(){
  const select = byId('currentDocumentSelect'); if(!select) return;
  const genre = getCurrentGenre(); const ctx = loadCurrentContext();
  select.innerHTML = '<option value="">(Select a document)</option>';
  if(genre){ Object.values(genre.documents).forEach(doc=>{ const opt = document.createElement('option'); opt.value = doc.id; opt.textContent = doc.name || doc.id; if(ctx.documentId === doc.id) opt.selected = true; select.appendChild(opt); }); }
  const doc = getCurrentDocument(); const nameInput = byId('documentName');
  if(doc && nameInput){ nameInput.value = doc.name || ''; nameInput.disabled = false; }
  else if(nameInput){ nameInput.value = ''; nameInput.disabled = true; }
}

async function loadDocumentXmlAndRender(){
  const doc = getCurrentDocument(); if(!doc || !doc.sourceXmlPath){ alert('This document has no saved XML path.'); return; }
  showProcessing('Loading document…');
  try{
    await new Promise(r=>setTimeout(r,50));
    if(window.pywebview && window.pywebview.api && typeof window.pywebview.api.read_document_xml === 'function'){
      const res = await window.pywebview.api.read_document_xml(doc.sourceXmlPath);
      if(!res || !res.success){ throw new Error(res?.error || 'Failed to read document XML'); }
      const xmlText = (res.content || '').trim(); if(!xmlText){ throw new Error('Empty XML content'); }
      byId('xmlInput').value = xmlText;
      let html = await window.pywebview.api.transform_content(xmlText);
      if (html && typeof html === 'string' && html.startsWith('Error')) { throw new Error(html); }
      const p = new DOMParser(); const xmlDoc = p.parseFromString(xmlText, 'application/xml'); if(xmlDoc.querySelector('parsererror')) throw new Error('XML parse error');
      showProcessing('Rendering…'); await new Promise(r=>setTimeout(r,50)); await renderDocument(xmlDoc, html);
    } else { alert('Backend not available to read document XML.'); }
  } catch(err){ alert('Error loading document: ' + (err?.message || String(err))); }
  finally { hideProcessing(); }
}
