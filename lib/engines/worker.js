/**
 * Engine 23: Worker Portal Fulfillment & Handover Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Sections 14, 15, 22) &
 * Worker Portal Specification (Sections 9–18, 69)
 * Full orchestration for worker authentication, today's queue, search,
 * cryptographic QR verification, order preparation, atomic inventory consumption,
 * financial transaction recording, and irreversible booking completion.
 */

const jwt = require('jsonwebtoken');
const { getPool } = require('../db/pool');
const workerRepository = require('../db/repositories/workerRepository');
const bookingRepository = require('../db/repositories/bookingRepository');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const qrVerificationEngine = require('./qr-verification');
const domainEventsEngine = require('./domain-events');
const auditEngine = require('./audit');

const JWT_SECRET = process.env.JWT_SECRET || 'pondfish-customer-session-secret-key-2026';
const WORKER_TOKEN_EXPIRY = '12h'; // Store shift duration

/**
 * Generate authenticated worker session token with role: WORKER
 * @param {object} worker
 * @returns {string} JWT Token
 */
function generateWorkerSessionToken(worker) {
  return jwt.sign(
    {
      workerId: worker.id,
      name: worker.name,
      mobileNumber: worker.mobile_number,
      role: 'WORKER',
    },
    JWT_SECRET,
    { expiresIn: WORKER_TOKEN_EXPIRY }
  );
}

/**
 * Verify worker session token and enforce role === WORKER
 * @param {string} token
 * @returns {object} Decoded token payload
 */
function verifyWorkerSessionToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'WORKER') {
      const err = new Error('FORBIDDEN_WORKER_ROLE_REQUIRED');
      err.code = 'FORBIDDEN';
      throw err;
    }
    return decoded;
  } catch (err) {
    if (err.code === 'FORBIDDEN') throw err;
    const authErr = new Error('INVALID_WORKER_SESSION_TOKEN');
    authErr.code = 'UNAUTHORIZED';
    throw authErr;
  }
}

/**
 * Authenticate worker via mobile number and password
 * Enforces active account status (disabled workers rejected)
 * @param {object} params
 * @param {string} params.mobileNumber
 * @param {string} params.password
 * @returns {Promise<{ token: string, worker: object }>}
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

  const token = generateWorkerSessionToken(worker);

  return {
    token,
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
 * @param {object} params - { status, limit, offset }
 */
async function getTodayBookingsQueue({ status = null, limit = 50, offset = 0 } = {}) {
  return bookingRepository.listWorkerBookingsToday({ status, limit, offset });
}

/**
 * Search bookings by Booking Code, Customer Name, or Phone
 * @param {object} params - { query, limit }
 */
async function searchBookings({ query: queryStr, limit = 50 } = {}) {
  return bookingRepository.searchWorkerBookings(queryStr, { limit });
}

/**
 * Retrieve complete booking details for worker review
 * @param {string} bookingId
 * @returns {Promise<object>}
 */
async function getBookingDetailsForWorker(bookingId) {
  if (!bookingId) {
    const err = new Error('BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  const booking = await bookingRepository.findBookingForWorker(bookingId);
  if (!booking) {
    const err = new Error(`Booking ${bookingId} not found.`);
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
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
async function verifyBookingQr(qrToken) {
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
 * @param {object} params - { bookingId, workerId }
 * @returns {Promise<object>}
 */
async function updateBookingPreparationStatus({ bookingId, workerId }) {
  if (!bookingId) {
    const err = new Error('BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  const booking = await bookingRepository.findBookingForWorker(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.code = 'BOOKING_NOT_FOUND';
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
 * @param {object} params - { bookingId, workerId }
 * @returns {Promise<object>}
 */
async function completeBookingOrder({ bookingId, workerId }) {
  if (!bookingId) {
    const err = new Error('BOOKING_ID_REQUIRED');
    err.code = 'INVALID_PARAMETERS';
    throw err;
  }

  const pool = getPool();
  const client = await pool.connect();

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

    // Step 2: Enforce valid lifecycle state
    if (booking.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      const err = new Error('This booking has already been fulfilled.');
      err.code = 'BOOKING_ALREADY_COMPLETED';
      throw err;
    }

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      const err = new Error('Cannot fulfill a cancelled booking.');
      err.code = 'BOOKING_CANCELLED';
      throw err;
    }

    if (booking.status === 'EXPIRED' || new Date(booking.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      const err = new Error('Cannot fulfill an expired booking.');
      err.code = 'BOOKING_EXPIRED';
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
    await client.query('ROLLBACK');
    console.error('[WORKER COMPLETE BOOKING ROLLBACK]', err.message);
    throw err;
  } finally {
    client.release();
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

  const updatedWorker = await workerRepository.updateWorker(id, updates);

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
};
