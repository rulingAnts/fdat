const { app, BrowserWindow, shell, session } = require('electron');

const PROD_URL = 'https://rulingants.github.io/fdat/';
const path = require('path');
const START_URL = process.env.FDAT_SHELL_URL || PROD_URL;
const ALLOWED = [
  PROD_URL,
  'http://localhost:5173/',
  'http://127.0.0.1:5173/'
];

function isAllowed(url) {
  return ALLOWED.some(p => url.startsWith(p));
}

function createWindow() {
  // Splash window (local HTML, shows instantly)
  const splash = new BrowserWindow({
    width: 1280,
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true
    }
  });
  splash.loadFile(path.join(__dirname, 'assets/shell-splash.html'));

  // Main window (hidden until content is ready)
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true
    }
  });

  // Force external links to open outside the shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    if (!isAllowed(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Load with a small retry loop for localhost development to avoid races
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1):\d+\/?/.test(START_URL);
  if (!isLocal) {
    win.loadURL(START_URL).catch(() => {});
  } else {
    let attempts = 0;
    const maxAttempts = 20; // ~10s total at 500ms
    const tryLoad = () => {
      attempts++;
      win.loadURL(START_URL).catch((err) => {
        if (attempts < maxAttempts) {
          setTimeout(tryLoad, 500);
        } else {
          console.warn('[FDAT Shell] Failed to load dev URL after retries:', err?.message || err);
        }
      });
    };
    tryLoad();
  }

  // Once the main window finishes painting, reveal it and close the splash
  const reveal = () => {
    if (!win.isVisible()) win.show();
    if (!win.isMinimized()) win.focus();
    if (!splash.isDestroyed()) splash.close();
  };
  win.webContents.on('dom-ready', () => {
    // dom-ready fires early; we can still reveal to minimize perceived delay
    reveal();
  });
  win.webContents.on('did-finish-load', reveal);
  win.webContents.on('did-fail-load', () => {
    // Keep splash up briefly on failure; the retry loop may still succeed
    // After some time, reveal anyway so user can see error content
    setTimeout(reveal, 3000);
  });
}

async function clearOriginData(targetUrl) {
  try {
    const s = session.defaultSession;
    // Clear storage data for the target origin (localStorage, IndexedDB, CacheStorage via storageData).
    await s.clearStorageData({ origin: targetUrl });
    // Clear service workers and HTTP cache. These are global but fine for a reset flow.
    try { await s.clearServiceWorkers(); } catch (_) {}
    try { await s.clearCache(); } catch (_) {}
  } catch (e) {
    console.warn('[FDAT Shell] Reset failed:', e?.message || e);
  }
}

app.whenReady().then(async () => {
  // Parse flags
  const argv = process.argv.slice(1);
  const reset = argv.includes('--reset');
  const resetAll = argv.includes('--reset-all');
  if (resetAll) {
    // Clear both prod and localhost (dev) scopes
    await clearOriginData(PROD_URL);
    await clearOriginData('http://localhost:5173/');
    await clearOriginData('http://127.0.0.1:5173/');
  } else if (reset) {
    // Clear only the start URL origin
    await clearOriginData(START_URL);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});