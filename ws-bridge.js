const http = require('http');
const net = require('net');
const WebSocket = require('ws');

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_PATH = process.env.WS_PATH || '/app53';
const SSH_PORT = parseInt(process.env.SSH_PORT || '22', 10);
const AUTH_KEY = process.env.AUTH_KEY || 'change-this-key';

const srv = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/' || req.url === '/_ah/health') {
    res.writeHead(200, {'content-type':'text/plain'}); res.end('OK\n'); return;
  }
  res.writeHead(404, {'content-type':'text/plain'}); res.end('not found\n');
});

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on('connection', (ws) => {
  const sock = net.connect(SSH_PORT, '127.0.0.1');
  ws.on('message', (d) => { if (sock.writable) sock.write(d); });
  sock.on('data', (c) => { if (ws.readyState === 1) ws.send(c); });
  const end = ()=>{ try{sock.destroy();}catch{} try{ws.close();}catch{} };
  ws.on('close', end); ws.on('error', end); sock.on('close', end); sock.on('error', end);
});

srv.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith(WS_PATH)) { socket.destroy(); return; }
  const got = req.headers['x-auth'];
  if (AUTH_KEY && AUTH_KEY !== 'change-this-key' && got !== AUTH_KEY) {
    socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

srv.listen(PORT, () => console.log(`[WS-SSH] on :${PORT}${WS_PATH} -> 127.0.0.1:${SSH_PORT}`));
