/**
 * Engine 07: Booking Expiry & Lifecycle Engine
 * Traceability: PondFish Core Business Engines Spec (Section 14.6, 14.7, 14.8) & PRD (Section 13)
 * Authoritative 48-hour expiration lifecycle logic.
 * Enforces atomic and idempotent restoration of:
 * - reserved inventory
 * - weekly subscription quantity
 * - subscription credit
 * - applicable Razorpay-paid booking value -> added to subscription credit
 */

const { getPool } = require('../db/pool');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const bookingRepository = require('../db/repositories/bookingRepository');
const domainEventsEngine = require('./domain-events');

/**
 * Expire a single booking atomically and release its reserved stock and subscription resources.
 * Invariant: Cannot expire an already COMPLETED, CANCELLED, or EXPIRED booking (idempotent).
 * Invariant: Booking expiry is 48 elapsed hours from creation.
 * 
 * @param {string} bookingId
 * @param {object} [options]
 * @param {boolean} [options.force=false] - For admin or manual test execution
 * @returns {Promise<{ success: boolean, booking: object|null, error?: string, alreadyFinalized?: boolean }>}
 */
async function expireBooking(bookingId, { force = false } = {}) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock booking row with SELECT ... FOR UPDATE
    const bookingRes = await client.query(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE;`,
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'BOOKING_NOT_FOUND' };
    }

    const booking = bookingRes.rows[0];

    // Idempotency check: Only active bookings can expire
    if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return {
        success: false,
        status: booking.status,
        alreadyFinalized: true,
        error: 'BOOKING_ALREADY_FINALIZED',
      };
    }

    // Enforce 48-hour elapsed expiry threshold unless explicitly forced
    const now = new Date();
    const expiryTime = new Date(booking.expires_at);
    if (!force && expiryTime > now) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'BOOKING_NOT_YET_EXPIRED',
        expiresAt: booking.expires_at,
      };
    }

    // 2. Fetch line items
    const itemsRes = await client.query(
      `SELECT * FROM booking_items WHERE booking_id = $1;`,
      [bookingId]
    );

    // 3. Release reserved inventory back to available stock atomically
    for (const item of itemsRes.rows) {
      await inventoryRepository.releaseInventoryAtomic(client, {
        fishId: item.fish_id,
        quantityKg: item.quantity_kg,
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        reason: 'EXPIRY_RELEASE',
      });
    }

    // 4. Restore weekly subscription quantity usage if debited
    const usageEntries = await subscriptionRepository.getBookingUsageLedgerEntries(client, booking.id);
    if (usageEntries && usageEntries.length > 0) {
      for (const u of usageEntries) {
        await subscriptionRepository.restoreWeeklyUsage(client, {
          subscriptionId: u.subscription_id,
          bookingId: booking.id,
          fishId: u.fish_id,
          quantityKg: u.quantity_kg,
        });
      }
    } else if (booking.sub_credit_used > 0) {
      const activeSub = await subscriptionRepository.getActiveSubscription(booking.customer_id, client);
      if (activeSub) {
        for (const item of itemsRes.rows) {
          await subscriptionRepository.restoreWeeklyUsage(client, {
            subscriptionId: activeSub.subscription_id,
            bookingId: booking.id,
            fishId: item.fish_id,
            quantityKg: item.quantity_kg,
          });
        }
      }
    }

    // 5. Restore monetary benefits: subscription credit used + applicable Razorpay-paid amount -> subscription credit
    await subscriptionRepository.restoreCustomerBookingCredits(client, {
      customerId: booking.customer_id,
      bookingId: booking.id,
      subCreditUsed: booking.sub_credit_used,
      razorpayPaid: booking.razorpay_paid,
    });

    // 6. Update booking status to EXPIRED
    const updated = await bookingRepository.updateBookingStatus(client, booking.id, 'EXPIRED');

    await client.query('COMMIT');

    // 7. Emit domain event for real-time notification
    try {
      if (domainEventsEngine && domainEventsEngine.emit) {
        domainEventsEngine.emit('BOOKING_EXPIRED', {
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          customerId: booking.customer_id,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (eventErr) {
      console.warn('[DOMAIN EVENT EMIT WARNING]', eventErr.message);
    }

    return { success: true, booking: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[EXPIRY ERROR] Failed to expire booking ${bookingId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Sweep and expire all overdue active bookings past their 48-hour window.
 * Idempotent sweep processor intended for schedulers, crons, or background tasks.
 * @returns {Promise<{ expiredCount: number, expiredBookingIds: string[] }>}
 */
async function processOverdueBookings() {
  const pool = getPool();
  const res = await pool.query(`
    SELECT id, booking_code
    FROM bookings
    WHERE status IN ('CREATED', 'CONFIRMED', 'PENDING_COLLECTION')
      AND expires_at <= NOW()
    ORDER BY expires_at ASC
    LIMIT 50;
  `);

  const expiredBookingIds = [];
  for (const row of res.rows) {
    try {
      const result = await expireBooking(row.id);
      if (result.success) {
        expiredBookingIds.push(row.id);
      }
    } catch (e) {
      console.warn(`[EXPIRY SWEEP] Could not expire booking ${row.booking_code}:`, e.message);
    }
  }

  return {
    expiredCount: expiredBookingIds.length,
    expiredBookingIds,
  };
}

module.exports = {
  name: 'BookingExpiryEngine',
  expireBooking,
  processOverdueBookings,
};
