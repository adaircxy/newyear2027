const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const host = '127.0.0.1';
const configuredPort = process.env.PORT;
const initialPort = configuredPort === undefined ? 4173 : Number(configuredPort);
const maxPortAttempts = configuredPort === undefined ? 20 : 1;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };

if (!Number.isInteger(initialPort) || initialPort < 1 || initialPort > 65535) {
  console.error(`Invalid PORT value: ${configuredPort}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

let port = initialPort;
let attempts = 0;

server.on('error', error => {
  if (error.code === 'EADDRINUSE' && attempts < maxPortAttempts) {
    console.warn(`Port ${port} is already in use; trying ${port + 1}.`);
    port += 1;
    listen();
    return;
  }

  if (error.code === 'EADDRINUSE') {
    console.error(`Cannot start server: ${host}:${port} is already in use.`);
  } else {
    console.error(`Cannot start server: ${error.message}`);
  }
  process.exitCode = 1;
});

function listen() {
  attempts += 1;
  server.listen(port, host, () => console.log(`http://${host}:${port}`));
}

listen();
