(function(){
  // Utilities expected from other modules: byId, loadJSON, saveJSON, SALIENCE_PREFS_KEY
  // Optional globals: escapeHtml, applyCustomColumnsToArea, renderDocument
  const escapeHtmlFn = (typeof window.escapeHtml === 'function') ? window.escapeHtml : function(s){
    const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
  };

  function showSaliencePanel(show){ const p = byId('saliencePanel'); if(p) p.style.display = show ? 'block' : 'none'; }

  function loadSaliencePrefs(){
    const d = loadJSON(SALIENCE_PREFS_KEY) || {};
    return {
      enabled: d.enabled !== false,
      showLegend: d.showLegend !== false,
      showColumn: !!d.showColumn,
      cellOnly: !!d.cellOnly,
      opacity: (typeof d.opacity === 'number') ? d.opacity : 1,
      tree: Array.isArray(d.tree) ? d.tree : [],
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
      assignments: p.assignments || {}
    };
    (function inherit(list, parentColor){ (list||[]).forEach(n=>{ if(!n.color && parentColor) n.color = parentColor; inherit(n.children||[], n.color || parentColor); }); })(out.tree, null);
    saveJSON(SALIENCE_PREFS_KEY, out);
  }
  function newSalNode(label){ return { id: 'sal_'+Date.now().toString(36)+'_'+Math.floor(Math.random()*1000), label: label||'Band', color: '#fffad1', children: [] }; }
  function findNode(rootList, id){
    const stack = (rootList||[]).map((n,idx)=>({ node:n, parent:null, index:idx, list:rootList }));
    while(stack.length){ const cur = stack.pop(); if(cur.node.id===id) return cur; (cur.node.children||[]).forEach((c,i)=> stack.push({ node:c, parent:cur.node, index:i, list:cur.node.children })); }
    return null;
  }
  function computeSalienceNumbers(tree){
    const map = {};
    (function walk(list, prefix){ (list||[]).forEach((n, i)=>{ const num = prefix ? (prefix + '.' + (i+1)) : String(i+1); map[n.id] = num; walk(n.children||[], num); }); })(tree||[], '');
    return map;
  }
  function initSalienceControls(){
    const listHost = byId('salienceList'); if(!listHost) return;
    const addRootBtn = byId('salAddRoot');
    const clearAssignBtn = byId('salClearAssignments');
    const enabledCb = byId('salienceEnabled');
    const legendCb = byId('salienceShowLegend');
    const colCb = byId('salienceShowColumn');
    const cellOnlyCb = byId('salienceCellOnly');
    const opacityRange = byId('salienceOpacity');
    let prefs = loadSaliencePrefs();
    if(enabledCb){ enabledCb.checked = !!prefs.enabled; enabledCb.addEventListener('change', ()=>{ prefs.enabled = !!enabledCb.checked; persist(); }); }
    if(legendCb){ legendCb.checked = !!prefs.showLegend; legendCb.addEventListener('change', ()=>{ prefs.showLegend = !!legendCb.checked; persist(); }); }
    if(colCb){ colCb.checked = !!prefs.showColumn; colCb.addEventListener('change', ()=>{ prefs.showColumn = !!colCb.checked; persist(); }); }
    if(cellOnlyCb){ cellOnlyCb.checked = !!prefs.cellOnly; cellOnlyCb.addEventListener('change', ()=>{ prefs.cellOnly = !!cellOnlyCb.checked; persist(); }); }
    if(opacityRange){ opacityRange.value = String((typeof prefs.opacity==='number'?prefs.opacity:1)); opacityRange.addEventListener('input', ()=>{ prefs.opacity = Number(opacityRange.value); persist(); }); }
    function persist(options){
      const mergeAssignments = !options || options.mergeAssignments !== false;
      if(mergeAssignments){
        try{
          const latest = loadSaliencePrefs();
          const curA = prefs.assignments || {};
          const latA = (latest && latest.assignments) || {};
          prefs.assignments = Object.assign({}, latA, curA);
          if(!Array.isArray(prefs.tree)){
            if(Array.isArray(latest.tree)) prefs.tree = latest.tree; else prefs.tree = [];
          }
        }catch(_){ /* ignore */ }
      }
      saveSaliencePrefs(prefs);
      refreshSalienceVisuals(byId('renderArea'));
    }
    function removeNode(id){
      function rec(list){ const idx = list.findIndex(x=> x.id===id); if(idx!==-1){ list.splice(idx,1); return true; } return list.some(n=> rec(n.children||[])); }
      rec(prefs.tree);
      const toDelete = new Set(); (function collect(id){ const hit = findNode(prefs.tree, id); if(hit){ toDelete.add(hit.node.id); (hit.node.children||[]).forEach(c=> collect(c.id)); } })(id);
      Object.keys(prefs.assignments).forEach(row=>{ if(toDelete.has(prefs.assignments[row])) delete prefs.assignments[row]; });
    }
    function moveUp(id){ const loc = findNode(prefs.tree, id); if(!loc) return; const arr = loc.list; const i = loc.index; if(i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; persist(); render(); } }
    function moveDown(id){ const loc = findNode(prefs.tree, id); if(!loc) return; const arr = loc.list; const i = loc.index; if(i < arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; persist(); render(); } }
    function promote(id){ const loc = findNode(prefs.tree, id); if(!loc || !loc.parent) return; const parentLoc = findNode(prefs.tree, loc.parent.id); const grandList = parentLoc ? parentLoc.list : prefs.tree; loc.list.splice(loc.index,1); const parentIndex = grandList.indexOf(loc.parent); grandList.splice(parentIndex+1, 0, loc.node); persist(); render(); }
    function demote(id){ const loc = findNode(prefs.tree, id); if(!loc) return; const arr = loc.list; const i = loc.index; if(i<=0) return; const prev = arr[i-1]; prev.children = Array.isArray(prev.children) ? prev.children : []; arr.splice(i,1); prev.children.push(loc.node); persist(); render(); }
    function addChild(id){ const loc = findNode(prefs.tree, id); if(!loc) return; loc.node.children = Array.isArray(loc.node.children) ? loc.node.children : []; loc.node.children.push(newSalNode('Child')); persist(); render(); }
    function render(){
      const nums = computeSalienceNumbers(prefs.tree);
      listHost.innerHTML='';
      function renderList(list, level){
        const ul = document.createElement('ul'); ul.className='salience-tree'; if(level>0) ul.style.marginLeft = (level*16) + 'px';
        (list||[]).forEach((n)=>{
          const li = document.createElement('li'); li.className='sal-item';
          const num = document.createElement('span'); num.className='sal-num'; num.textContent = nums[n.id] || '';
          const color = document.createElement('input'); color.type='color'; color.value = n.color || (level>0 ? (findParentColor(prefs.tree, n.id)||'#fffad1') : '#fffad1'); color.title='Row background'; color.addEventListener('input', ()=>{ n.color=color.value; persist(); refreshSalienceVisuals(byId('renderArea')); });
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
    render();
  }
  function findParentColor(tree, id){ const loc = findNode(tree, id); if(!loc || !loc.parent) return null; return loc.parent.color || findParentColor(tree, loc.parent.id); }
  function buildSalienceOptions(){ const prefs = loadSaliencePrefs(); const nums = computeSalienceNumbers(prefs.tree); const opts = []; (function walk(list){ (list||[]).forEach(n=>{ opts.push({ id:n.id, number: nums[n.id]||'', label: n.label||'', color: n.color||'#fffad1' }); walk(n.children||[]); }); })(prefs.tree||[]); return opts; }
  function showSaliencePicker(title, currentId){ return new Promise(resolve=>{ const overlay = document.createElement('div'); overlay.className='modal-overlay'; const modal = document.createElement('div'); modal.className='modal'; overlay.appendChild(modal); const h = document.createElement('h3'); h.textContent = title || 'Select salience band'; modal.appendChild(h); const sel = document.createElement('select'); sel.style.width='100%'; sel.style.padding='8px'; sel.style.border='1px solid #e5e5e5'; sel.style.borderRadius='6px'; const none = document.createElement('option'); none.value=''; none.textContent='(None)'; sel.appendChild(none); const opts = buildSalienceOptions(); opts.forEach(o=>{ const opt = document.createElement('option'); opt.value=o.id; opt.textContent = `${o.number} — ${o.label || '(unnamed)'}`; if(currentId===o.id) opt.selected=true; sel.appendChild(opt); }); modal.appendChild(sel); const actions = document.createElement('div'); actions.className='modal-actions'; modal.appendChild(actions); const cancel = document.createElement('button'); cancel.className='secondary'; cancel.textContent='Cancel'; const save = document.createElement('button'); save.textContent='Save'; actions.appendChild(cancel); actions.appendChild(save); function done(val){ document.body.removeChild(overlay); resolve(val); } cancel.addEventListener('click', ()=> done(null)); save.addEventListener('click', ()=> done(sel.value || '')); overlay.addEventListener('click', (e)=>{ if(e.target === overlay) done(null); }); document.body.appendChild(overlay); }); }
  function wireSalienceButtons(area){ const tbl = area?.querySelector('table.chartshell'); if(!tbl) return; tbl.querySelectorAll('.add-band-btn').forEach(b=> b.remove()); const prefs = loadSaliencePrefs(); Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{ if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return; const firstCell = tr.querySelector('td'); if(!firstCell) return; const rownumSpan = firstCell.querySelector('.interlinear .pair .w.rownum'); if(!rownumSpan) return; const rowLabel = (typeof window.computeRowLabelFromRow==='function') ? window.computeRowLabelFromRow(tr) : ''; const btn = document.createElement('button'); btn.type='button'; btn.className='add-band-btn'; function setBtnText(){ const a = (loadSaliencePrefs().assignments||{}); const id = a[rowLabel]; if(!id){ btn.textContent = 'Salience band…'; btn.title='Assign a salience band to this row'; } else { const opts = buildSalienceOptions(); const x = opts.find(o=>o.id===id); const num = x ? x.number : ''; const lab = x ? x.label : ''; btn.textContent = num ? `Band ${num}` : 'Band'; btn.title = lab ? lab : 'Assigned band'; } } setBtnText(); btn.addEventListener('click', async ()=>{ const prefs = loadSaliencePrefs(); const a = prefs.assignments||{}; const current = a[rowLabel] ?? ''; const hasBands = (buildSalienceOptions().length > 0); if(!hasBands){ if(confirm('No salience bands defined yet. Open Salience Bands panel to add one?')){ const panel = byId('saliencePanel'); const header = byId('salienceHeader'); if(panel && header && panel.getAttribute('data-collapsed')==='1'){ header.click(); } } return; } const sel = await showSaliencePicker('Salience band — row '+rowLabel, current); if(sel === null) return; const p = loadSaliencePrefs(); p.assignments = p.assignments || {}; if(sel){ p.assignments[rowLabel] = sel; } else { delete p.assignments[rowLabel]; } saveSaliencePrefs(p); setBtnText(); refreshSalienceVisuals(area); }); rownumSpan.parentElement?.appendChild(btn); }); }
  function updateSalienceButtons(area){ const tbl = area?.querySelector('table.chartshell'); if(!tbl) return; Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{ if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return; const firstCell = tr.querySelector('td'); if(!firstCell) return; const rownumSpan = firstCell.querySelector('.interlinear .pair .w.rownum'); if(!rownumSpan) return; const rowLabel = (typeof window.computeRowLabelFromRow==='function') ? window.computeRowLabelFromRow(tr) : ''; const btn = rownumSpan.parentElement?.querySelector('.add-band-btn'); if(!btn) return; const a = (loadSaliencePrefs().assignments||{}); const id = a[rowLabel]; if(!id){ btn.textContent='Salience band…'; btn.title='Assign a salience band to this row'; } else { const opts = buildSalienceOptions(); const x = opts.find(o=>o.id===id); const num = x?x.number:''; const lab=x?x.label:''; btn.textContent = num?`Band ${num}`:'Band'; btn.title = lab||'Assigned band'; } }); }
  function alphaColor(hex, a){ try{ const m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex||'').trim()); if(!m) return hex; let r,g,b; const h=m[1]; if(h.length===3){ r=parseInt(h[0]+h[0],16); g=parseInt(h[1]+h[1],16); b=parseInt(h[2]+h[2],16); } else { r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16); } const alpha = Math.max(0, Math.min(1, (typeof a==='number'?a:1))); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }catch(_){ return hex; } }
  function renderSalienceLegend(){ const area = byId('renderArea'); if(!area) return; area.querySelectorAll(':scope > .chart-salience-legend').forEach(n=> n.remove()); const prefs = loadSaliencePrefs(); if(!(prefs.enabled && prefs.showLegend)) return; const nums = computeSalienceNumbers(prefs.tree); const items = []; (function walk(list){ (list||[]).forEach(n=>{ items.push({ id:n.id, num:nums[n.id]||'', label:n.label||'', color:n.color||findParentColor(prefs.tree, n.id)||'#fffad1' }); walk(n.children||[]); }); })(prefs.tree||[]); if(!items.length) return; const legend = document.createElement('div'); legend.className='chart-salience-legend'; const h = document.createElement('h3'); h.textContent = 'Salience Scheme'; legend.appendChild(h); items.forEach(it=>{ const row = document.createElement('div'); row.className='sal-row'; const sw = document.createElement('span'); sw.className='sal-color'; sw.style.background = alphaColor(it.color, prefs.opacity); const num = document.createElement('strong'); num.textContent = it.num; const lab = document.createElement('span'); lab.textContent = it.label || '(unnamed)'; row.appendChild(sw); row.appendChild(num); row.appendChild(lab); legend.appendChild(row); }); const prologue = area.querySelector(':scope > .chart-prologue'); if(prologue && prologue.nextSibling) area.insertBefore(legend, prologue.nextSibling); else area.insertBefore(legend, area.firstChild || null); }
  function toggleSalienceColumn(){ const area = byId('renderArea'); if(!area) return; const prefs = loadSaliencePrefs(); const tbl = area.querySelector('table.chartshell'); if(!tbl) return; const want = !!prefs.showColumn; const has = !!tbl.querySelector('[data-sal-col="1"]'); if(want && has){ updateSalienceColumnCells(tbl); return; } if(!want && has){ removeSalienceColumn(tbl); return; } if(want && !has){ addSalienceColumn(tbl); return; } }
  function addSalienceColumn(tbl){ const headRows = tbl.querySelectorAll('thead tr.row.title1, thead tr.row.title2'); headRows.forEach(r=>{ const th = document.createElement('th'); th.className='cell sal-cell'; th.textContent = r.classList.contains('title2') ? 'Salience' : ''; th.setAttribute('data-sal-col','1'); r.insertBefore(th, r.firstChild); }); const bodyRows = tbl.querySelectorAll('tbody tr'); bodyRows.forEach(r=>{ if(r.classList.contains('ft-inline')) return; const td = document.createElement('td'); td.className='sal-cell'; td.setAttribute('data-sal-col','1'); r.insertBefore(td, r.firstChild); }); tbl.querySelectorAll('colgroup').forEach(g=>{ const c = document.createElement('col'); g.insertBefore(c, g.firstChild); }); updateSalienceColumnCells(tbl); }
  function removeSalienceColumn(tbl){ tbl.querySelectorAll('[data-sal-col="1"]').forEach(n=> n.remove()); }
  function updateSalienceColumnCells(tbl){ const prefs = loadSaliencePrefs(); const nums = computeSalienceNumbers(prefs.tree); const idTo = {}; (function walk(list){ (list||[]).forEach(n=>{ idTo[n.id] = { num: nums[n.id]||'', label: n.label||'', color: n.color||findParentColor(prefs.tree, n.id)||'#fffad1' }; walk(n.children||[]); }); })(prefs.tree||[]); const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('ft-inline')); rows.forEach(r=>{ const td = r.querySelector(':scope > td[data-sal-col="1"]'); if(!td) return; const rowLabel = (typeof window.computeRowLabelFromRow==='function') ? window.computeRowLabelFromRow(r) : ''; const id = (prefs.assignments||{})[rowLabel]; if(!id){ td.textContent = ''; td.style.background=''; return; } const meta = idTo[id]; if(!meta){ td.textContent=''; td.style.background=''; return; } td.innerHTML = `<span class="sal-pill">${meta.num}</span> ${escapeHtmlFn(meta.label)}`; td.style.background = prefs.enabled ? alphaColor(meta.color, prefs.opacity) : ''; }); }
  function applySalienceBandsToArea(area){ area = area || byId('renderArea'); if(!area) return; const tbl = area.querySelector('table.chartshell'); if(!tbl) return; Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{ if(tr.classList.contains('title1') || tr.classList.contains('title2') || tr.classList.contains('ft-inline')) return; Array.from(tr.children).forEach(td=>{ if(td.dataset.salApplied==='1'){ td.style.backgroundColor=''; delete td.dataset.salApplied; } }); }); const prefs = loadSaliencePrefs(); if(!prefs.enabled){ return; } const idToColor = {}; (function walk(list){ (list||[]).forEach(n=>{ idToColor[n.id]=n.color||'#fffad1'; walk(n.children||[]); }); })(prefs.tree||[]); const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(r=> !r.classList.contains('title1') && !r.classList.contains('title2') && !r.classList.contains('ft-inline')); rows.forEach(tr=>{ const rowLabel = (typeof window.computeRowLabelFromRow==='function') ? window.computeRowLabelFromRow(tr) : ''; const bandId = prefs.assignments[rowLabel]; const color = bandId ? idToColor[bandId] : null; if(!color) return; if(!tr) return; const bg = alphaColor(color, prefs.opacity); if(prefs.cellOnly){ const cell = tr.querySelector(':scope > td[data-sal-col="1"]') || tr.firstElementChild; if(cell){ cell.style.backgroundColor = bg; cell.dataset.salApplied='1'; } } else { Array.from(tr.children).forEach(td=>{ td.style.backgroundColor = bg; td.dataset.salApplied='1'; }); } }); updateSalienceColumnCells(tbl); }
  function refreshSalienceVisuals(area){ try{ area = area || byId('renderArea'); if(!area) return; applySalienceBandsToArea(area); toggleSalienceColumn(); updateSalienceButtons(area); renderSalienceLegend(); if(typeof window.applyCustomColumnsToArea==='function'){ window.applyCustomColumnsToArea(area); } }catch(_){ /* non-fatal */ } }

  // Export to window
  Object.assign(window, {
    showSaliencePanel,
    loadSaliencePrefs,
    saveSaliencePrefs,
    newSalNode,
    findNode,
    computeSalienceNumbers,
    initSalienceControls,
    findParentColor,
    buildSalienceOptions,
    showSaliencePicker,
    wireSalienceButtons,
    updateSalienceButtons,
    alphaColor,
    renderSalienceLegend,
    toggleSalienceColumn,
    addSalienceColumn,
    removeSalienceColumn,
    updateSalienceColumnCells,
    applySalienceBandsToArea,
    refreshSalienceVisuals
  });
})();
