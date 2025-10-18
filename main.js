const { app, BrowserWindow, shell } = require('electron');

const PROD_URL = 'https://rulingants.github.io/fdat/';
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
  const win = new BrowserWindow({
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

  win.loadURL(START_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});