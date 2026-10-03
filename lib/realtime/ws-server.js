/**
 * Central WebSocket Server Foundation
 * Traceability: PondFish API Spec (Sec. 45) & Transaction TV Portal Spec (Sec. 2.4)
 * Uses standard, lightweight 'ws' library. Zero unapproved frameworks.
 */

const { WebSocketServer, WebSocket } = require('ws');

let wss = null;
const clients = new Set();

/**
 * Initialize WebSocket server attached to an existing HTTP server
 * @param {import('http').Server} server
 */
function initWebSocketServer(server) {
  if (wss) return wss;

  wss = new WebSocketServer({
    server,
    path: '/api/v1/realtime',
  });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Handle client ping or subscription requests
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (err) {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS CLIENT ERROR]', err.message);
      clients.delete(ws);
    });

    // Send connection established handshake
    ws.send(
      JSON.stringify({
        type: 'connection_established',
        message: 'Connected to PondFish Realtime Broadcast Server',
        timestamp: new Date().toISOString(),
      })
    );
  });

  // Heartbeat interval to detect terminated connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WS] PondFish Realtime WebSocket Server initialized on /api/v1/realtime');
  return wss;
}

/**
 * Broadcast an event payload to all connected clients
 * @param {string} event - Event name (e.g. 'successful_transaction')
 * @param {object} payload - Event payload
 */
function broadcast(event, payload) {
  const message = JSON.stringify({
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  let deliveredCount = 0;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      deliveredCount++;
    }
  }

  return { deliveredCount, totalClients: clients.size };
}

module.exports = {
  initWebSocketServer,
  broadcast,
};
