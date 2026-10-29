/**
 * Engine 23: Worker Portal Fulfillment & Handover Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Sections 14, 15, 22) &
 * Worker Portal Specification (Sections 9–18, 69)
 * Full orchestration for worker authentication, today's queue, search,
 * cryptographic QR verification, order preparation, atomic inventory consumption,
 * financial transaction recording, and irreversible booking completion.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db/pool');
const workerRepository = require('../db/repositories/workerRepository');
const bookingRepository = require('../db/repositories/bookingRepository');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const qrVerificationEngine = require('./qr-verification');
const domainEventsEngine = require('./domain-events');
const auditEngine = require('./audit');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production.');
    }
    return 'pondfish-dev-only-secret-do-not-use-in-production';
  }
  return secret;
}

const WORKER_TOKEN_EXPIRY = '12h'; // Store shift duration
const WORKER_SESSION_SETTING_KEY = 'worker_active_sessions';

// In-memory worker session registry & revoked tokens/session IDs set
const inMemoryWorkerSessions = new Map();
const inMemoryRevokedWorkerSessions = new Set();

/**
 * Determines whether in-memory worker session fallback is permitted.
 * Strictly restricted to explicit, intentional test execution environments.
 * An accidental deployed configuration of NODE_ENV=test will NOT permit fallback:
 * the explicit test guard ALLOW_TEST_SESSION_FALLBACK='true' must also be present.
 * Under ANY production or development runtime, fallback is completely disallowed.
 */
function isPermittedInMemorySessionEnvironment() {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
    return false;
  }
  if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_SESSION_FALLBACK === 'true') {
    return true;
  }
  return false;
}

/**
 * Load worker session registry from DB settings table if available
 */
// Short-lived in-process TTL cache for worker session registry to reduce database load during rapid bursts (e.g. tablet customer search)
let workerRegistryCache = null;
let workerRegistryCacheExpires = 0;
const REGISTRY_CACHE_TTL_MS = 2000;

function invalidateWorkerSessionRegistryCache() {
  workerRegistryCache = null;
  workerRegistryCacheExpires = 0;
}

async function loadWorkerSessionRegistry() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // In-memory fallback is strictly restricted to intentional isolated test environments
    if (isPermittedInMemorySessionEnvironment()) {
      const activeRegistry = {};
      const now = Date.now();
      for (const [sid, session] of inMemoryWorkerSessions.entries()) {
        if (session.expiresAt && session.expiresAt > now) {
          activeRegistry[sid] = session;
        }
      }
      return activeRegistry;
    }

    const dbErr = new Error('DATABASE_URL is not configured. Persistent worker session registry required.');
    dbErr.code = 'SESSION_REGISTRY_UNAVAILABLE';
    dbErr.status = 500;
    throw dbErr;
  }

  const now = Date.now();
  if (workerRegistryCache && now < workerRegistryCacheExpires) {
    const activeRegistry = {};
    for (const [sid, session] of Object.entries(workerRegistryCache)) {
      if (session && session.expiresAt && session.expiresAt > now) {
        activeRegistry[sid] = session;
      }
    }
    return activeRegistry;
  }

  try {
    const res = await db.query('SELECT value FROM settings WHERE key = $1 LIMIT 1;', [WORKER_SESSION_SETTING_KEY]);
    if (res.rows.length === 0 || !res.rows[0].value) {
      workerRegistryCache = {};
      workerRegistryCacheExpires = now + REGISTRY_CACHE_TTL_MS;
      return {};
    }
    const registry = JSON.parse(res.rows[0].value);
    const activeRegistry = {};
    for (const [sid, session] of Object.entries(registry)) {
      if (session && session.expiresAt && session.expiresAt > now) {
        activeRegistry[sid] = session;
      }
    }
    workerRegistryCache = registry;
    workerRegistryCacheExpires = now + REGISTRY_CACHE_TTL_MS;
    return activeRegistry;
  } catch (err) {
    console.error('[WORKER ENGINE] Failed to load session registry from database:', err.message);
    const dbErr = new Error('Database session registry could not be read.');
    dbErr.code = 'SESSION_REGISTRY_UNAVAILABLE';
    dbErr.status = 500;
    dbErr.cause = err;
    throw dbErr;
  }
}

/**
 * Mutate worker session registry inside DB transaction with in-memory fallback
 */
async function mutateWorkerSessionRegistry(mutatorFn) {
  invalidateWorkerSessionRegistryCache();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // In-memory mutation is strictly restricted to intentional isolated test environments
    if (isPermittedInMemorySessionEnvironment()) {
      const activeRegistry = {};
      const now = Date.now();
      for (const [sid, sess] of inMemoryWorkerSessions.entries()) {
        if (sess.expiresAt && sess.expiresAt > now) {
          activeRegistry[sid] = sess;
        }
      }
      const result = await mutatorFn(activeRegistry);
      inMemoryWorkerSessions.clear();
      for (const [sid, sess] of Object.entries(activeRegistry)) {
        inMemoryWorkerSessions.set(sid, sess);
      }
      return result;
    }

    const dbErr = new Error('DATABASE_URL is not configured. Persistent worker session registry required.');
    dbErr.code = 'SESSION_REGISTRY_UNAVAILABLE';
    dbErr.status = 500;
    throw dbErr;
  }

  return await db.withTransaction(async (client) => {
    await client.query(`
      INSERT INTO settings (id, key, value, updated_at)
      VALUES (gen_random_uuid(), $1, '{}', NOW())
      ON CONFLICT (key) DO NOTHING;
    `, [WORKER_SESSION_SETTING_KEY]);

    const res = await client.query(`
      SELECT value FROM settings WHERE key = $1 FOR UPDATE;
    `, [WORKER_SESSION_SETTING_KEY]);

    let registry = {};
    if (res.rows.length > 0 && res.rows[0].value) {
      try {
        registry = JSON.parse(res.rows[0].value);
      } catch {
        registry = {};
      }
    }

    const now = Date.now();
    const activeRegistry = {};
    for (const [sid, sess] of Object.entries(registry)) {
      if (sess.expiresAt && sess.expiresAt > now) {
        activeRegistry[sid] = sess;
      }
    }

    const result = await mutatorFn(activeRegistry);
    await client.query(`
      UPDATE settings
      SET value = $2, updated_at = NOW()
      WHERE key = $1;
    `, [WORKER_SESSION_SETTING_KEY, JSON.stringify(activeRegistry)]);

    return result;
  });
}

/**
 * Generate authenticated worker session token with role: WORKER and sessionId
 * @param {object} worker
 * @param {string} [sessionId]
 * @returns {string} JWT Token
 */
function generateWorkerSessionToken(worker, sessionId = crypto.randomUUID()) {
  invalidateWorkerSessionRegistryCache();
  const rawStoreId = worker.store_id || worker.storeId;
  const storeId = typeof rawStoreId === 'string' && rawStoreId.trim() ? rawStoreId.trim() : null;
  return jwt.sign(
    {
      workerId: worker.id,
      name: worker.name,
      mobileNumber: worker.mobile_number,
      role: 'WORKER',
      sessionId,
      storeId,
    },
    getJwtSecret(),
    { expiresIn: WORKER_TOKEN_EXPIRY }
  );
}

/**
 * Verify worker session token and enforce role === WORKER and check revocation
 * @param {string} token
 * @returns {object} Decoded token payload
 */
function verifyWorkerSessionToken(token) {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded || decoded.role !== 'WORKER') {
      const err = new Error('FORBIDDEN_WORKER_ROLE_REQUIRED');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }
    if (decoded.sessionId && inMemoryRevokedWorkerSessions.has(decoded.sessionId)) {
      const err = new Error('Session has been invalidated or logged out.');
      err.code = 'SESSION_REVOKED';
      err.status = 401;
      throw err;
    }
    return decoded;
  } catch (err) {
    if (err.code === 'FORBIDDEN') throw err;
    const authErr = new Error(err.message || 'INVALID_WORKER_SESSION_TOKEN');
    authErr.code = err.code || 'UNAUTHORIZED';
    authErr.status = err.status || 401;
    throw authErr;
  }
}

/**
 * Comprehensive async worker session verification:
 * Checks signature, role, session revocation registry, and disabled account status.
 * @param {string} token
 * @returns {Promise<object>}
 */
async function verifyWorkerSessionAsync(token) {
  const decoded = verifyWorkerSessionToken(token);

  // 1. Verify worker account exists and is active in database FIRST
  const worker = await workerRepository.findWorkerById(decoded.workerId);
  if (!worker) {
    const err = new Error('Worker account no longer exists.');
    err.code = 'WORKER_NOT_FOUND';
    err.status = 401;
    throw err;
  }

  if (!worker.active) {
    const err = new Error('Your worker account is currently disabled. Please contact the store administrator.');
    err.code = 'WORKER_ACCOUNT_DISABLED';
    err.status = 403;
    throw err;
  }

  // 2. Validate session lifecycle and registry revocation
  const sessionId = decoded.sessionId;
  if (!sessionId) {
    const err = new Error('Session token does not contain a valid session identifier.');
    err.code = 'SESSION_INVALID';
    err.status = 401;
    throw err;
  }

  if (inMemoryRevokedWorkerSessions.has(sessionId)) {
    const err = new Error('Session has been invalidated or logged out. Please sign in again.');
    err.code = 'SESSION_REVOKED';
    err.status = 401;
    throw err;
  }

  const registry = await loadWorkerSessionRegistry();
  if (!registry || !registry[sessionId]) {
    const err = new Error('Session has been invalidated or logged out. Please sign in again.');
    err.code = 'SESSION_EXPIRED';
    err.status = 401;
    throw err;
  }

  // The current persisted worker record is the SOLE authoritative source of store assignment.
  // Never fall back to decoded.storeId, process.env.PONDFISH_STORE_ID, main_store, or resource store ID.
  const rawStoreId = worker.store_id || worker.storeId;
  const storeId = typeof rawStoreId === 'string' && rawStoreId.trim() ? rawStoreId.trim() : null;
  return {
    ...decoded,
    storeId,
    worker: {
      ...worker,
      storeId,
      store_id: storeId,
    },
  };
}

/**
 * Revoke worker session and log security event.
 * Propagates persistence errors so durable revocation failure is never masked as success.
 * @param {string} token
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function logoutWorker(token) {
  let decoded = null;
  try {
    decoded = jwt.decode(token);
  } catch {}

  const sessionId = decoded?.sessionId;
  const workerId = decoded?.workerId;

  if (sessionId) {
    await mutateWorkerSessionRegistry((registry) => {
      delete registry[sessionId];
    });
    inMemoryRevokedWorkerSessions.add(sessionId);
    inMemoryWorkerSessions.delete(sessionId);

    // Terminate any active realtime WebSocket connections bound to this revoked session
    try {
      const { revokeRealtimeSession } = require('../realtime/ws-server');
      revokeRealtimeSession(sessionId);
    } catch (_) {}
  }

  if (workerId) {
    await auditEngine.recordAuditLog({
      actorType: 'WORKER',
      actorId: workerId,
      action: 'WORKER_LOGOUT',
      entityType: 'WORKER',
      entityId: workerId,
      payload: { sessionId },
    }).catch(() => {});
  }

  return { success: true, message: 'Worker session logged out and invalidated successfully.' };
}

/**
 * Extract worker authentication token from Authorization Bearer header or worker_session cookie
 * @param {Request} request
 * @returns {string|null}
 */
function extractWorkerToken(request) {
  const authHeader = request.headers?.get ? request.headers.get('authorization') : null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookie = request.cookies?.get ? request.cookies.get('worker_session')?.value : null;
  return cookie || null;
}

/**
 * Standardized worker authentication helper for API route handlers.
 * Extracts token, validates cryptographic signature, account active status,
 * and durable session registry.
 * @param {Request} request
 * @returns {Promise<object>} Authenticated session payload
 */
async function authenticateWorkerAsync(request) {
  const token = extractWorkerToken(request);
  if (!token) {
    const err = new Error('Valid worker authorization token is required.');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }
  return await verifyWorkerSessionAsync(token);
}

/**
 * Authenticate worker via mobile number and password
 * Enforces active account status (disabled workers rejected)
 * @param {object} params
 * @param {string} params.mobileNumber
 * @param {string} params.password
 * @returns {Promise<{ token: string, sessionId: string, worker: object }>}
 */
async function authenticateWorker({ mobileNumber, mobile, password }) {
  const targetMobile = mobileNumber || mobile;
  if (!targetMobile || !password) {
    const err = new Error('Mobile number and password are required.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const cleanedMobile = workerRepository.sanitizeMobile(targetMobile);
  if (!cleanedMobile || cleanedMobile.length !== 10) {
    const err = new Error('Please enter a valid 10-digit mobile number.');
    err.code = 'INVALID_MOBILE_NUMBER';
    throw err;
  }

  const worker = await workerRepository.findWorkerByMobile(cleanedMobile);
  if (!worker) {
    const err = new Error('Unable to sign in. Please check your mobile number and password.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Enforce active status
  if (!worker.active) {
    const err = new Error('Your worker account is currently disabled. Please contact the store administrator.');
    err.code = 'WORKER_ACCOUNT_DISABLED';
    throw err;
  }

  const isValidPassword = workerRepository.verifyPassword(password, worker.password_hash);
  if (!isValidPassword) {
    const err = new Error('Unable to sign in. Please check your mobile number and password.');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const sessionId = crypto.randomUUID();
  const token = generateWorkerSessionToken(worker, sessionId);
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;

  inMemoryWorkerSessions.set(sessionId, {
    workerId: worker.id,
    createdAt: Date.now(),
    expiresAt,
  });

  try {
    await mutateWorkerSessionRegistry((registry) => {
      registry[sessionId] = {
        workerId: worker.id,
        name: worker.name,
        createdAt: Date.now(),
        expiresAt,
      };
    });
  } catch (mutationErr) {
    inMemoryWorkerSessions.delete(sessionId);
    throw mutationErr;
  }

  return {
    token,
    sessionId,
    worker: {
      id: worker.id,
      name: worker.name,
      mobileNumber: worker.mobile_number,
      active: worker.active,
    },
  };
}

/**
 * Get worker dashboard and today's active bookings queue
 * @param {object} params - { status, limit, offset, storeId }
 */
async function getTodayBookingsQueue({ status = null, limit = 50, offset = 0, storeId = null } = {}) {
  const cleanStoreId = typeof storeId === 'string' ? storeId.trim() : '';
  if (!cleanStoreId) {
    const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }
  return bookingRepository.listWorkerBookingsToday({ status, limit, offset, storeId: cleanStoreId });
}

/**
 * Search bookings by Booking Code, Customer Name, or Phone
 * @param {object} params - { query, limit, storeId }
 */
async function searchBookings({ query: queryStr, limit = 50, storeId = null } = {}) {
  const cleanStoreId = typeof storeId === 'string' ? storeId.trim() : '';
  if (!cleanStoreId) {
    const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }
  return bookingRepository.searchWorkerBookings(queryStr, { limit, storeId: cleanStoreId });
}

/**
 * Retrieve complete booking details for worker review
 * @param {string} bookingId
 * @param {object} [options] - { workerStoreId }
 * @returns {Promise<object>}
 */
async function getBookingDetailsForWorker(bookingId, { workerStoreId = null } = {}) {
  if (!bookingId) {
    const err = new Error('BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity upfront
  if (workerStoreId !== null && workerStoreId !== undefined) {
    const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
    if (!effectiveWorkerStore) {
      const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }
  }

  const booking = await bookingRepository.findBookingForWorker(bookingId);
  if (!booking) {
    const err = new Error(`Booking ${bookingId} not found.`);
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity on both worker and booking
  if (workerStoreId !== null && workerStoreId !== undefined) {
    const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
    const effectiveBookingStore = typeof booking.store_id === 'string' ? booking.store_id.trim() : '';

    if (!effectiveWorkerStore) {
      const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }

    if (!effectiveBookingStore) {
      const err = new Error('Forbidden: Booking record lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }

    if (effectiveWorkerStore !== effectiveBookingStore) {
      const err = new Error('Forbidden: This booking belongs to a different store.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }
  }

  // Calculate live expiration state
  const isExpired = new Date(booking.expires_at) < new Date() && booking.status === 'CONFIRMED';
  if (isExpired) {
    booking.status = 'EXPIRED';
  }

  return booking;
}

/**
 * Cryptographically verify QR ticket and retrieve associated booking
 * Enforces server-side signature validation, booking existence, and active state
 * @param {string} qrToken - Signed token PFQR.<payload>.<sig>
 * @returns {Promise<object>}
 */
async function verifyBookingQr(qrToken, { workerStoreId = null } = {}) {
  if (!qrToken || typeof qrToken !== 'string') {
    const err = new Error('QR ticket token is required.');
    err.code = 'INVALID_QR_TOKEN';
    throw err;
  }

  // Step 1: Cryptographic HMAC signature check
  const verification = qrVerificationEngine.verifyBookingQrData(qrToken);
  if (!verification.valid || !verification.payload) {
    const err = new Error('This QR cannot be used for this order. Cryptographic verification failed.');
    err.code = 'INVALID_QR_SIGNATURE';
    err.details = verification.error;
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity upfront
  if (workerStoreId !== null && workerStoreId !== undefined) {
    const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
    if (!effectiveWorkerStore) {
      const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }
  }

  const { b: bookingId, c: bookingCode } = verification.payload;

  // Step 2: Fetch authoritative database record
  let booking = null;
  if (bookingId) {
    booking = await bookingRepository.findBookingForWorker(bookingId);
  }
  if (!booking && bookingCode) {
    booking = await bookingRepository.findBookingByCode(bookingCode);
  }

  if (!booking) {
    const err = new Error('Booking associated with this QR was not found.');
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity on both worker and booking
  const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
  const effectiveBookingStore = typeof booking.store_id === 'string' ? booking.store_id.trim() : '';

  if (!effectiveWorkerStore) {
    const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  if (!effectiveBookingStore) {
    const err = new Error('Forbidden: Booking record lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  if (effectiveWorkerStore !== effectiveBookingStore) {
    const err = new Error('This booking belongs to a different store and cannot be verified at this counter.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  // Step 3: Enforce lifecycle states
  if (booking.status === 'COMPLETED') {
    const err = new Error('Order Already Completed. This booking has already been fulfilled.');
    err.code = 'BOOKING_ALREADY_COMPLETED';
    err.booking = booking;
    throw err;
  }

  if (booking.status === 'CANCELLED') {
    const err = new Error('Booking Cancelled. This booking has been cancelled and cannot be fulfilled.');
    err.code = 'BOOKING_CANCELLED';
    err.booking = booking;
    throw err;
  }

  const isExpired = new Date(booking.expires_at) < new Date();
  if (booking.status === 'EXPIRED' || isExpired) {
    const err = new Error('Booking Expired. The 48-hour pickup window for this booking has lapsed.');
    err.code = 'BOOKING_EXPIRED';
    err.booking = booking;
    throw err;
  }

  return booking;
}

/**
 * Transition booking from CONFIRMED to PENDING_COLLECTION during order preparation
 * @param {object} params - { bookingId, workerId, workerStoreId }
 * @returns {Promise<object>}
 */
async function updateBookingPreparationStatus({ bookingId, workerId, workerStoreId = null }) {
  if (!bookingId) {
    const err = new Error('BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity upfront
  if (workerStoreId !== null && workerStoreId !== undefined) {
    const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
    if (!effectiveWorkerStore) {
      const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }
  }

  const booking = await bookingRepository.findBookingForWorker(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity on both worker and booking
  const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
  const effectiveBookingStore = typeof booking.store_id === 'string' ? booking.store_id.trim() : '';

  if (!effectiveWorkerStore) {
    const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  if (!effectiveBookingStore) {
    const err = new Error('Forbidden: Booking record lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  if (effectiveWorkerStore !== effectiveBookingStore) {
    const err = new Error('Forbidden: This booking belongs to a different store and cannot be prepared at this counter.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  if (booking.status === 'COMPLETED') {
    const err = new Error('Cannot prepare an already completed booking.');
    err.code = 'BOOKING_ALREADY_COMPLETED';
    throw err;
  }

  if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
    const err = new Error(`Cannot prepare booking in ${booking.status} state.`);
    err.code = `BOOKING_${booking.status}`;
    throw err;
  }

  // Allowed transition: CONFIRMED -> PENDING_COLLECTION
  const updated = await bookingRepository.updateBookingStatus(null, bookingId, 'PENDING_COLLECTION');
  return bookingRepository.findBookingForWorker(bookingId);
}

/**
 * Complete booking handover:
 * Irreversible atomic transaction that:
 * 1. Locks booking row (SELECT FOR UPDATE)
 * 2. Enforces state is CONFIRMED or PENDING_COLLECTION
 * 3. Consumes reserved stock (physical_quantity -= kg, reserved_quantity -= kg, SALE ledger)
 * 4. Creates financial record in transactions and transaction_items
 * 5. Transitions status to COMPLETED
 * 6. Permanently invalidates QR ticket for future use
 * 7. Emits BOOKING_COMPLETED event
 * @param {object} params - { bookingId, workerId, workerStoreId }
 * @returns {Promise<object>}
 */
async function completeBookingOrder({ bookingId, workerId, workerStoreId = null }) {
  if (!bookingId) {
    const err = new Error('BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  // Worker Store Scoping: Enforce explicit, non-empty store identity upfront
  const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
  if (!effectiveWorkerStore) {
    const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
    err.code = 'STORE_MISMATCH';
    err.status = 403;
    throw err;
  }

  const pool = db.getPool();
  let client = await pool.connect();

  let clientError = false;

  try {
    await client.query('BEGIN');

    // Step 1: Concurrency-safe row lock on bookings table
    const lockSql = `
      SELECT * FROM bookings 
      WHERE id = $1 
      FOR UPDATE;
    `;
    const lockRes = await client.query(lockSql, [bookingId]);
    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Booking not found.');
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    const booking = lockRes.rows[0];

    // Worker Store Scoping: Enforce explicit, non-empty store identity on both worker and booking
    const effectiveWorkerStore = typeof workerStoreId === 'string' ? workerStoreId.trim() : '';
    const effectiveBookingStore = typeof booking.store_id === 'string' ? booking.store_id.trim() : '';

    if (!effectiveWorkerStore) {
      await client.query('ROLLBACK');
      const err = new Error('Forbidden: Authenticated worker lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }

    if (!effectiveBookingStore) {
      await client.query('ROLLBACK');
      const err = new Error('Forbidden: Booking record lacks a valid store assignment.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }

    if (effectiveWorkerStore !== effectiveBookingStore) {
      await client.query('ROLLBACK');
      const err = new Error('Forbidden: This booking belongs to a different store and cannot be completed at this counter.');
      err.code = 'STORE_MISMATCH';
      err.status = 403;
      throw err;
    }

    // Step 2: Enforce valid lifecycle state
    if (booking.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      const err = new Error('This booking has already been fulfilled.');
      err.code = 'BOOKING_ALREADY_COMPLETED';
      err.status = 409;
      throw err;
    }

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot fulfill a cancelled booking.');
      err.code = 'BOOKING_CANCELLED';
      err.status = 409;
      throw err;
    }

    if (booking.status === 'EXPIRED' || new Date(booking.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      const err = new Error('Cannot fulfill an expired booking.');
      err.code = 'BOOKING_EXPIRED';
      err.status = 409;
      throw err;
    }

    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING_COLLECTION') {
      await client.query('ROLLBACK');
      const err = new Error(`Cannot complete booking in ${booking.status} state.`);
      err.code = 'INVALID_BOOKING_STATUS';
      throw err;
    }

    // Step 3: Fetch booking line items
    const itemsSql = `SELECT * FROM booking_items WHERE booking_id = $1;`;
    const itemsRes = await client.query(itemsSql, [bookingId]);
    const items = itemsRes.rows;

    if (items.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Booking has no line items.');
      err.code = 'EMPTY_BOOKING_ITEMS';
      throw err;
    }

    // Step 4: Atomically consume reserved stock from operational inventory
    // physical_quantity -= kg, reserved_quantity -= kg, SALE ledger record
    for (const item of items) {
      await inventoryRepository.consumeReservedInventoryAtomic(client, {
        fishId: item.fish_id,
        quantityKg: item.quantity_kg,
        bookingId: booking.id,
        bookingCode: booking.booking_code,
      });
    }

    // Step 5: Create authoritative financial transaction in transactions & transaction_items
    const paymentMethod = booking.razorpay_paid > 0
      ? 'RAZORPAY'
      : (booking.sub_credit_used > 0 ? 'SUBSCRIPTION_ONLY' : 'RAZORPAY');

    const transaction = await bookingRepository.createTransactionAtomic(client, {
      bookingId: booking.id,
      customerId: booking.customer_id,
      workerId: workerId || null,
      totalBillAmount: booking.total_amount,
      subCreditUsed: booking.sub_credit_used || 0,
      extraAmountPayable: booking.razorpay_paid || 0,
      finalPaidAmount: booking.razorpay_paid || 0,
      paymentMethod,
      status: 'COMPLETED',
      items,
    });

    // Step 6: Irreversibly transition booking status to COMPLETED
    await bookingRepository.updateBookingStatus(client, booking.id, 'COMPLETED');

    await client.query('COMMIT');

    try { client.release(); } catch (_) {}

    client = null;

    // Step 7: Emit domain event for real-time TV display / customer notification
    try {
      if (domainEventsEngine && domainEventsEngine.emit) {
        domainEventsEngine.emit('BOOKING_COMPLETED', {
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          customerId: booking.customer_id,
          workerId,
          transactionId: transaction.id,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (eventErr) {
      console.warn('[DOMAIN EVENT EMIT WARNING]', eventErr.message);
    }

    // Step 8: Record authoritative immutable audit log
    try {
      await auditEngine.recordAuditLog({
        actorType: 'WORKER',
        actorId: workerId || 'worker',
        action: 'BOOKING_FULFILLED',
        entityType: 'BOOKING',
        entityId: booking.id,
        payload: {
          bookingCode: booking.booking_code,
          customerId: booking.customer_id,
          transactionId: transaction.id,
          finalPaidAmount: booking.razorpay_paid || 0,
          totalBillAmount: booking.total_amount,
        },
      });
    } catch (auditErr) {
      console.warn('[WORKER AUDIT WARNING]', auditErr.message);
    }

    // Return fresh updated booking with customer info and items
    const completedBooking = await bookingRepository.findBookingForWorker(booking.id);
    return {
      success: true,
      booking: completedBooking,
      transaction,
      message: 'Booking completed successfully. Reserved stock consumed and QR ticket invalidated.',
    };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        clientError = true;
        console.error('[WORKER COMPLETE BOOKING ROLLBACK ERROR] Rollback failed:', rbErr.message);
      }
    }
    console.error('[WORKER COMPLETE BOOKING ROLLBACK]', err.message);
    throw err;
  } finally {
    if (client) {
      try {
        client.release(clientError ? true : undefined);
      } catch (_) {}
      client = null;
    }
  }
}

/**
 * List all workers for Admin management
 * @returns {Promise<Array>}
 */
async function listWorkersForAdmin() {
  return await workerRepository.listAdminWorkers();
}

/**
 * Get single worker details for Admin
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getWorkerDetailsForAdmin(id) {
  const worker = await workerRepository.findWorkerById(id);
  if (!worker) {
    const err = new Error('Worker record not found.');
    err.code = 'WORKER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Sanitize password_hash out
  const { password_hash, ...safeWorker } = worker;
  return safeWorker;
}

/**
 * Create a new worker account by Administrator
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.mobile_number
 * @param {string} params.password
 * @param {boolean} [params.active]
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function createWorkerByAdmin({ name, mobile_number, password, active = true }, { actorId = 'system', ip = 'unknown' } = {}) {
  if (!name || name.trim().length < 2) {
    const err = new Error('Worker name is required and must be at least 2 characters.');
    err.code = 'INVALID_WORKER_NAME';
    err.status = 400;
    throw err;
  }

  const cleanedMobile = workerRepository.sanitizeMobile(mobile_number);
  if (!cleanedMobile || cleanedMobile.length !== 10) {
    const err = new Error('A valid 10-digit Indian mobile number is required.');
    err.code = 'INVALID_MOBILE_NUMBER';
    err.status = 400;
    throw err;
  }

  const existing = await workerRepository.findWorkerByMobile(cleanedMobile);
  if (existing) {
    const err = new Error('A worker account with this mobile number already exists.');
    err.code = 'WORKER_ALREADY_EXISTS';
    err.status = 409;
    throw err;
  }

  if (!password || password.length < 6) {
    const err = new Error('Initial worker password must be at least 6 characters long.');
    err.code = 'WEAK_PASSWORD';
    err.status = 400;
    throw err;
  }

  const worker = await workerRepository.createWorker({
    name,
    mobile_number: cleanedMobile,
    password,
    active,
  });

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'WORKER_CREATED',
    entityType: 'WORKER',
    entityId: worker.id,
    payload: {
      name: worker.name,
      mobile_number: worker.mobile_number,
      active: worker.active,
      ip,
    },
  });

  return worker;
}

/**
 * Update worker details by Administrator
 * @param {string} id
 * @param {object} updates
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function updateWorkerByAdmin(id, updates, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await workerRepository.findWorkerById(id);
  if (!existing) {
    const err = new Error('Worker record not found.');
    err.code = 'WORKER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (updates.name !== undefined && updates.name.trim().length < 2) {
    const err = new Error('Worker name must be at least 2 characters.');
    err.code = 'INVALID_WORKER_NAME';
    err.status = 400;
    throw err;
  }

  if (updates.mobile_number !== undefined) {
    const cleanedMobile = workerRepository.sanitizeMobile(updates.mobile_number);
    if (!cleanedMobile || cleanedMobile.length !== 10) {
      const err = new Error('A valid 10-digit Indian mobile number is required.');
      err.code = 'INVALID_MOBILE_NUMBER';
      err.status = 400;
      throw err;
    }
    const mobileOwner = await workerRepository.findWorkerByMobile(cleanedMobile);
    if (mobileOwner && mobileOwner.id !== id) {
      const err = new Error('Another worker account already uses this mobile number.');
      err.code = 'MOBILE_ALREADY_IN_USE';
      err.status = 409;
      throw err;
    }
    updates.mobile_number = cleanedMobile;
  }

  const isStoreReassigned = updates.store_id !== undefined && updates.store_id !== existing.store_id;
  const isDeactivated = (updates.active === false || updates.is_active === false) && existing.active;

  const updatedWorker = await workerRepository.updateWorker(id, updates);

  if (isStoreReassigned || isDeactivated) {
    // Terminate any active realtime WebSocket connections
    try {
      const { terminateWorkerConnections } = require('../realtime/ws-server');
      if (typeof terminateWorkerConnections === 'function') {
        terminateWorkerConnections(id);
      }
    } catch (_) {}

    // Invalidate sessions in memory and registry so worker must re-authenticate
    for (const [sId, sess] of inMemoryWorkerSessions.entries()) {
      if (sess.workerId === id) {
        inMemoryRevokedWorkerSessions.add(sId);
        inMemoryWorkerSessions.delete(sId);
      }
    }
    await mutateWorkerSessionRegistry((registry) => {
      for (const sId of Object.keys(registry)) {
        if (registry[sId]?.workerId === id) {
          delete registry[sId];
        }
      }
    }).catch(() => {});
  }

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'WORKER_UPDATED',
    entityType: 'WORKER',
    entityId: id,
    payload: { updates, ip },
  });

  return updatedWorker;
}

/**
 * Reset worker password by Administrator
 * @param {string} id
 * @param {string} newPassword
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function resetWorkerPasswordByAdmin(id, newPassword, { actorId = 'system', ip = 'unknown' } = {}) {
  const existing = await workerRepository.findWorkerById(id);
  if (!existing) {
    const err = new Error('Worker record not found.');
    err.code = 'WORKER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!newPassword || newPassword.length < 6) {
    const err = new Error('New password must be at least 6 characters long.');
    err.code = 'WEAK_PASSWORD';
    err.status = 400;
    throw err;
  }

  await workerRepository.updateWorkerPassword(id, newPassword);

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: 'WORKER_PASSWORD_RESET',
    entityType: 'WORKER',
    entityId: id,
    payload: {
      workerId: id,
      name: existing.name,
      ip,
    },
  });

  return { success: true, message: 'Worker password has been reset successfully.' };
}

module.exports = {
  name: 'WorkerEngine',
  generateWorkerSessionToken,
  verifyWorkerSessionToken,
  verifyWorkerSessionAsync,
  authenticateWorkerAsync,
  logoutWorker,
  extractWorkerToken,
  loadWorkerSessionRegistry,
  mutateWorkerSessionRegistry,
  invalidateWorkerSessionRegistryCache,
  authenticateWorker,
  getTodayBookingsQueue,
  searchBookings,
  getBookingDetailsForWorker,
  verifyBookingQr,
  updateBookingPreparationStatus,
  completeBookingOrder,
  listWorkersForAdmin,
  getWorkerDetailsForAdmin,
  createWorkerByAdmin,
  updateWorkerByAdmin,
  resetWorkerPasswordByAdmin,
  inMemoryRevokedWorkerSessions,
};
