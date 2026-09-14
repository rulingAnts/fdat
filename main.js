// FDAT desktop shell: a thin Electron window around the online PWA.
//
// The renderer is the published web app (PROD_URL) or a local dev server
// (FDAT_SHELL_URL). Nothing privileged is exposed to the page: no preload, no
// node integration. See desktop/PLAN.md for the FLEx-integrated successor.
const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const PROD_URL = 'https://rulingants.github.io/fdat/';
const DEV_URLS = ['http://localhost:5173/', 'http://127.0.0.1:5173/'];
const START_URL = process.env.FDAT_SHELL_URL || PROD_URL;
// Navigation is allowed within the published app, the default dev server, and
// whatever START_URL points at (so a custom PORT for the dev server also works).
const ALLOWED = [PROD_URL, ...DEV_URLS, START_URL.replace(/\/?$/, '/')];

function isAllowed(url) {
  return ALLOWED.some(p => url.startsWith(p));
}

function createWindow() {
  // Splash window (local HTML, shows instantly)
  const splash = new BrowserWindow({
    width: 420,
    height: 220,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#f7faff',
    show: true,
    webPreferences: { sandbox: true }
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

  // Force external links to open outside the shell. Allow opt-out via __ext=1.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.searchParams.get('__ext') === '1') {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    } catch (_) { /* ignore parse errors */ }

    // Allow data URLs for export functionality
    if (url.startsWith('data:text/html')) {
      return { action: 'allow' };
    }

    // Allow empty URLs for creating blank windows (export functionality)
    if (url === '' || url === 'about:blank') {
      return { action: 'allow' };
    }

    if (isAllowed(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    // Allow local file:// for bundled splash/error pages
    if (url.startsWith('file://')) return;
    if (!isAllowed(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Load with a small retry loop for localhost development to avoid races
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1):\d+\/?/.test(START_URL);
  let devAttempts = 0;
  const maxAttempts = 20; // ~10s total at 500ms

  function showErrorPage(errCode, errDesc, failingUrl) {
    try {
      const fileUrl = pathToFileURL(path.join(__dirname, 'assets', 'shell-error.html')).toString();
      const qs = new URLSearchParams({
        target: START_URL,
        prod: PROD_URL,
        local: isLocal ? '1' : '0',
        code: String(errCode ?? ''),
        err: errDesc ? String(errDesc) : '',
        url: failingUrl || ''
      }).toString();
      win.loadURL(`${fileUrl}?${qs}`).catch(() => {});
    } catch (e) {
      // As a last resort, reveal the blank window so errors are visible in devtools
      if (!win.isVisible()) win.show();
      if (!splash.isDestroyed()) splash.close();
    }
  }
  if (!isLocal) {
    win.loadURL(START_URL).catch(() => {});
  } else {
    const tryLoad = () => {
      devAttempts++;
      win.loadURL(START_URL).catch((err) => {
        if (devAttempts < maxAttempts) {
          setTimeout(tryLoad, 500);
        } else {
          console.warn('[FDAT Shell] Failed to load dev URL after retries:', err?.message || err);
          // Load local error page with details
          showErrorPage(undefined, err?.message || String(err), START_URL);
        }
      });
    };
    tryLoad();
  }

  // Reveal main only after some content finishes loading (PWA or error page)
  const reveal = () => {
    if (!win.isVisible()) win.show();
    if (!win.isMinimized()) win.focus();
    if (!splash.isDestroyed()) splash.close();
  };
  win.webContents.on('did-finish-load', reveal);
  win.webContents.on('did-fail-load', (_evt, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Ignore subframe failures and ERR_ABORTED (-3), which fires when a load is superseded, not when it fails.
    if (!isMainFrame || errorCode === -3) return;
    // For dev retries, keep splash visible. When retries are exhausted (or non-local), load error page; it will trigger did-finish-load => reveal.
    if (!isLocal || devAttempts >= maxAttempts) {
      showErrorPage(errorCode, errorDescription, validatedURL);
    }
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
    for (const u of DEV_URLS) await clearOriginData(u);
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
