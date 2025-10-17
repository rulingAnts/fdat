#!/usr/bin/env node
/*
  Tiny static server for local testing.
  - Serves the project root (..) at http://localhost:5173
  - Adds helpful cache headers for HTML while disabling cache for XSL/XML to avoid stale transforms.
*/
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..', 'docs');
const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const shouldOpen = !('NO_OPEN' in process.env) && !process.argv.includes('--no-open');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',
  '.xsl': 'application/xml; charset=utf-8',
  '.xslt': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, Object.assign({ 'Content-Length': Buffer.byteLength(body) }, headers));
  res.end(body);
}

function setCaching(res, ext) {
  // Disable cache for XML/XSL to force fresh loads while iterating
  if (ext === '.xml' || ext === '.xsl' || ext === '.xslt') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (ext === '.html') {
    // Short cache for HTML so reloads feel responsive but not sticky
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    // Static assets can be cached briefly
    res.setHeader('Cache-Control', 'public, max-age=60');
  }
}

const server = http.createServer((req, res) => {
  try {
    // Normalize and prevent path traversal
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let rel = urlPath.replace(/^\/+/, '');
    if (rel === '') {
      // Root: serve docs/index.html
      rel = 'index.html';
    } else if (rel.endsWith('/')) {
      // Directory path: serve that directory's index.html
      rel = path.join(rel, 'index.html');
    }
    const filePath = path.join(root, rel);
    if (!filePath.startsWith(root)) {
      return send(res, 403, 'Forbidden');
    }
    fs.stat(filePath, (err, stat) => {
      if (err) {
        return send(res, 404, 'Not Found');
      }
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        return fs.readFile(indexPath, (e, data) => {
          if (e) return send(res, 404, 'Not Found');
          const ext = path.extname(indexPath).toLowerCase();
          res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
          setCaching(res, ext);
          res.end(data);
        });
      }
      fs.readFile(filePath, (e, data) => {
        if (e) return send(res, 500, 'Internal Server Error');
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
        setCaching(res, ext);
        res.end(data);
      });
    });
  } catch (e) {
    send(res, 500, 'Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Local test server running at http://localhost:${port}`);
  console.log('Serving web root:', root);
  console.log('Default page: /index.html');

  if (shouldOpen) {
    const url = `http://localhost:${port}/`;
    try {
      console.log('Opening default browser at:', url);
      openBrowser(url);
    } catch (e) {
      console.warn('Could not open the browser automatically. You can open:', url);
    }
  } else {
    console.log('Auto-open disabled. Set NO_OPEN=1 or pass --no-open to control this behavior.');
  }
});

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    // macOS
    const child = spawn('open', [url], { stdio: 'ignore', detached: true });
    child.unref();
    return;
  }
  if (platform === 'win32') {
    // Windows
    const child = spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
    child.unref();
    return;
  }
  // Linux and others
  const child = spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
  child.unref();
}
