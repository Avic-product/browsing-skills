import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = 7865;
let extensionWs = null;
const pending = new Map();
let nextId = 1;

// HTTP server for Claude to call via curl
const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (!extensionWs || extensionWs.readyState !== 1) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'Extension not connected' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/tabs') {
    const result = await sendToExtension({ action: 'tabs' });
    res.writeHead(result.ok ? 200 : 500);
    res.end(JSON.stringify(result.ok ? result.data : { error: result.error }));
    return;
  }

  if (req.method === 'POST' && ['/eval', '/wpm', '/navigate', '/type', '/click', '/cdp', '/evalInFrame', '/reload'].includes(req.url)) {
    const body = await readBody(req);
    const action = req.url.slice(1); // '/eval' → 'eval', '/wpm' → 'wpm', '/navigate' → 'navigate'
    const result = await sendToExtension({ action, ...body });
    res.writeHead(result.ok ? 200 : 500);
    res.end(JSON.stringify(result.ok ? result.data : { error: result.error }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// WebSocket server for the extension to connect to
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  // Only accept connections from localhost
  const origin = req.socket.remoteAddress;
  if (origin !== '127.0.0.1' && origin !== '::1' && origin !== '::ffff:127.0.0.1') {
    ws.close();
    return;
  }

  console.log('[bridge] Extension connected');
  extensionWs = ws;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log('[bridge] Got response:', msg.id, msg.ok ? 'ok' : 'err:' + msg.error);
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg);
      } else {
        console.log('[bridge] No pending request for id:', msg.id);
      }
    } catch (e) {
      console.log('[bridge] Failed to parse message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[bridge] Extension disconnected');
    if (extensionWs === ws) extensionWs = null;
  });
});

function sendToExtension(msg) {
  return new Promise((resolve) => {
    const id = nextId++;
    console.log('[bridge] Sending to extension:', id, msg.action);
    const timeout = setTimeout(() => {
      console.log('[bridge] Timeout for request:', id);
      pending.delete(id);
      resolve({ ok: false, error: 'Timeout' });
    }, 30000);

    pending.set(id, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });

    extensionWs.send(JSON.stringify({ id, ...msg }));
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] Listening on http://127.0.0.1:${PORT}`);
  console.log('[bridge] Waiting for extension to connect...');
});
