/**
 * Engine 07: Booking Expiry & Lifecycle Engine
 * Traceability: PondFish Core Business Engines Spec (Section 14.6, 14.7, 14.8) & PRD (Section 13)
 * Authoritative 48-hour expiration lifecycle logic.
 * Note: Scheduled execution requires an external cron/scheduler integration dependency;
 * this module encapsulates the authoritative domain logic for executing overdue expirations.
 */

const { getPool } = require('../db/pool');
const inventoryRepository = require('../db/repositories/inventoryRepository');
const subscriptionRepository = require('../db/repositories/subscriptionRepository');
const bookingRepository = require('../db/repositories/bookingRepository');

/**
 * Expire a single booking atomically and release its reserved stock and subscription resources.
 * Invariant: Cannot expire an already COMPLETED, CANCELLED, or EXPIRED booking.
 * @param {string} bookingId
 * @returns {Promise<{ success: boolean, booking: object|null }>}
 */
async function expireBooking(bookingId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Row lock on booking
    const bookingRes = await client.query(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE;`,
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'BOOKING_NOT_FOUND' };
    }

    const booking = bookingRes.rows[0];

    // Only active bookings can expire
    if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return { success: false, status: booking.status, error: 'BOOKING_ALREADY_FINALIZED' };
    }

    // 1. Fetch line items
    const itemsRes = await client.query(
      `SELECT * FROM booking_items WHERE booking_id = $1;`,
      [bookingId]
    );

    // 2. Release reserved inventory back to available
    for (const item of itemsRes.rows) {
      await inventoryRepository.releaseInventoryAtomic(client, {
        fishId: item.fish_id,
        quantityKg: item.quantity_kg,
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        reason: 'EXPIRY_RELEASE',
      });
    }

    // 3. Restore subscription resources if applied
    const activeSub = await subscriptionRepository.getActiveSubscription(booking.customer_id, client);
    if (activeSub && booking.sub_credit_used > 0) {
      await subscriptionRepository.restoreCredit(client, {
        subscriptionId: activeSub.subscription_id,
        bookingId: booking.id,
        amount: booking.sub_credit_used,
      });

      for (const item of itemsRes.rows) {
        await subscriptionRepository.restoreWeeklyUsage(client, {
          subscriptionId: activeSub.subscription_id,
          bookingId: booking.id,
          fishId: item.fish_id,
          quantityKg: item.quantity_kg,
        });
      }
    }

    // 4. Update status to EXPIRED
    const updated = await bookingRepository.updateBookingStatus(client, booking.id, 'EXPIRED');

    await client.query('COMMIT');
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
 * Integration note: Intended to be invoked by pg_cron, worker container, or cloud scheduler.
 * @returns {Promise<{ expiredCount: number, expiredBookingIds: string[] }>}
 */
async function processOverdueBookings() {
  const pool = getPool();
  const res = await pool.query(`
    SELECT id, booking_code
    FROM bookings
    WHERE status IN ('CREATED', 'CONFIRMED', 'PENDING_COLLECTION')
      AND expires_at < NOW()
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
