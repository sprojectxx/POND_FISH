/**
 * Central WebSocket Server Foundation with Channel Authorization & Scoped Delivery
 * Traceability: PondFish Phase 3 Realtime & Transaction-Display Security,
 *               API Spec (Sec. 45), Transaction TV Spec (Sec. 2.4, 64-67)
 * Uses standard, lightweight 'ws' library. Zero unapproved frameworks.
 */

const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const { getJwtSecret, getAdminSecret, timingSafeEqualStrings } = require('../auth/admin-auth');

let wss = null;
const clients = new Set();

/**
 * Authenticates an incoming token string.
 * Supports Admin, Worker, and Customer tokens, as well as Administrative API key.
 * @param {string} token
 * @returns {object|null} Authenticated identity or null
 */
function authenticateToken(token) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  // 1. Check Administrative API Key (timing-safe)
  const adminSecret = typeof getAdminSecret === 'function' ? getAdminSecret() : process.env.ADMIN_SECRET;
  if (adminSecret && cleanToken.length === adminSecret.length && timingSafeEqualStrings(cleanToken, adminSecret)) {
    return {
      role: 'ADMIN',
      id: 'admin-system',
      name: 'System Telemetry / API Key',
      sessionId: null,
    };
  }

  // 2. Decode JWT
  const secret = getJwtSecret();
  let decoded;
  try {
    decoded = jwt.verify(cleanToken, secret);
  } catch {
    return null;
  }

  if (!decoded) return null;

  // 3. Admin JWT identity
  if (decoded.role === 'ADMIN' || decoded.is_super_admin === true) {
    return {
      role: 'ADMIN',
      id: decoded.adminId || decoded.id || 'admin',
      name: decoded.name || 'Administrator',
      sessionId: decoded.sessionId || null,
    };
  }

  // 4. Worker JWT identity
  if (decoded.role === 'WORKER') {
    return {
      role: 'WORKER',
      id: decoded.workerId || decoded.id,
      name: decoded.name || 'Worker',
      sessionId: decoded.sessionId || null,
    };
  }

  // 5. Customer JWT identity
  if (decoded.role === 'CUSTOMER' && (decoded.customerId || decoded.id)) {
    return {
      role: 'CUSTOMER',
      id: decoded.customerId || decoded.id,
      mobileNumber: decoded.mobileNumber || null,
      sessionId: decoded.sessionId || null,
    };
  }

  return null;
}

/**
 * Extract auth token from connection HTTP upgrade request (headers, cookies, or URL query)
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
function extractTokenFromRequest(req) {
  if (!req) return null;

  // 1. Query parameter ?token=... or ?apiKey=...
  if (req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const param = url.searchParams.get('token') || url.searchParams.get('apiKey');
      if (param) return param.trim();
    } catch {}
  }

  // 2. Authorization header: Bearer <token>
  const authHeader = req.headers?.['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 3. Cookie headers: admin_session or worker_session
  const cookieHeader = req.headers?.['cookie'] || '';
  if (cookieHeader) {
    const adminMatch = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (adminMatch) return decodeURIComponent(adminMatch[1]).trim();

    const workerMatch = cookieHeader.match(/(?:^|;\s*)worker_session=([^;]+)/);
    if (workerMatch) return decodeURIComponent(workerMatch[1]).trim();
  }

  return null;
}

/**
 * Evaluates whether a client's authenticated identity is authorized to join a channel.
 * @param {object} auth - Client auth identity { role, id, ... }
 * @param {string} channel - Channel identifier
 * @returns {boolean}
 */
function isChannelAuthorized(auth, channel) {
  if (!channel || typeof channel !== 'string') return false;
  const clean = channel.trim();

  // Public channels: accessible to store display monitors and public clients
  if (clean === 'tv:transactions' || clean === 'public:tv' || clean === 'tv') {
    return true;
  }

  // Administrators have full access across all channels
  if (auth && auth.role === 'ADMIN') {
    return true;
  }

  // GPS Telemetry channels: strictly administrator-only
  if (clean === 'admin:gps' || clean === 'gps:live' || clean.startsWith('admin:')) {
    return Boolean(auth && auth.role === 'ADMIN');
  }

  // Worker channels
  if (clean === 'worker:store' || clean.startsWith('worker:')) {
    return Boolean(auth && (auth.role === 'WORKER' || auth.role === 'ADMIN'));
  }

  // Customer channels: customer:<customerId>
  if (clean.startsWith('customer:')) {
    const targetCustId = clean.substring('customer:'.length).trim();
    if (!targetCustId) return false;
    return Boolean(auth && (auth.role === 'ADMIN' || (auth.role === 'CUSTOMER' && auth.id === targetCustId)));
  }

  return false;
}

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
    ws.subscribedChannels = new Set(['tv:transactions']); // Default public TV counter channel

    // Initial connection authentication extraction
    const token = extractTokenFromRequest(req);
    const authIdentity = authenticateToken(token);
    if (authIdentity) {
      ws.auth = authIdentity;
      if (authIdentity.role === 'ADMIN') {
        ws.subscribedChannels.add('gps:live');
        ws.subscribedChannels.add('admin:gps');
      } else if (authIdentity.role === 'CUSTOMER') {
        ws.subscribedChannels.add(`customer:${authIdentity.id}`);
      } else if (authIdentity.role === 'WORKER') {
        ws.subscribedChannels.add('worker:store');
      }
    } else {
      ws.auth = { role: 'ANONYMOUS', id: null };
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'ping') {
          return ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }

        // Dynamic authentication message
        if (data.type === 'auth') {
          const auth = authenticateToken(data.token);
          if (!auth) {
            return ws.send(
              JSON.stringify({
                type: 'error',
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired authentication token.',
                timestamp: new Date().toISOString(),
              })
            );
          }
          ws.auth = auth;
          if (auth.role === 'ADMIN') {
            ws.subscribedChannels.add('gps:live');
            ws.subscribedChannels.add('admin:gps');
          } else if (auth.role === 'CUSTOMER') {
            ws.subscribedChannels.add(`customer:${auth.id}`);
          } else if (auth.role === 'WORKER') {
            ws.subscribedChannels.add('worker:store');
          }
          return ws.send(
            JSON.stringify({
              type: 'auth_success',
              role: auth.role,
              id: auth.id,
              channels: Array.from(ws.subscribedChannels),
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Channel subscription
        if (data.type === 'subscribe') {
          const channel = data.channel;
          if (!channel || typeof channel !== 'string') {
            return ws.send(
              JSON.stringify({
                type: 'error',
                code: 'INVALID_CHANNEL',
                message: 'Channel name is required.',
                timestamp: new Date().toISOString(),
              })
            );
          }

          if (!isChannelAuthorized(ws.auth, channel)) {
            return ws.send(
              JSON.stringify({
                type: 'error',
                code: 'UNAUTHORIZED_CHANNEL',
                channel,
                message: `You are not authorized to subscribe to channel: ${channel}`,
                timestamp: new Date().toISOString(),
              })
            );
          }

          ws.subscribedChannels.add(channel);
          return ws.send(
            JSON.stringify({
              type: 'subscribed',
              channel,
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Channel unsubscription
        if (data.type === 'unsubscribe') {
          const channel = data.channel;
          if (channel) {
            ws.subscribedChannels.delete(channel);
          }
          return ws.send(
            JSON.stringify({
              type: 'unsubscribed',
              channel,
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Security Guard: Forbid client-initiated event publication
        if (data.type === 'publish' || data.type === 'event' || data.event) {
          return ws.send(
            JSON.stringify({
              type: 'error',
              code: 'FORBIDDEN_CLIENT_PUBLISH',
              message: 'Clients are forbidden from publishing realtime events.',
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch {
        // Ignore malformed payloads
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
        authenticated: ws.auth.role !== 'ANONYMOUS',
        role: ws.auth.role,
        channels: Array.from(ws.subscribedChannels),
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

  // Background interval: Periodically sweep expired post-arrival GPS journeys (every 60s)
  const gpsSweepInterval = setInterval(async () => {
    try {
      const gpsTrackingEngine = require('../engines/gps-tracking');
      await gpsTrackingEngine.sweepExpiredJourneys();
    } catch {
      // Non-blocking background sweep
    }
  }, 60000);

  wss.on('close', () => {
    clearInterval(interval);
    clearInterval(gpsSweepInterval);
  });

  console.log('[WS] PondFish Realtime WebSocket Server initialized on /api/v1/realtime');
  return wss;
}

/**
 * Broadcast an event payload to authorized connected clients subscribed to the channel
 * @param {string} event - Event name (e.g. 'successful_transaction', 'gps:live')
 * @param {object} payload - Event payload
 * @param {object} [options]
 * @param {string} [options.channel] - Target channel (defaults to 'tv:transactions' or 'gps:live')
 * @param {string} [options.customerId] - If set, delivers only to customer channel
 * @param {string} [options.targetRole] - If set, requires client role to match
 * @param {boolean} [options.requireAdmin=false] - If true, requires client role === 'ADMIN'
 */
function broadcast(event, payload, { channel = null, customerId = null, targetRole = null, requireAdmin = false } = {}) {
  let effectiveChannel = channel;
  if (!effectiveChannel) {
    if (event === 'successful_transaction') {
      effectiveChannel = 'tv:transactions';
    } else if (event === 'gps:live') {
      effectiveChannel = 'gps:live';
    } else if (customerId) {
      effectiveChannel = `customer:${customerId}`;
    } else {
      effectiveChannel = 'tv:transactions';
    }
  }

  // Force requireAdmin for gps:live channel
  const effectiveRequireAdmin = requireAdmin || effectiveChannel === 'gps:live' || effectiveChannel === 'admin:gps';

  const message = JSON.stringify({
    event,
    data: payload,
    channel: effectiveChannel,
    timestamp: new Date().toISOString(),
  });

  let deliveredCount = 0;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      if (effectiveRequireAdmin && client.auth?.role !== 'ADMIN') {
        continue;
      }
      if (targetRole && client.auth?.role !== targetRole && client.auth?.role !== 'ADMIN') {
        continue;
      }
      if (client.subscribedChannels && client.subscribedChannels.has(effectiveChannel)) {
        if (isChannelAuthorized(client.auth, effectiveChannel)) {
          client.send(message);
          deliveredCount++;
        }
      }
    }
  }

  return { deliveredCount, totalClients: clients.size };
}

/**
 * Deliver event to a specific authenticated customer
 * @param {string} customerId
 * @param {string} event
 * @param {object} payload
 */
function broadcastToCustomer(customerId, event, payload) {
  if (!customerId) return { deliveredCount: 0, totalClients: clients.size };
  return broadcast(event, payload, { channel: `customer:${customerId}`, customerId });
}

/**
 * Deliver event to authenticated workers
 * @param {string} event
 * @param {object} payload
 */
function broadcastToWorkers(event, payload) {
  return broadcast(event, payload, { channel: 'worker:store', targetRole: 'WORKER' });
}

/**
 * Revoke and terminate all active WebSocket connections holding a specific session ID
 * @param {string} sessionId
 * @returns {number} Revoked client count
 */
function revokeRealtimeSession(sessionId) {
  if (!sessionId) return 0;
  let count = 0;
  for (const client of clients) {
    if (client.auth && client.auth.sessionId === sessionId) {
      client.auth = { role: 'ANONYMOUS', id: null };
      client.subscribedChannels = new Set(['tv:transactions']);
      try {
        client.send(
          JSON.stringify({
            type: 'session_revoked',
            code: 'SESSION_REVOKED',
            message: 'Your authentication session has been invalidated or logged out.',
            timestamp: new Date().toISOString(),
          })
        );
        client.close(4401, 'Session revoked');
      } catch (_) {}
      count++;
    }
  }
  return count;
}

/**
 * Diagnostic helper returning connected client count and role distribution
 */
function getConnectedClientsStats() {
  return {
    total: clients.size,
    roles: Array.from(clients).reduce((acc, c) => {
      const r = c.auth?.role || 'ANONYMOUS';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = {
  initWebSocketServer,
  broadcast,
  broadcastToCustomer,
  broadcastToWorkers,
  revokeRealtimeSession,
  authenticateToken,
  isChannelAuthorized,
  getConnectedClientsStats,
};
