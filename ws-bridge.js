// Simple SSH over WebSocket bridge for Cloud Run
// - Accepts WSS upgrade on path WS_PATH (default /app53)
// - Proxies raw frames <-> TCP 127.0.0.1:22
// - Optional header "X-Auth: <AUTH_KEY>" gate

const http = require('http');
const net = require('net');
const WebSocket = require('ws');

const PORT    = parseInt(process.env.PORT || '8080', 10);
const WS_PATH = process.env.WS_PATH || '/app53';
const SSH_HOST = '127.0.0.1';
const SSH_PORT = parseInt(process.env.SSH_PORT || '22', 10);
const AUTH_KEY = process.env.AUTH_KEY || 'change-this-key';

function log(...args) { console.log('[WS-SSH]', ...args); }

const srv = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, {'content-type':'text/plain'}); res.end('OK\n'); return;
  }
  res.writeHead(404); res.end('not found\n');
});

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on('connection', (ws, req) => {
  // Connect TCP to local SSH
  const sock = net.connect(SSH_PORT, SSH_HOST);
  sock.on('connect', () => log('TCP connected', `${SSH_HOST}:${SSH_PORT}`));

  // Binary pass-through
  ws.on('message', (data) => { if (sock.writable) sock.write(data); });
  sock.on('data', (chunk) => { if (ws.readyState === 1) ws.send(chunk); });

  // Tear-down
  const shutdown = () => { try { sock.destroy(); } catch{} try { ws.close(); } catch{} };
  ws.on('close', shutdown);
  ws.on('error', shutdown);
  sock.on('close', shutdown);
  sock.on('error', shutdown);
});

srv.on('upgrade', (req, socket, head) => {
  // Only accept our WS_PATH
  if (!req.url.startsWith(WS_PATH)) {
    socket.destroy(); return;
  }
  // Optional simple auth via header
  const got = req.headers['x-auth'];
  if (AUTH_KEY && AUTH_KEY !== 'change-this-key' && got !== AUTH_KEY) {
    socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

srv.listen(PORT, () => log(`HTTP+WS listening on :${PORT}${WS_PATH} -> ${SSH_HOST}:${SSH_PORT}`));
