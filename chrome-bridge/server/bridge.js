import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = 7865;
const MAX_BODY_BYTES = 1024 * 1024;
let extensionWs = null;
const pending = new Map();
let nextId = 1;

// HTTP server for Claude to call via curl
const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (isBrowserOriginRequest(req)) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Browser-origin requests are not allowed' }));
    return;
  }

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

  if (req.method === 'POST' && ['/eval', '/run-action', '/navigate', '/type', '/click', '/cdp', '/evalInFrame', '/reload'].includes(req.url)) {
    const bodyResult = await readBody(req);
    if (!bodyResult.ok) {
      res.writeHead(bodyResult.status);
      res.end(JSON.stringify({ error: bodyResult.error }));
      return;
    }
    const body = bodyResult.body;
    const action = req.url === '/run-action' ? 'runAction' : req.url.slice(1);
    const result = await sendToExtension({ action, ...body });
    res.writeHead(result.ok ? 200 : 500);
    res.end(JSON.stringify(result.ok ? result.data : { error: result.error }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

function isBrowserOriginRequest(req) {
  const origin = req.headers.origin || '';
  const fetchSite = req.headers['sec-fetch-site'] || '';

  // Local CLI/agent calls do not send Origin. Browser pages do, even for
  // no-cors simple POSTs. Reject them to prevent websites from driving the
  // localhost bridge and executing code in the user's active Chrome tab.
  if (origin) return true;
  if (fetchSite && fetchSite !== 'none' && fetchSite !== 'same-origin') return true;
  return false;
}

function isForbiddenWebSocketOrigin(req) {
  const origin = req.headers.origin || '';

  // Chrome extension WebSocket connections use a chrome-extension:// origin.
  // Web pages use http(s) origins; do not let arbitrary sites impersonate the
  // extension connection just because they can reach localhost.
  if (!origin) return false;
  return origin.startsWith('http://') || origin.startsWith('https://') || origin === 'null';
}

// WebSocket server for the extension to connect to
const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: ({ req }, done) => {
    const remoteAddress = req.socket.remoteAddress;
    const isLocal = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
    const hasExtension = extensionWs && extensionWs.readyState === 1;
    done(isLocal && !hasExtension && !isForbiddenWebSocketOrigin(req), 403, 'Forbidden');
  }
});

wss.on('connection', (ws, req) => {
  if (extensionWs && extensionWs.readyState === 1) {
    ws.close();
    return;
  }

  // Only accept connections from localhost
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' && remoteAddress !== '::ffff:127.0.0.1') {
    ws.close();
    return;
  }

  if (isForbiddenWebSocketOrigin(req)) {
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
    let done = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (!done && data.length > MAX_BODY_BYTES) {
        done = true;
        resolve({ ok: false, status: 413, error: 'Request body too large' });
        req.destroy();
      }
    });
    req.on('error', () => {
      if (!done) {
        done = true;
        resolve({ ok: false, status: 400, error: 'Failed to read request body' });
      }
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      if (!data) {
        resolve({ ok: true, body: {} });
        return;
      }
      try { resolve({ ok: true, body: JSON.parse(data) }); }
      catch { resolve({ ok: false, status: 400, error: 'Invalid JSON request body' }); }
    });
  });
}

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] Listening on http://127.0.0.1:${PORT}`);
  console.log('[bridge] Waiting for extension to connect...');
});
