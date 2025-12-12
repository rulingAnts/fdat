(function(){
  // Depends on byId, loadJSON, saveJSON, LISTREF_PREFS_KEY, globalState, escapeHtml

  function collectListRefLabelsFromRendered(area){
    const nodes = Array.from(area.querySelectorAll('.interlinear .pair.listRef[data-listref]'));
    const set = new Set();
    nodes.forEach(n=>{ const v=(n.getAttribute('data-listref')||'').trim(); if(v && !set.has(v)) set.add(v); });
    return Array.from(set);
  }

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
        if(sb !== sa) return sb - sa;
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
      groups: Array.isArray(d.groups) ? d.groups : []
    };
  }

  function saveListRefPrefs(p){ saveJSON(LISTREF_PREFS_KEY, p); }

  function reconcileListRefPrefs(prefs, labels, suggestedOrder){
    const out = { entries: { ...prefs.entries }, order: Array.from(prefs.order||[]), enforceMode: ['none','groups','global'].includes(prefs.enforceMode) ? prefs.enforceMode : 'global', reverse: !!prefs.reverse, groups: Array.isArray(prefs.groups) ? prefs.groups.map(g=>({...g})) : [] };
    Object.keys(out.entries).forEach(k=>{ if(!labels.includes(k)) delete out.entries[k]; });
    function normalizeEntry(e){ if(!e) return e; ['hidden','bold','italic','underline'].forEach(k=>{ if(e[k] === false) delete e[k]; }); if(e.fontSize === '') delete e.fontSize; if(e.color === '') delete e.color; return e; }
    Object.keys(out.entries).forEach(k=>{ out.entries[k] = normalizeEntry(out.entries[k]); });
    labels.forEach(l=>{ if(!out.entries[l]) out.entries[l] = {}; });
    let base = out.order && out.order.length ? out.order.slice() : (Array.isArray(suggestedOrder) && suggestedOrder.length ? suggestedOrder.slice() : labels.slice());
    const ordered = base.filter(x => labels.includes(x));
    labels.forEach(l=>{ if(!ordered.includes(l)) ordered.push(l); });
    out.order = ordered;
    out.groups.forEach(g=>{ if(Array.isArray(g.order)) g.order = g.order.filter(x=> labels.includes(x)); });
    return out;
  }

  function showListRefPanel(show){ const p = byId('listRefPanel'); if(p) p.style.display = show ? 'block':'none'; }

  function buildListRefControls(labels, suggestedOrder){
    const panel = byId('listRefPanel'); if(!panel) return;
    const rowsHost = byId('listRefRows');
    const groupsHost = byId('listRefGroupList');
    const resetBtn = byId('listRefResetOrder');
    const enforceSel = byId('listRefEnforceMode');
    const dirBtn = byId('listRefToggleOrder');
    const showAllBtn = byId('listRefShowAll');
    const hideAllBtn = byId('listRefHideAll');
    const resetAllStylesBtn = byId('listRefResetAllStyles');
    const addGroupBtn = byId('listRefAddGroup');
    const newGroupNameIn = byId('listRefNewGroupName');
    let prefs = reconcileListRefPrefs(loadListRefPrefs(), labels, suggestedOrder||[]);
    window.globalState = window.globalState || {};
    window.globalState.listRefPrefs = prefs; saveListRefPrefs(prefs);
    if(enforceSel){ enforceSel.value = prefs.enforceMode || 'global'; enforceSel.addEventListener('change', ()=>{ prefs.enforceMode = enforceSel.value; persist(); applyListRefPrefsToArea(); }); }
    function updateDirButton(){ if(dirBtn) dirBtn.textContent = prefs.reverse ? '(bottom → top)' : '(top → bottom)'; }
    if(dirBtn){ dirBtn.addEventListener('click', ()=>{ prefs.reverse = !prefs.reverse; persist(); applyListRefPrefsToArea(); updateDirButton(); }); }
    updateDirButton();
    if(showAllBtn){ showAllBtn.addEventListener('click', ()=>{ Object.values(prefs.entries).forEach(e=> e.hidden=false); persist(); applyListRefPrefsToArea(); renderRows(); }); }
    if(hideAllBtn){ hideAllBtn.addEventListener('click', ()=>{ Object.values(prefs.entries).forEach(e=> e.hidden=true); persist(); applyListRefPrefsToArea(); renderRows(); }); }
    if(resetAllStylesBtn){ resetAllStylesBtn.addEventListener('click', ()=>{
      Object.values(prefs.entries).forEach(e=>{ e.bold=false; e.italic=false; e.underline=false; e.fontSize=''; e.color=''; });
      (prefs.groups||[]).forEach(g=>{ g.styles = g.styles || {}; g.styles.bold=false; g.styles.italic=false; g.styles.underline=false; g.styles.fontSize=''; g.styles.color=''; });
      persist(); applyListRefPrefsToArea(); renderRows();
    }); }
    if(addGroupBtn){ addGroupBtn.addEventListener('click', ()=>{
      const name = (newGroupNameIn?.value || '').trim() || 'Group';
      const id = 'g_' + Date.now().toString(36) + '_' + Math.floor(Math.random()*1000);
      const g = { id, name, order: [], styles: { hidden:false, bold:false, italic:false, underline:false, fontSize:'', color:'' } };
      prefs.groups = Array.isArray(prefs.groups) ? prefs.groups : [];
      prefs.groups.push(g);
      if(newGroupNameIn) newGroupNameIn.value = '';
      persist(); renderRows(); applyListRefPrefsToArea();
    }); }
    function renderRows(){
      rowsHost.innerHTML='';
      const groupedIds = new Set();
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
          const resetStyleBtn = document.createElement('button'); resetStyleBtn.className='small-btn secondary'; resetStyleBtn.textContent='Reset style'; resetStyleBtn.title='Clear visibility and styles for this group and its items';
          resetStyleBtn.addEventListener('click', ()=>{ g.styles = {}; (g.order||[]).forEach(id=>{ const e=prefs.entries[id]; if(e){ delete e.hidden; delete e.bold; delete e.italic; delete e.underline; delete e.fontSize; delete e.color; } }); persist(); applyListRefPrefsToArea(); renderRows(); });
          const del = document.createElement('button'); del.className='small-btn secondary'; del.textContent='Remove group'; del.addEventListener('click', ()=>{ prefs.groups.splice(gi,1); persist(); renderRows(); applyListRefPrefsToArea(); });
          header.appendChild(upBtn); header.appendChild(dnBtn); header.appendChild(nameIn); header.appendChild(hideBtn); header.appendChild(b); header.appendChild(i); header.appendChild(u); header.appendChild(sizeWrap); header.appendChild(colorWrap); header.appendChild(resetStyleBtn); header.appendChild(del);
          groupDiv.appendChild(header);
          const itemsDiv = document.createElement('div'); itemsDiv.className='lr-group-items';
          const allIds = prefs.order.filter(id=> labels.includes(id));
          g.order = Array.isArray(g.order) ? g.order.filter(id=> allIds.includes(id)) : [];
          const inGroup = new Set(g.order);
          const addWrap = document.createElement('div'); addWrap.style.marginBottom='6px';
          const addSelect = document.createElement('select'); addSelect.title='Add item to group';
          const defaultOpt = document.createElement('option'); defaultOpt.value=''; defaultOpt.textContent='Add item to group…'; addSelect.appendChild(defaultOpt);
          allIds.forEach(id=>{ if(inGroup.has(id)) return; const opt=document.createElement('option'); opt.value=id; opt.textContent=id; addSelect.appendChild(opt); });
          addSelect.addEventListener('change', ()=>{ const id = addSelect.value; if(!id) return; g.order.push(id); persist(); applyListRefPrefsToArea(); renderRows(); });
          addWrap.appendChild(addSelect); itemsDiv.appendChild(addWrap);
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
            const removeBtn = document.createElement('button'); removeBtn.className='small-btn secondary'; removeBtn.textContent='Remove from group'; removeBtn.addEventListener('click', ()=>{ g.order.splice(idx,1); persist(); applyListRefPrefsToArea(); renderRows(); });
            styleControls.appendChild(b); styleControls.appendChild(i); styleControls.appendChild(u); styleControls.appendChild(sizeWrap); styleControls.appendChild(colorWrap); styleControls.appendChild(resetStyleBtn); styleControls.appendChild(removeBtn);
            row.appendChild(styleControls);
            itemsDiv.appendChild(row);
          });
          groupDiv.appendChild(itemsDiv);
          groupsHost.appendChild(groupDiv);
        });
      }
      prefs.order.forEach(label=>{
        if(groupedIds.has(label)) return;
        const ent = prefs.entries[label]; if(!ent) return;
        const row = document.createElement('div'); row.className = 'lr-row';
        const upBtn = document.createElement('button'); upBtn.className='small-btn secondary'; upBtn.textContent='↑'; upBtn.title='Move earlier';
        const dnBtn = document.createElement('button'); dnBtn.className='small-btn secondary'; dnBtn.textContent='↓'; dnBtn.title='Move later';
        upBtn.addEventListener('click', ()=>{ move(label, -1); }); dnBtn.addEventListener('click', ()=>{ move(label, +1); });
        row.appendChild(upBtn); row.appendChild(dnBtn);
        const abbr = document.createElement('span'); abbr.className = 'lr-abbr'; abbr.textContent = label; row.appendChild(abbr);
        const styleControls = document.createElement('div');
        styleControls.style.display='flex'; styleControls.style.alignItems='center'; styleControls.style.gap='8px';
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
    function persist(){ window.globalState.listRefPrefs = prefs; saveListRefPrefs(prefs); }
    renderRows();
    applyListRefPrefsToArea();
    if(resetBtn && panel.dataset.resetWired !== '1'){
      resetBtn.addEventListener('click', ()=>{
        try{
          const suggestion = Array.isArray(suggestedOrder) ? suggestedOrder.slice() : [];
          prefs.order = reconcileListRefPrefs({ entries: prefs.entries, order: [] }, labels, suggestion).order;
          persist();
          renderRows();
          applyListRefPrefsToArea();
        }catch(_){ /* no-op */ }
      });
      panel.dataset.resetWired = '1';
    }
  }

  function applyListRefPrefsToArea(){
    const area = byId('renderArea'); if(!area) return;
    const prefs = (window.globalState && window.globalState.listRefPrefs) || loadListRefPrefs();
    const cells = Array.from(area.querySelectorAll('.interlinear'));
    cells.forEach(cell=>{
      const pairs = Array.from(cell.querySelectorAll(':scope > .pair'));
      let i=0; while(i < pairs.length){
        if(!pairs[i].classList.contains('listRef')){ i++; continue; }
        let j=i; const run=[]; while(j<pairs.length && pairs[j].classList.contains('listRef')){ run.push(pairs[j]); j++; }
        const mode = prefs.enforceMode || (typeof prefs.enforce === 'boolean' ? (prefs.enforce ? 'global' : 'none') : 'global');
        if(mode !== 'none'){
          run.forEach((n, idx)=>{ if(!n.hasAttribute('data-orig-index')) n.setAttribute('data-orig-index', String(idx)); });
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
          run.sort((a,b)=>{
            const la = (a.getAttribute('data-listref')||'').trim();
            const lb = (b.getAttribute('data-listref')||'').trim();
            const ga = groupIndexFor(la), gb = groupIndexFor(lb);
            if(ga !== gb){
              if(mode === 'groups'){
                const oa = parseInt(a.getAttribute('data-orig-index')||'0',10);
                const ob = parseInt(b.getAttribute('data-orig-index')||'0',10);
                return oa - ob;
              }
              return ga - gb;
            }
            const pa = inGroupPos(la), pb = inGroupPos(lb);
            if(pa !== pb){
              if(mode === 'groups') return pa - pb;
              return pa - pb;
            }
            if(mode === 'groups'){
              const oa = parseInt(a.getAttribute('data-orig-index')||'0',10);
              const ob = parseInt(b.getAttribute('data-orig-index')||'0',10);
              return oa - ob;
            }
            return globalIndex(la) - globalIndex(lb);
          });
          if(prefs.reverse) run.reverse();
          const before = pairs[j] || null;
          run.forEach(n=> cell.insertBefore(n, before));
        } else {
          run.forEach((n, idx)=>{ if(!n.hasAttribute('data-orig-index')) n.setAttribute('data-orig-index', String(idx)); });
          run.sort((a,b)=> (parseInt(a.getAttribute('data-orig-index')||'0',10) - parseInt(b.getAttribute('data-orig-index')||'0',10)) );
          if(prefs.reverse) run.reverse();
          const before = pairs[j] || null;
          run.forEach(n=> cell.insertBefore(n, before));
        }
        i = j;
      }
    });
    try{
      const mode = (window.globalState.listRefPrefs || {}).enforceMode || 'global';
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
          }
        });
        const problems = [];
        (window.globalState.listRefPrefs.groups||[]).forEach(g=>{
          if(!Array.isArray(g.order) || g.order.length<2) return;
          runs.forEach(run=>{
            const present = g.order.filter(id=> run.nodes.some(n => (n.getAttribute('data-listref')||'').trim() === id));
            if(present.length >= 2){
              const indices = present.map(id => run.nodes.findIndex(n => (n.getAttribute('data-listref')||'').trim() === id)).sort((a,b)=>a-b);
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
    const nodes = Array.from(area.querySelectorAll('.interlinear .pair.listRef[data-listref]'));
    nodes.forEach(n=>{
      const lab = (n.getAttribute('data-listref')||'').trim(); const ent = prefs.entries && prefs.entries[lab];
      let gstyles = {};
      const g = (prefs.groups||[]).find(g=> Array.isArray(g.order) && g.order.includes(lab));
      if(g && g.styles) gstyles = { ...gstyles, ...g.styles };
      const final = { ...gstyles };
      if(ent){ ['hidden','bold','italic','underline','fontSize','color'].forEach(k=>{ if(ent[k] !== undefined && ent[k] !== '' && ent[k] !== null) final[k] = ent[k]; }); }
      n.style.display = final.hidden ? 'none' : '';
      const w = n.querySelector(':scope > .w'); if(w){ w.style.fontWeight = final.bold ? '700' : ''; w.style.fontStyle = final.italic ? 'italic' : ''; w.style.textDecoration = final.underline ? 'underline' : ''; w.style.fontSize = final.fontSize ? (parseInt(final.fontSize,10)||0) + 'px' : ''; w.style.color = final.color || ''; }
    });
  }

  Object.assign(window, {
    collectListRefLabelsFromRendered,
    computeListRefSuggestedOrderFromXml,
    loadListRefPrefs,
    saveListRefPrefs,
    reconcileListRefPrefs,
    showListRefPanel,
    buildListRefControls,
    applyListRefPrefsToArea
  });
})();
