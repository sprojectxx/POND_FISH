/**
 * Booking Persistence Repository
 * Traceability: PondFish Database ERD (Section 13) & API Spec (Sections 37, 38, 39)
 * Handles bookings, booking_items, and payments using native pg with customer isolation.
 */

const { query } = require('../pool');

/**
 * Generate a unique human-readable booking code
 * Format: PF-BK-YYYYMMDD-XXXX
 */
function generateBookingCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PF-BK-${dateStr}-${rand}`;
}

/**
 * Insert a new booking within a transaction
 * @param {object} client - Active pg transaction client
 * @param {object} data
 * @returns {Promise<object>} Created booking row
 */
async function createBooking(client, {
  customerId,
  bookingCode,
  qrCodeData,
  totalAmount,
  subCreditUsed = 0,
  razorpayPaid = 0,
  razorpayOrderId = null,
  status = 'CONFIRMED',
  expiresAt = null,
}) {
  if (!client) throw new Error('Transaction client is required to create a booking.');

  const code = bookingCode || generateBookingCode();
  const calculatedExpiry = expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000);

  const sql = `
    INSERT INTO bookings (
      id,
      customer_id,
      booking_code,
      qr_code_data,
      total_amount,
      sub_credit_used,
      razorpay_paid,
      razorpay_order_id,
      status,
      expires_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::"BookingStatus",
      $9,
      NOW(),
      NOW()
    )
    RETURNING *;
  `;

  const params = [
    customerId,
    code,
    qrCodeData,
    totalAmount,
    subCreditUsed,
    razorpayPaid,
    razorpayOrderId,
    status,
    calculatedExpiry,
  ];

  const res = await client.query(sql, params);
  return res.rows[0];
}

/**
 * Bulk insert booking line items within a transaction
 * @param {object} client
 * @param {string} bookingId
 * @param {Array<object>} items - [{ fishId, quantityKg, unitPrice, subtotal }]
 */
async function createBookingItems(client, bookingId, items) {
  if (!client) throw new Error('Transaction client is required to create booking items.');
  if (!items || items.length === 0) return [];

  const createdItems = [];
  for (const item of items) {
    const sql = `
      INSERT INTO booking_items (
        id,
        booking_id,
        fish_id,
        quantity_kg,
        unit_price,
        subtotal,
        created_at
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW()
      )
      RETURNING *;
    `;
    const res = await client.query(sql, [
      bookingId,
      item.fishId,
      item.quantityKg,
      item.unitPrice,
      item.subtotal,
    ]);
    createdItems.push(res.rows[0]);
  }
  return createdItems;
}

/**
 * Find booking by ID with customer isolation and join its items
 * @param {string} bookingId
 * @param {string} customerId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findBookingById(bookingId, customerId, client = null) {
  const runner = client || { query };

  const bookingSql = `
    SELECT 
      b.id,
      b.customer_id,
      b.booking_code,
      b.qr_code_data,
      b.total_amount,
      b.sub_credit_used,
      b.razorpay_paid,
      b.razorpay_order_id,
      b.status,
      b.expires_at,
      b.created_at,
      b.updated_at,
      c.name AS customer_name,
      c.mobile_number AS customer_phone
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.id = $1 AND b.customer_id = $2;
  `;
  const bookingRes = await runner.query(bookingSql, [bookingId, customerId]);
  if (bookingRes.rows.length === 0) {
    return null;
  }

  const booking = bookingRes.rows[0];

  // Fetch line items
  const itemsSql = `
    SELECT 
      bi.id,
      bi.booking_id,
      bi.fish_id,
      f.name AS fish_name,
      f.image_url AS fish_image_url,
      bi.quantity_kg,
      bi.unit_price,
      bi.subtotal,
      bi.created_at
    FROM booking_items bi
    JOIN fish f ON bi.fish_id = f.id
    WHERE bi.booking_id = $1
    ORDER BY f.name ASC;
  `;
  const itemsRes = await runner.query(itemsSql, [bookingId]);
  booking.items = itemsRes.rows;

  return booking;
}

/**
 * List booking history for an authenticated customer
 * @param {string} customerId
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
async function listCustomerBookings(customerId, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT 
      b.id,
      b.customer_id,
      b.booking_code,
      b.qr_code_data,
      b.total_amount,
      b.sub_credit_used,
      b.razorpay_paid,
      b.status,
      b.expires_at,
      b.created_at,
      b.updated_at,
      COUNT(bi.id)::int AS item_count,
      COALESCE(SUM(bi.quantity_kg), 0)::float8 AS total_quantity_kg
    FROM bookings b
    LEFT JOIN booking_items bi ON b.id = bi.booking_id
    WHERE b.customer_id = $1
    GROUP BY b.id
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const res = await query(sql, [customerId, limit, offset]);
  return res.rows;
}

/**
 * Update booking status
 */
async function updateBookingStatus(client, bookingId, newStatus) {
  const runner = client || { query };
  const sql = `
    UPDATE bookings
    SET status = $1::"BookingStatus", updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;
  const res = await runner.query(sql, [newStatus, bookingId]);
  return res.rows[0] || null;
}

/**
 * Record a payment in payments table
 */
async function createPayment(client, {
  bookingId,
  transactionId = null,
  razorpayOrderId,
  razorpayPaymentId = null,
  razorpaySignature = null,
  amount,
  method = 'RAZORPAY',
  status = 'SUCCESS',
}) {
  const runner = client || { query };
  const sql = `
    INSERT INTO payments (
      id,
      transaction_id,
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      method,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      NOW()
    )
    RETURNING *;
  `;
  const res = await runner.query(sql, [
    transactionId,
    bookingId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    amount,
    method,
    status,
  ]);
  return res.rows[0];
}

module.exports = {
  createBooking,
  createBookingItems,
  findBookingById,
  listCustomerBookings,
  updateBookingStatus,
  createPayment,
  generateBookingCode,
};
