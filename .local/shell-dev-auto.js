#!/usr/bin/env node
// Ensure the local dev server (http://localhost:5173) is running, then start the Electron shell.
// Usage: node .local/shell-dev-auto.js [--reset]

import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = 5173;
const URL = `http://localhost:${PORT}/`;

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { try{ req.destroy(); }catch{} resolve(false); });
  });
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkServer()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const wantReset = args.includes('--reset');
  let startedServer = false;
  let serverProc = null;

  const up = await checkServer();
  if (!up) {
    // Start dev server without opening browser
    serverProc = spawn(process.execPath, ['.local/dev-server.js'], {
      env: { ...process.env, NO_OPEN: '1' },
      stdio: 'inherit'
    });
    startedServer = true;
    const ok = await waitForServer();
    if (!ok) {
      console.error('[shell-dev-auto] Dev server did not respond in time.');
      if (serverProc) serverProc.kill('SIGINT');
      process.exit(1);
    }
  }

  // Launch electron shell pointed to localhost
  const electronCmd = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  const electronProc = spawn(electronCmd, ['.', ...(wantReset ? ['--reset'] : [])], {
    env: { ...process.env, FDAT_SHELL_URL: `http://localhost:${PORT}` },
    stdio: 'inherit'
  });

  const cleanup = () => {
    try { electronProc.kill('SIGINT'); } catch {}
    if (startedServer && serverProc) {
      try { serverProc.kill('SIGINT'); } catch {}
    }
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  electronProc.on('exit', (code) => {
    if (startedServer && serverProc) {
      try { serverProc.kill('SIGINT'); } catch {}
    }
    process.exit(code ?? 0);
  });
}

main().catch((e) => { console.error('[shell-dev-auto] Failed:', e); process.exit(1); });
