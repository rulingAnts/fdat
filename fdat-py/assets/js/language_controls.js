function initLanguageControls(){
  const select = byId('currentLanguageSelect');
  const nameInput = byId('languageName');
  const ethnoInput = byId('ethnologueCode');
  const addBtn = byId('addLanguageBtn');
  const editBtn = byId('editLanguageBtn');
  const exportBtn = byId('exportLanguageBtn');
  const importBtn = byId('importLanguageBtn');
  if(!select) return;
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
    ctx.genreId = null; ctx.documentId = null;
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
    const genreId = 'narrative'; ensureGenre(lang, genreId);
    saveHierarchicalSettings(settings);
    setCurrentContext(id, genreId, null);
    updateLanguageList();
    updateGenreList();
  });
  editBtn?.addEventListener('click', ()=>{
    const ctx = loadCurrentContext();
    if(!ctx.languageId){ alert('Please select a language first.'); return; }
    nameInput.disabled = false; ethnoInput.disabled = false; nameInput.focus();
  });
  exportBtn?.addEventListener('click', ()=>{
    const settings = loadHierarchicalSettings();
    const ctx = loadCurrentContext();
    if(!ctx.languageId || !settings.languages[ctx.languageId]){ alert('Please select a language first.'); return; }
    const lang = settings.languages[ctx.languageId];
    const data = { language: lang };
    const filename = `fdat-language-${lang.name || ctx.languageId}-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  });
  importBtn?.addEventListener('click', ()=>{
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0]; if(!f) return;
      try{
        const txt = await f.text(); const data = JSON.parse(txt);
        if(!data.language || !data.language.id){ alert('Invalid language export file.'); return; }
        const settings = loadHierarchicalSettings();
        const newId = 'lang_' + Date.now().toString(36);
        data.language.id = newId; settings.languages[newId] = data.language;
        saveHierarchicalSettings(settings);
        setCurrentContext(newId, null, null);
        updateLanguageList(); updateGenreList();
        alert('Language imported successfully.');
      }catch(err){ alert('Failed to import language: ' + (err?.message || String(err))); }
    });
    input.click();
  });
  updateLanguageList();
}
