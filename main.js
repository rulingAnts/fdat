const { app, BrowserWindow, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;

function resolveIconPath(){
  const base = path.join(__dirname, 'assets');
  const icns = path.join(base, 'icon.icns');
  const ico = path.join(base, 'icon.ico');
  const png = path.join(base, 'icon.png');
  if(process.platform === 'darwin'){
    // BrowserWindow.icon is ignored on macOS; set the Dock icon instead
    if(fs.existsSync(icns)) return icns;
    if(fs.existsSync(png)) return png;
  } else if(process.platform === 'win32'){
    if(fs.existsSync(ico)) return ico;
    if(fs.existsSync(png)) return png;
  } else {
    // Linux prefers PNG
    if(fs.existsSync(png)) return png;
    if(fs.existsSync(ico)) return ico;
  }
  return null;
}

function createWindow() {
  // Set app/dock icon in development so we don't see the default Electron icon
  const iconPath = resolveIconPath();
  if(process.platform === 'darwin' && iconPath && app.dock && typeof app.dock.setIcon === 'function'){
    try{
      const img = nativeImage.createFromPath(iconPath);
      if(!img.isEmpty()) app.dock.setIcon(img);
    }catch(_){ /* non-fatal */ }
  }
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: (process.platform === 'darwin') ? undefined : iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'docs', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

// ===== Auto-updater (only in packaged apps) =====
try{
  const { autoUpdater } = require('electron-updater');
  // Use electron-log for updater logs if available
  try{
    const log = require('electron-log');
    autoUpdater.logger = log;
    if(log && log.transports && log.transports.file){
      log.transports.file.level = 'info';
    }
  }catch(_){ /* optional */ }

  // Simple semver compare without extra deps (returns true if a>b)
  function isNewerVersion(a, b){
    const pa = String(a||'').replace(/^v/i,'').split('.').map(n=> parseInt(n,10)||0);
    const pb = String(b||'').replace(/^v/i,'').split('.').map(n=> parseInt(n,10)||0);
    const len = Math.max(pa.length, pb.length);
    for(let i=0;i<len;i++){
      const x = pa[i]||0, y = pb[i]||0;
      if(x>y) return true; if(x<y) return false;
    }
    return false;
  }

  function checkPortableUpdate(){
    // Query GitHub Releases latest (non-prerelease)
  const owner = 'rulingAnts';
  const repo = 'fdat';
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const options = { headers: { 'User-Agent': 'flexxml-viewer', 'Accept': 'application/vnd.github+json' } };
    try{
      https.get(url, options, (res)=>{
        let data='';
        res.on('data', chunk=> data+=chunk);
        res.on('end', async ()=>{
          try{
            if(res.statusCode !== 200) return; // silent on errors
            const json = JSON.parse(data);
            const latestTag = (json && (json.tag_name || json.name)) || '';
            const current = app.getVersion();
            if(latestTag && isNewerVersion(latestTag, current)){
              const msg = `A newer version (${latestTag}) is available. Portable builds must be updated manually.`;
              const r = await dialog.showMessageBox({
                type: 'info', buttons: ['Open Download Page', 'Later'], defaultId: 0, cancelId: 1,
                message: 'Update Available', detail: msg
              });
              if(r.response === 0){ shell.openExternal(`https://github.com/${owner}/${repo}/releases/latest`); }
            }
          }catch(_){/* ignore */}
        });
      }).on('error', ()=>{});
    }catch(_){/* ignore */}
  }
  function setupAutoUpdater(){
    // Guard: only run in packaged app context
    if(!app.isPackaged) return;
    // Guard: disable updater for Windows portable builds
    const isPortableWin = process.platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_DIR;
    if(isPortableWin){
      try{ autoUpdater.logger && autoUpdater.logger.info && autoUpdater.logger.info('Auto-update disabled (Windows portable build detected).'); }catch(_){/* ignore */}
      // Instead, do a lightweight notify-only check via GitHub API
      checkPortableUpdate();
      return;
    }
    // macOS/Windows cross-platform: default GitHub provider via electron-builder publish config
    autoUpdater.autoDownload = true;
    autoUpdater.on('error', (err)=>{
      // Non-fatal: log, optional dialog in debug builds
      // console.error('AutoUpdater error:', err);
    });
    autoUpdater.on('update-available', ()=>{
      // Optionally inform user; we keep silent and download automatically
    });
    autoUpdater.on('update-downloaded', async (info)=>{
      const res = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Restart and Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: 'An update has been downloaded.',
        detail: 'Restart now to apply the update?'
      });
      if(res.response === 0){ autoUpdater.quitAndInstall(); }
    });
    // Check on startup, then optionally periodically (e.g., every 6 hours)
    autoUpdater.checkForUpdatesAndNotify().catch(()=>{});
    // setInterval(()=> autoUpdater.checkForUpdates().catch(()=>{}), 6 * 60 * 60 * 1000);
  }
  app.on('ready', setupAutoUpdater);
}catch(_){ /* electron-updater not installed in dev */ }

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});