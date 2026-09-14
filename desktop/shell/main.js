// FDAT Desktop shell (starter). See ../PLAN.md.
//
// - Serves the bundled chart renderer (the web app in docs/) from an app:// scheme,
//   so fetch() of the XSL works without a web server and nothing is loaded remotely.
// - Spawns the LCM sidecar (../sidecar/fdat_lcm.py) and forwards JSON-RPC calls
//   from the renderer (window.fdatHost, see preload.js) over stdio.
// - Injects host-glue.js into index.html, which adds the "Open from FLEx" controls.
//
// Environment overrides while developing:
//   FDAT_RENDERER_DIR   folder holding index.html/app.js/textchart (default: ../../docs)
//   FDAT_SIDECAR_PYTHON python executable that has flexlibs installed (default: python)
//   FDAT_SIDECAR        path to fdat_lcm.py (default: ../sidecar/fdat_lcm.py)
const { app, BrowserWindow, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const RENDERER_DIR = path.resolve(process.env.FDAT_RENDERER_DIR || path.join(__dirname, '..', '..', 'docs'));
const SIDECAR = path.resolve(process.env.FDAT_SIDECAR || path.join(__dirname, '..', 'sidecar', 'fdat_lcm.py'));
const PYTHON = process.env.FDAT_SIDECAR_PYTHON || 'python';
const APP_HOST = 'fdat';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } }
]);

// ---------------------------------------------------------------------------
// Sidecar supervision + JSON-RPC over stdio
// ---------------------------------------------------------------------------
class Sidecar {
  constructor() { this.proc = null; this.nextId = 1; this.pending = new Map(); }

  start() {
    if (this.proc) return;
    this.proc = spawn(PYTHON, [SIDECAR, 'serve'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => this.onLine(line));
    this.proc.stderr.on('data', (d) => console.error('[sidecar]', String(d).trimEnd()));
    this.proc.on('exit', (code) => {
      console.warn('[sidecar] exited with code', code);
      for (const p of this.pending.values()) p.reject(new Error('LCM sidecar exited (code ' + code + ')'));
      this.pending.clear();
      this.proc = null;
    });
  }

  onLine(line) {
    let msg; try { msg = JSON.parse(line); } catch (_) { console.error('[sidecar] bad JSON:', line); return; }
    const p = this.pending.get(msg.id); if (!p) return;
    this.pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message || 'sidecar error'));
    else p.resolve(msg.result);
  }

  call(method, params) {
    this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
    });
  }

  stop() { if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch (_) {} this.proc = null; } }
}
const sidecar = new Sidecar();

// Only these methods are reachable from the renderer.
const RPC_ALLOWED = new Set(['ping', 'listProjects', 'openProject', 'closeProject', 'listCharts', 'exportChart']);
ipcMain.handle('fdat:rpc', (_evt, method, params) => {
  if (!RPC_ALLOWED.has(method)) throw new Error('method not allowed: ' + method);
  return sidecar.call(method, params);
});

// ---------------------------------------------------------------------------
// app://fdat/  →  bundled renderer
// ---------------------------------------------------------------------------
function serveRenderer() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (rel === '__host/host-glue.js') return net.fetch(pathToFileURL(path.join(__dirname, 'host-glue.js')).toString());
    const file = path.join(RENDERER_DIR, rel);
    if (!file.startsWith(RENDERER_DIR)) return new Response('Forbidden', { status: 403 });
    if (rel === 'index.html') {
      // Inject the host glue and drop the service worker (offline caching is meaningless here).
      let html = await fs.promises.readFile(file, 'utf8');
      html = html.replace('</body>', '<script src="app://fdat/__host/host-glue.js"></script>\n</body>');
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (rel === 'sw.js') return new Response('// service worker disabled in the desktop shell\n', { headers: { 'content-type': 'text/javascript' } });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  // Anything outside the bundled renderer opens in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://') || url === '' || url === 'about:blank' || url.startsWith('data:text/html')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  win.loadURL(`app://${APP_HOST}/index.html`);
}

app.whenReady().then(() => {
  serveRenderer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { sidecar.stop(); app.quit(); });
app.on('before-quit', () => sidecar.stop());
