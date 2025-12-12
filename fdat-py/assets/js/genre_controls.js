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
    if(genre){ nameInput.value = genre.name || ''; nameInput.disabled = false; }
    else { nameInput.value = ''; nameInput.disabled = true; }
  }
  select.addEventListener('change', ()=>{
    const ctx = loadCurrentContext();
    ctx.genreId = select.value || null; ctx.documentId = null;
    saveCurrentContext(ctx); updateGenreInputs(); updateDocumentList(); refreshAllSettingsFromContext();
  });
  nameInput.addEventListener('change', ()=>{
    const lang = getCurrentLanguage(); const ctx = loadCurrentContext();
    if(lang && ctx.genreId && lang.genres[ctx.genreId]){
      lang.genres[ctx.genreId].name = nameInput.value.trim();
      const settings = loadHierarchicalSettings(); saveHierarchicalSettings(settings); updateGenreList();
    }
  });
  addBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext(); if(!ctx.languageId){ alert('Please select a language first.'); return; }
    const name = prompt('Enter genre name:', 'Narrative'); if(!name) return;
    const id = 'genre_' + Date.now().toString(36);
    const settings = loadHierarchicalSettings(); const lang = settings.languages[ctx.languageId]; if(!lang) return;
    const genre = ensureGenre(lang, id); genre.name = name.trim(); saveHierarchicalSettings(settings);
    ctx.genreId = id; ctx.documentId = null; saveCurrentContext(ctx); updateGenreList(); updateDocumentList(); refreshAllSettingsFromContext();
  });
  editBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext(); if(!ctx.genreId){ alert('Please select a genre first.'); return; }
    nameInput.disabled = false; nameInput.focus();
  });
  exportBtn?.addEventListener('click', ()=>{
    const genre = getCurrentGenre(); const ctx = loadCurrentContext(); if(!genre){ alert('Please select a genre first.'); return; }
    const data = { genre: genre };
    const filename = `fdat-genre-${genre.name || ctx.genreId}-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  });
  importBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext(); if(!ctx.languageId){ alert('Please select a language first.'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0]; if(!f) return;
      try{
        const txt = await f.text(); const data = JSON.parse(txt);
        if(!data.genre || !data.genre.id){ alert('Invalid genre export file.'); return; }
        const settings = loadHierarchicalSettings(); const lang = settings.languages[ctx.languageId]; if(!lang) return;
        const newId = 'genre_' + Date.now().toString(36);
        data.genre.id = newId; lang.genres[newId] = data.genre; saveHierarchicalSettings(settings);
        ctx.genreId = newId; ctx.documentId = null; saveCurrentContext(ctx); updateGenreList(); updateDocumentList(); refreshAllSettingsFromContext(); alert('Genre imported successfully.');
      }catch(err){ alert('Failed to import genre: ' + (err?.message || String(err))); }
    });
    input.click();
  });
  updateGenreInputs();
}

function updateGenreList(){
  const select = byId('currentGenreSelect'); if(!select) return;
  const lang = getCurrentLanguage(); const ctx = loadCurrentContext();
  select.innerHTML = '<option value="">(Select a genre)</option>';
  if(lang){ Object.values(lang.genres).forEach(genre=>{ const opt = document.createElement('option'); opt.value = genre.id; opt.textContent = genre.name || genre.id; if(ctx.genreId === genre.id) opt.selected = true; select.appendChild(opt); }); }
  const genre = getCurrentGenre(); const nameInput = byId('genreName');
  if(genre && nameInput){ nameInput.value = genre.name || ''; nameInput.disabled = false; }
  else if(nameInput){ nameInput.value = ''; nameInput.disabled = true; }
}
