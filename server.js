/**
 * PondFish Unified Application & Realtime Server
 * Integrates Next.js App Router with the approved 'ws' WebSocket Server.
 * Traceability: PondFish Architecture Baseline & API Spec (Sec. 45)
 */

const http = require('http');
const next = require('next');
const { initWebSocketServer } = require('./lib/realtime/ws-server');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || '3000', 10);

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  // Attach WebSocket server
  initWebSocketServer(server);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> PondFish Unified Server ready on http://localhost:${port}`);
    console.log(`> Realtime WebSocket active at ws://localhost:${port}/api/v1/realtime`);
  });
});
