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
let heartbeatInterval = null;
let gpsSweepInterval = null;
const clients = new Set();

/**
 * Authenticates an incoming token string.
 * Supports Admin, Worker, Customer, and TV Display tokens, as well as Administrative API key.
 * Administrative API keys are strictly rejected unless allowApiKey is explicitly true (i.e. from secure HTTP headers).
 * @param {string} token
 * @param {object} [options]
 * @param {boolean} [options.allowApiKey=false] - Whether static API key auth is permitted (HTTP upgrade headers only)
 * @returns {object|null} Authenticated identity or null
 */
function authenticateToken(token, { allowApiKey = false } = {}) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  // 1. Check Administrative API Key (timing-safe) — ONLY permitted if allowApiKey is explicitly enabled
  if (allowApiKey) {
    const adminSecret = typeof getAdminSecret === 'function' ? getAdminSecret() : process.env.ADMIN_SECRET;
    if (adminSecret && cleanToken.length === adminSecret.length && timingSafeEqualStrings(cleanToken, adminSecret)) {
      return {
        role: 'ADMIN',
        id: 'admin-system',
        name: 'System Telemetry / API Key',
        sessionId: null,
        source: 'api_key',
      };
    }
  }

  // 2. Decode JWT (Admin, Worker, Customer, TV)
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

  // 4. Worker JWT identity with Store Scoping
  if (decoded.role === 'WORKER') {
    const storeId = decoded.storeId || decoded.store_id || process.env.PONDFISH_STORE_ID || 'main_store';
    return {
      role: 'WORKER',
      id: decoded.workerId || decoded.id,
      name: decoded.name || 'Worker',
      sessionId: decoded.sessionId || null,
      storeId,
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

  // 6. TV Display JWT identity
  if (decoded.role === 'TV' || decoded.role === 'DISPLAY') {
    return {
      role: 'TV',
      id: decoded.displayId || decoded.id || 'tv-display',
      storeId: decoded.storeId || decoded.store_id || process.env.PONDFISH_STORE_ID || 'main_store',
      sessionId: decoded.sessionId || null,
    };
  }

  return null;
}

/**
 * Extract auth credentials from connection HTTP upgrade request.
 * Enforces credential hygiene:
 * - Administrative API keys are accepted ONLY from secure HTTP headers (x-admin-key or Authorization), NEVER from URL query strings.
 * - URL query parameters (?token=...) are strictly limited to signed, time-limited JWT session tokens.
 * @param {import('http').IncomingMessage} req
 * @returns {{ token: string|null, isHeaderApiKey: boolean }}
 */
function extractCredentialsFromRequest(req) {
  if (!req) return { token: null, isHeaderApiKey: false };

  // 1. Dedicated Header: x-admin-key (permitted for API key)
  const xAdminKey = req.headers?.['x-admin-key'];
  if (xAdminKey && typeof xAdminKey === 'string' && xAdminKey.trim()) {
    return { token: xAdminKey.trim(), isHeaderApiKey: true };
  }

  // 2. Authorization header: Bearer <token> (permitted for API key or JWT)
  const authHeader = req.headers?.['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    return { token, isHeaderApiKey: true };
  }

  // 3. Cookie headers: admin_session, worker_session, or customer_token (JWT only)
  const cookieHeader = req.headers?.['cookie'] || '';
  if (cookieHeader) {
    const adminMatch = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (adminMatch) return { token: decodeURIComponent(adminMatch[1]).trim(), isHeaderApiKey: false };

    const workerMatch = cookieHeader.match(/(?:^|;\s*)worker_session=([^;]+)/);
    if (workerMatch) return { token: decodeURIComponent(workerMatch[1]).trim(), isHeaderApiKey: false };

    const customerMatch = cookieHeader.match(/(?:^|;\s*)customer_token=([^;]+)/);
    if (customerMatch) return { token: decodeURIComponent(customerMatch[1]).trim(), isHeaderApiKey: false };
  }

  // 4. Query parameter ?token=... — STRICTLY RESTRICTED TO SIGNED JWT SESSIONS.
  // API keys are forbidden in query strings to avoid leaking secrets in web-server access logs and proxy history.
  if (req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const param = url.searchParams.get('token');
      if (param) return { token: param.trim(), isHeaderApiKey: false };
    } catch {}
  }

  return { token: null, isHeaderApiKey: false };
}

/**
 * Backward-compatible helper extracting raw token from request
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
function extractTokenFromRequest(req) {
  return extractCredentialsFromRequest(req).token;
}

/**
 * Evaluates whether a client's authenticated identity is authorized to join a channel.
 * Enforces:
 * 1. Store scoping for worker channels (worker:store:<storeId>).
 * 2. Strict Admin-only access for GPS telemetry.
 * 3. Customer isolation (customer:<customerId>).
 * 4. Configurable TV Display access control (tv:transactions / tv:store:<storeId>).
 * @param {object} auth - Client auth identity { role, id, storeId, ... }
 * @param {string} channel - Channel identifier
 * @returns {boolean}
 */
function isChannelAuthorized(auth, channel) {
  if (!channel || typeof channel !== 'string') return false;
  const clean = channel.trim();

  // TV display channels
  const isTvChannel = clean === 'tv:transactions' || clean === 'public:tv' || clean === 'tv' || clean.startsWith('tv:store:');
  if (isTvChannel) {
    if (auth && auth.role === 'ADMIN') {
      return true;
    }

    const tvAuthRequired = process.env.PONDFISH_TV_AUTH_REQUIRED === 'true';
    if (tvAuthRequired) {
      if (!auth || (auth.role !== 'TV' && auth.role !== 'WORKER')) {
        return false;
      }
      if (clean.startsWith('tv:store:')) {
        const reqStore = clean.substring('tv:store:'.length).trim();
        const userStore = auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
        return Boolean(reqStore && userStore && reqStore === userStore);
      }
      // Non-admins cannot access global/unscoped TV channels
      return false;
    }

    // Kiosk mode (PONDFISH_TV_AUTH_REQUIRED !== 'true'):
    // An anonymous kiosk display or TV/Worker client can access ONLY the authorized/configured store's TV channel
    if (auth && auth.role !== 'TV' && auth.role !== 'WORKER' && auth.role !== 'ANONYMOUS') {
      return false;
    }

    if (clean.startsWith('tv:store:')) {
      const reqStore = clean.substring('tv:store:'.length).trim();
      const userStore = (auth && auth.storeId) ? auth.storeId : (process.env.PONDFISH_STORE_ID || 'main_store');
      return Boolean(reqStore && userStore && reqStore === userStore);
    }

    // Global TV channels (e.g. tv:transactions, public:tv, tv) are NOT permitted for non-admins
    return false;
  }

  // Administrators have full access across all channels
  if (auth && auth.role === 'ADMIN') {
    return true;
  }

  // GPS Telemetry channels: strictly administrator-only
  if (clean === 'admin:gps' || clean === 'gps:live' || clean.startsWith('admin:')) {
    return Boolean(auth && auth.role === 'ADMIN');
  }

  // Worker channels: strictly store-scoped
  if (clean.startsWith('worker:store:') || clean.startsWith('store:')) {
    if (!auth || auth.role !== 'WORKER') return false;
    const requestedStoreId = clean.startsWith('worker:store:')
      ? clean.substring('worker:store:'.length).trim()
      : clean.split(':')[1]?.trim();
    const authorizedStore = auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
    // Reject subscription if worker's store does not match the requested store
    return Boolean(requestedStoreId && authorizedStore && authorizedStore === requestedStoreId);
  }

  if (clean === 'worker:store') {
    if (!auth || auth.role !== 'WORKER') return false;
    const authorizedStore = auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
    return Boolean(authorizedStore);
  }

  // Customer channels: customer:<customerId>
  if (clean.startsWith('customer:')) {
    const targetCustId = clean.substring('customer:'.length).trim();
    if (!targetCustId) return false;
    return Boolean(auth && auth.role === 'CUSTOMER' && auth.id === targetCustId);
  }

  return false;
}

/**
 * Initialize WebSocket server attached to an existing HTTP server
 * @param {import('http').Server} server
 * @param {object} [options]
 * @param {boolean} [options.force=false] - If true, replaces existing wss instance
 */
function initWebSocketServer(server, { force = false } = {}) {
  if (wss && !force) return wss;

  if (wss && force) {
    try {
      for (const client of clients) {
        try { client.terminate(); } catch (_) {}
      }
      clients.clear();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (gpsSweepInterval) clearInterval(gpsSweepInterval);
      wss.close();
    } catch (_) {}
    wss = null;
  }

  wss = new WebSocketServer({
    server,
    path: '/api/v1/realtime',
  });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    ws.isAlive = true;

    // Initial connection authentication extraction
    const { token, isHeaderApiKey } = extractCredentialsFromRequest(req);
    const authIdentity = authenticateToken(token, { allowApiKey: isHeaderApiKey });
    const tvAuthRequired = process.env.PONDFISH_TV_AUTH_REQUIRED === 'true';

    ws.subscribedChannels = new Set();

    if (authIdentity) {
      ws.auth = authIdentity;
      if (authIdentity.role === 'ADMIN') {
        ws.subscribedChannels.add('gps:live');
        ws.subscribedChannels.add('admin:gps');
      } else if (authIdentity.role === 'CUSTOMER') {
        ws.subscribedChannels.add(`customer:${authIdentity.id}`);
      } else if (authIdentity.role === 'WORKER') {
        const storeId = authIdentity.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
        ws.subscribedChannels.add(`worker:store:${storeId}`);
        ws.subscribedChannels.add('worker:store');
        ws.subscribedChannels.add(`tv:store:${storeId}`);
      } else if (authIdentity.role === 'TV') {
        const storeId = authIdentity.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
        ws.subscribedChannels.add(`tv:store:${storeId}`);
      }
    } else {
      const kioskStoreId = process.env.PONDFISH_STORE_ID || 'main_store';
      ws.auth = { role: 'ANONYMOUS', id: null, storeId: kioskStoreId };
      if (!tvAuthRequired) {
        ws.subscribedChannels.add(`tv:store:${kioskStoreId}`);
      }
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

        // Dynamic authentication message (strictly JWT tokens; API keys disallowed)
        if (data.type === 'auth') {
          const auth = authenticateToken(data.token, { allowApiKey: false });
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
            const storeId = auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
            ws.subscribedChannels.add(`worker:store:${storeId}`);
            ws.subscribedChannels.add('worker:store');
            ws.subscribedChannels.add(`tv:store:${storeId}`);
          } else if (auth.role === 'TV') {
            const storeId = auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
            ws.subscribedChannels.add(`tv:store:${storeId}`);
          }
          return ws.send(
            JSON.stringify({
              type: 'auth_success',
              role: auth.role,
              id: auth.id,
              storeId: auth.storeId || null,
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
  heartbeatInterval = setInterval(() => {
    if (!wss || !wss.clients) return;
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
  gpsSweepInterval = setInterval(async () => {
    try {
      const gpsTrackingEngine = require('../engines/gps-tracking');
      await gpsTrackingEngine.sweepExpiredJourneys();
    } catch {
      // Non-blocking background sweep
    }
  }, 60000);

  wss.on('close', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (gpsSweepInterval) clearInterval(gpsSweepInterval);
  });

  console.log('[WS] PondFish Realtime WebSocket Server initialized on /api/v1/realtime');
  return wss;
}

/**
 * Gracefully close the WebSocket server, terminate client sockets, and clear intervals.
 */
async function closeWebSocketServer() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (gpsSweepInterval) {
    clearInterval(gpsSweepInterval);
    gpsSweepInterval = null;
  }
  for (const client of clients) {
    try {
      client.terminate();
    } catch (_) {}
  }
  clients.clear();
  if (wss) {
    await new Promise((resolve) => {
      wss.close(() => resolve());
    });
    wss = null;
  }
}

/**
 * Broadcast an event payload to authorized connected clients subscribed to the channel.
 * Enforces server-side store scoping and role restrictions.
 * @param {string} event - Event name (e.g. 'successful_transaction', 'gps:live')
 * @param {object} payload - Event payload
 * @param {object} [options]
 * @param {string} [options.channel] - Target channel (defaults to 'tv:transactions' or 'gps:live')
 * @param {string} [options.customerId] - If set, delivers only to customer channel
 * @param {string} [options.targetRole] - If set, requires client role to match (or ADMIN)
 * @param {string} [options.storeId] - If set, requires worker/tv storeId to match (or ADMIN)
 * @param {boolean} [options.requireAdmin=false] - If true, requires client role === 'ADMIN'
 */
function broadcast(event, payload, { channel = null, customerId = null, targetRole = null, storeId = null, requireAdmin = false } = {}) {
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

  // Derive target store if not explicitly passed
  const effectiveStoreId = storeId || (
    effectiveChannel && typeof effectiveChannel === 'string'
      ? (effectiveChannel.startsWith('tv:store:') ? effectiveChannel.substring('tv:store:'.length).trim()
        : (effectiveChannel.startsWith('worker:store:') ? effectiveChannel.substring('worker:store:'.length).trim() : null))
      : null
  );

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
      // Store scoping: enforce store matching for every relevant recipient role
      if (effectiveStoreId && client.auth?.role !== 'ADMIN') {
        if (client.auth?.role === 'WORKER') {
          const clientStore = client.auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
          if (clientStore !== effectiveStoreId) continue;
        } else if (client.auth?.role === 'TV') {
          const clientStore = client.auth.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
          if (clientStore !== effectiveStoreId) continue;
        } else if (!client.auth || client.auth.role === 'ANONYMOUS') {
          const kioskStore = client.auth?.storeId || process.env.PONDFISH_STORE_ID || 'main_store';
          if (kioskStore !== effectiveStoreId) continue;
        } else if (client.auth?.role === 'CUSTOMER') {
          // Customers never receive store-scoped broadcasts
          continue;
        }
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
 * Deliver event to authenticated workers for a specific store.
 * Prevents Store A workers from receiving Store B events.
 * @param {string} event
 * @param {object} payload
 * @param {object} [options]
 * @param {string} [options.storeId] - Target store ID (defaults to authoritative store)
 */
function broadcastToWorkers(event, payload, { storeId = null } = {}) {
  const targetStore = storeId || process.env.PONDFISH_STORE_ID || 'main_store';
  return broadcast(event, payload, {
    channel: `worker:store:${targetStore}`,
    targetRole: 'WORKER',
    storeId: targetStore,
  });
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
      client.subscribedChannels.clear();
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
      clients.delete(client);
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
  closeWebSocketServer,
  broadcast,
  broadcastToCustomer,
  broadcastToWorkers,
  revokeRealtimeSession,
  authenticateToken,
  extractCredentialsFromRequest,
  extractTokenFromRequest,
  isChannelAuthorized,
  getConnectedClientsStats,
};
