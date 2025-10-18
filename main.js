const { app, BrowserWindow, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;

// PWA URL - the online version that auto-updates via service worker
const PWA_URL = 'https://rulingants.github.io/fdat/';

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
    width: 1024,
    height: 768,
    icon: (process.platform === 'darwin') ? undefined : iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // Browser-shell: Load the online PWA instead of local files
  // This allows the PWA's service worker to handle auto-updates
  mainWindow.loadURL(PWA_URL);

  // Handle external links - open in default browser instead of within the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow internal navigation within the app's domain
    if (url.startsWith(PWA_URL)) {
      return { action: 'allow' };
    }
    // Open external links in the default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Also catch navigation events to ensure external links open externally
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation within the PWA domain
    if (url.startsWith(PWA_URL)) {
      return;
    }
    // Prevent navigation and open in external browser
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

// Note: Auto-updates are handled by the PWA's service worker.
// The desktop app is now a browser-shell that loads the online PWA,
// which always serves the latest version via GitHub Pages and service worker caching.

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