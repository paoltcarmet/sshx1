// SSH over WebSocket proxy for Cloud Run
const http = require('http');
const net = require('net');
const WebSocket = require('ws');

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_PATH = process.env.WS_PATH || '/app53';
const SSH_PORT = parseInt(process.env.SSH_PORT || '22', 10);
const AUTH_KEY = process.env.AUTH_KEY || 'change-this-key';

function log(...args) { console.log('[WS-SSH]', ...args); }

// HTTP server for health + 404
const srv = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/' || req.url === '/_ah/health') {
    res.writeHead(200, {'content-type':'text/plain'}); res.end('OK\n'); return;
  }
  res.writeHead(404, {'content-type':'text/plain'}); res.end('not found\n');
});

// WS server that bridges frames <-> TCP 127.0.0.1:22
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on('connection', (ws, req) => {
  const sock = net.connect(SSH_PORT, '127.0.0.1');
  sock.on('connect', () => log('TCP connected -> 127.0.0.1:' + SSH_PORT));

  ws.on('message', (d) => { if (sock.writable) sock.write(d); });
  sock.on('data', (c) => { if (ws.readyState === WebSocket.OPEN) ws.send(c); });

  const end = () => { try{sock.destroy();}catch{} try{ws.close();}catch{} };
  ws.on('close', end); ws.on('error', end);
  sock.on('close', end); sock.on('error', end);
});

// Only upgrade on the configured path; optional X-Auth guard
srv.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith(WS_PATH)) { socket.destroy(); return; }
  const got = req.headers['x-auth'];
  if (AUTH_KEY && AUTH_KEY !== 'change-this-key' && got !== AUTH_KEY) {
    socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

srv.listen(PORT, () => log(`HTTP+WS listening on :${PORT}${WS_PATH} -> 127.0.0.1:${SSH_PORT}`));
