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

/**
 * Retrieve booking details for worker without customer isolation
 * Joins customer info and line items with fish details
 * @param {string} bookingId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findBookingForWorker(bookingId, client = null) {
  if (!bookingId || typeof bookingId !== 'string') return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId.trim());
  if (!isUuid) return null;

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
    WHERE b.id = $1;
  `;
  const bookingRes = await runner.query(bookingSql, [bookingId]);
  if (bookingRes.rows.length === 0) return null;

  const booking = bookingRes.rows[0];

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
 * Find booking by booking code for worker
 * @param {string} bookingCode
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findBookingByCode(bookingCode, client = null) {
  if (!bookingCode) return null;
  const runner = client || { query };

  const sql = `SELECT id FROM bookings WHERE UPPER(booking_code) = UPPER($1) LIMIT 1;`;
  const res = await runner.query(sql, [bookingCode.trim()]);
  if (res.rows.length === 0) return null;

  return findBookingForWorker(res.rows[0].id, client);
}

/**
 * List active and recent bookings for today's worker queue
 * @param {object} options - { status, limit, offset }
 * @returns {Promise<{ bookings: Array<object>, counts: object }>}
 */
async function listWorkerBookingsToday({ status = null, limit = 50, offset = 0 } = {}) {
  // Counts summary
  const countsSql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed_count,
      COUNT(*) FILTER (WHERE status = 'PENDING_COLLECTION')::int AS pending_collection_count,
      COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE)::int AS completed_today_count,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired_count,
      COUNT(*)::int AS total_count
    FROM bookings;
  `;
  const countsRes = await query(countsSql);
  const counts = countsRes.rows[0] || {
    confirmed_count: 0,
    pending_collection_count: 0,
    completed_today_count: 0,
    expired_count: 0,
    total_count: 0,
  };

  let filterClause = '';
  const params = [];
  let paramIdx = 1;

  if (status && status !== 'ALL') {
    filterClause = `WHERE b.status = $${paramIdx}::"BookingStatus"`;
    params.push(status);
    paramIdx++;
  }

  const listSql = `
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
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      COUNT(bi.id)::int AS item_count,
      COALESCE(SUM(bi.quantity_kg), 0)::float8 AS total_quantity_kg
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN booking_items bi ON b.id = bi.booking_id
    ${filterClause}
    GROUP BY b.id, c.name, c.mobile_number
    ORDER BY 
      CASE 
        WHEN b.status = 'PENDING_COLLECTION' THEN 1
        WHEN b.status = 'CONFIRMED' THEN 2
        WHEN b.status = 'COMPLETED' THEN 3
        ELSE 4
      END,
      b.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;
  params.push(limit, offset);

  const res = await query(listSql, params);
  return {
    bookings: res.rows,
    counts: {
      confirmed: counts.confirmed_count,
      pendingCollection: counts.pending_collection_count,
      completedToday: counts.completed_today_count,
      expired: counts.expired_count,
      total: counts.total_count,
    },
  };
}

/**
 * Search bookings by Booking Code, Customer Name, or Customer Mobile
 * @param {string} queryStr
 * @param {object} options - { limit }
 * @returns {Promise<Array<object>>}
 */
async function searchWorkerBookings(queryStr, { limit = 50 } = {}) {
  if (!queryStr || !queryStr.trim()) {
    return [];
  }
  const term = queryStr.trim();
  const searchPattern = `%${term}%`;

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
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      COUNT(bi.id)::int AS item_count,
      COALESCE(SUM(bi.quantity_kg), 0)::float8 AS total_quantity_kg
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN booking_items bi ON b.id = bi.booking_id
    WHERE 
      b.booking_code ILIKE $1 
      OR c.name ILIKE $1 
      OR c.mobile_number ILIKE $1
    GROUP BY b.id, c.name, c.mobile_number
    ORDER BY b.created_at DESC
    LIMIT $2;
  `;
  const res = await query(sql, [searchPattern, limit]);
  return res.rows;
}

/**
 * Generate a unique human-readable transaction number
 * Format: PF-TXN-YYYYMMDD-XXXX
 */
function generateTransactionNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PF-TXN-${dateStr}-${rand}`;
}

/**
 * Create a transaction record and transaction line items atomically
 * @param {object} client - Active pg transaction client
 * @param {object} params
 * @returns {Promise<object>} Created transaction with items
 */
async function createTransactionAtomic(client, {
  bookingId = null,
  billId = null,
  customerId,
  workerId = null,
  totalBillAmount,
  subQtyCoveredKg = 0,
  subCreditUsed = 0,
  extraAmountPayable = 0,
  razorpayGatewayFee = 0,
  gstOnFee = 0,
  finalPaidAmount = 0,
  paymentMethod = 'RAZORPAY',
  status = 'COMPLETED',
  items = [],
}) {
  if (!client) {
    throw new Error('A transaction client is required to create a transaction.');
  }

  const txnNumber = generateTransactionNumber();

  const txnSql = `
    INSERT INTO transactions (
      id,
      transaction_number,
      bill_id,
      booking_id,
      customer_id,
      worker_id,
      total_bill_amount,
      sub_qty_covered_kg,
      sub_credit_used,
      extra_amount_payable,
      razorpay_gateway_fee,
      gst_on_fee_18,
      final_paid_amount,
      payment_method,
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
      $9,
      $10,
      $11,
      $12,
      $13::"PaymentMethod",
      $14,
      NOW()
    )
    RETURNING *;
  `;

  const txnParams = [
    txnNumber,
    billId,
    bookingId,
    customerId,
    workerId,
    totalBillAmount,
    subQtyCoveredKg,
    subCreditUsed,
    extraAmountPayable,
    razorpayGatewayFee,
    gstOnFee,
    finalPaidAmount,
    paymentMethod,
    status,
  ];

  const txnRes = await client.query(txnSql, txnParams);
  const transaction = txnRes.rows[0];

  // Insert transaction line items
  const createdItems = [];
  for (const item of items) {
    const itemSql = `
      INSERT INTO transaction_items (
        id,
        transaction_id,
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
    const itemRes = await client.query(itemSql, [
      transaction.id,
      item.fish_id || item.fishId,
      item.quantity_kg || item.quantityKg,
      item.unit_price || item.unitPrice,
      item.subtotal,
    ]);
    createdItems.push(itemRes.rows[0]);
  }
  transaction.items = createdItems;

  return transaction;
}

/**
 * List bookings for Admin Portal with multi-field search, status filtering, date range, and pagination
 * Traceability: ADMIN-12 Bookings List Spec
 * @param {object} options
 * @returns {Promise<{ bookings: Array<object>, total: number, counts: object }>}
 */
async function listAdminBookings({
  search = null,
  status = null,
  source = null,
  dateFrom = null,
  dateTo = null,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  // Status counts summary across all bookings
  const countsSql = `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE status = 'CREATED')::int AS created_count,
      COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed_count,
      COUNT(*) FILTER (WHERE status = 'PENDING_COLLECTION')::int AS pending_collection_count,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired_count
    FROM bookings;
  `;
  const countsRes = await query(countsSql);
  const counts = countsRes.rows[0] || {
    total_count: 0,
    created_count: 0,
    confirmed_count: 0,
    pending_collection_count: 0,
    completed_count: 0,
    cancelled_count: 0,
    expired_count: 0,
  };

  // If source filter is 'Physical-store', store counter sales are direct transactions, not bookings
  if (source && source.toLowerCase() === 'physical-store') {
    return {
      bookings: [],
      total: 0,
      counts: {
        all: counts.total_count,
        created: counts.created_count,
        confirmed: counts.confirmed_count,
        pendingCollection: counts.pending_collection_count,
        completed: counts.completed_count,
        cancelled: counts.cancelled_count,
        expired: counts.expired_count,
      },
    };
  }

  const conditions = [];
  const params = [];

  // Status filter
  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push(`b.status = $${params.length}::"BookingStatus"`);
  }

  // Date filters
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (!isNaN(fromDate.getTime())) {
      params.push(fromDate);
      conditions.push(`b.created_at >= $${params.length}`);
    }
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      params.push(toDate);
      conditions.push(`b.created_at <= $${params.length}`);
    }
  }

  // Parameterized search filter
  if (search && search.trim()) {
    const term = search.trim();
    const searchPattern = `%${term}%`;
    const numValue = parseFloat(term);
    const isNum = !isNaN(numValue) && isFinite(term);

    params.push(searchPattern);
    const patternIdx = params.length;

    let searchClause = `(
      b.booking_code ILIKE $${patternIdx}
      OR b.id::text ILIKE $${patternIdx}
      OR c.name ILIKE $${patternIdx}
      OR c.mobile_number ILIKE $${patternIdx}
      OR EXISTS (
        SELECT 1 FROM booking_items bi_s 
        JOIN fish f_s ON bi_s.fish_id = f_s.id 
        WHERE bi_s.booking_id = b.id AND f_s.name ILIKE $${patternIdx}
      )
    `;

    if (isNum) {
      params.push(numValue);
      const numIdx = params.length;
      searchClause += ` OR b.total_amount = $${numIdx} OR b.razorpay_paid = $${numIdx}`;
    }

    searchClause += `)`;
    conditions.push(searchClause);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count matching records
  const countSql = `
    SELECT COUNT(DISTINCT b.id)::int AS total
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    ${whereClause};
  `;
  const countRes = await query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  // Fetch paginated bookings
  const dataParams = [...params, safeLimit, safeOffset];
  const listSql = `
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
      c.mobile_number AS customer_phone,
      'Online' AS source,
      COUNT(DISTINCT bi.id)::int AS item_count,
      COALESCE(SUM(bi.quantity_kg), 0)::float8 AS total_quantity_kg,
      COALESCE(STRING_AGG(DISTINCT f.name, ', '), '') AS fish_names,
      t.id AS transaction_id,
      t.created_at AS collection_time,
      w.name AS worker_name
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN booking_items bi ON b.id = bi.booking_id
    LEFT JOIN fish f ON bi.fish_id = f.id
    LEFT JOIN transactions t ON t.booking_id = b.id
    LEFT JOIN workers w ON t.worker_id = w.id
    ${whereClause}
    GROUP BY b.id, c.name, c.mobile_number, t.id, t.created_at, w.name
    ORDER BY b.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const listRes = await query(listSql, dataParams);

  return {
    bookings: listRes.rows,
    total,
    counts: {
      all: counts.total_count,
      created: counts.created_count,
      confirmed: counts.confirmed_count,
      pendingCollection: counts.pending_collection_count,
      completed: counts.completed_count,
      cancelled: counts.cancelled_count,
      expired: counts.expired_count,
    },
  };
}

/**
 * Retrieve comprehensive booking details for Admin Portal
 * Includes customer info, line items, payment records, worker collection info,
 * subscription ledger entries, audit timeline, and restoration preview.
 * @param {string} bookingId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findBookingDetailForAdmin(bookingId, client = null) {
  if (!bookingId || typeof bookingId !== 'string') return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId.trim());
  if (!isUuid) return null;

  const runner = client || { query };

  // 1. Fetch booking & customer
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
      c.mobile_number AS customer_phone,
      c.area AS customer_area,
      'Online' AS source
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.id = $1;
  `;
  const bookingRes = await runner.query(bookingSql, [bookingId.trim()]);
  if (bookingRes.rows.length === 0) return null;

  const booking = bookingRes.rows[0];

  // 2. Fetch line items
  const itemsSql = `
    SELECT 
      bi.id,
      bi.booking_id,
      bi.fish_id,
      f.name AS fish_name,
      f.image_url AS fish_image_url,
      fc.name AS category_name,
      bi.quantity_kg,
      bi.unit_price,
      bi.subtotal,
      bi.created_at
    FROM booking_items bi
    JOIN fish f ON bi.fish_id = f.id
    LEFT JOIN categories fc ON f.category_id = fc.id
    WHERE bi.booking_id = $1
    ORDER BY f.name ASC;
  `;
  const itemsRes = await runner.query(itemsSql, [bookingId]);
  booking.items = itemsRes.rows;

  // 3. Fetch payment record (if any)
  const paymentsSql = `
    SELECT 
      id,
      booking_id,
      transaction_id,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      method,
      status,
      created_at
    FROM payments
    WHERE booking_id = $1
    ORDER BY created_at DESC;
  `;
  const paymentsRes = await runner.query(paymentsSql, [bookingId]);
  booking.payments = paymentsRes.rows;

  // 4. Fetch transaction & worker collection information (if any)
  const txnSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.worker_id,
      t.total_bill_amount,
      t.sub_qty_covered_kg,
      t.sub_credit_used,
      t.extra_amount_payable,
      t.razorpay_gateway_fee,
      t.gst_on_fee_18,
      t.final_paid_amount,
      t.payment_method,
      t.status,
      t.created_at AS collection_time,
      w.name AS worker_name,
      w.mobile_number AS worker_phone,
      'Store Worker' AS worker_role
    FROM transactions t
    LEFT JOIN workers w ON t.worker_id = w.id
    WHERE t.booking_id = $1
    ORDER BY t.created_at DESC
    LIMIT 1;
  `;
  const txnRes = await runner.query(txnSql, [bookingId]);
  booking.collection = txnRes.rows[0] || null;

  // 5. Fetch subscription usage ledger entries (weekly quantity deductions/restores)
  const usageSql = `
    SELECT 
      sul.id,
      sul.subscription_id,
      sul.fish_id,
      f.name AS fish_name,
      sul.quantity_kg,
      sul.usage_type,
      sul.created_at
    FROM subscription_usage_ledger sul
    JOIN fish f ON sul.fish_id = f.id
    WHERE sul.booking_id = $1
    ORDER BY sul.created_at ASC;
  `;
  const usageRes = await runner.query(usageSql, [bookingId]);
  booking.subscription_usage = usageRes.rows;

  // 6. Fetch subscription credit ledger entries
  const creditSql = `
    SELECT 
      id,
      subscription_id,
      type,
      amount,
      resulting_balance,
      created_at
    FROM subscription_credit_ledger
    WHERE booking_id = $1
    ORDER BY created_at ASC;
  `;
  const creditRes = await runner.query(creditSql, [bookingId]);
  booking.credit_ledger = creditRes.rows;

  // 7. Fetch audit timeline for this booking
  const auditSql = `
    SELECT 
      id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      payload,
      timestamp
    FROM audit_logs
    WHERE (entity_type = 'BOOKING' AND entity_id = $1)
       OR (payload ILIKE '%' || $2 || '%')
    ORDER BY timestamp DESC
    LIMIT 50;
  `;
  const auditRes = await runner.query(auditSql, [booking.id, booking.booking_code]);
  booking.audit_timeline = auditRes.rows.map(row => {
    let parsedPayload = null;
    try {
      parsedPayload = row.payload ? JSON.parse(row.payload) : null;
    } catch (e) {
      parsedPayload = row.payload;
    }
    return {
      id: row.id,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      payload: parsedPayload,
      timestamp: row.timestamp,
    };
  });

  // 8. Calculate restoration preview
  const isCancellable = ['CREATED', 'CONFIRMED', 'PENDING_COLLECTION'].includes(booking.status);
  const totalQtyKg = booking.items.reduce((acc, it) => acc + (parseFloat(it.quantity_kg) || 0), 0);
  const subWeeklyQtyUsed = booking.subscription_usage
    .filter(u => u.usage_type === 'BOOKING_USAGE')
    .reduce((acc, u) => acc + (parseFloat(u.quantity_kg) || 0), 0);

  booking.restoration_preview = {
    cancellable: isCancellable,
    ineligibility_reason: !isCancellable
      ? (booking.status === 'COMPLETED'
          ? 'Cannot cancel a completed booking.'
          : (booking.status === 'CANCELLED'
              ? 'Booking is already cancelled.'
              : 'Cannot cancel an expired booking.'))
      : null,
    inventory_items: booking.items.map(it => ({
      fish_id: it.fish_id,
      fish_name: it.fish_name,
      quantity_kg: parseFloat(it.quantity_kg),
    })),
    total_inventory_kg: totalQtyKg,
    subscription_quantity_kg: subWeeklyQtyUsed > 0 ? subWeeklyQtyUsed : (booking.sub_credit_used > 0 ? totalQtyKg : 0),
    subscription_credit_amount: parseFloat(booking.sub_credit_used || 0),
    paid_credit_amount: parseFloat(booking.razorpay_paid || 0),
    total_credit_restoration: parseFloat(((booking.sub_credit_used || 0) + (booking.razorpay_paid || 0)).toFixed(2)),
  };

  return booking;
}

module.exports = {
  createBooking,
  createBookingItems,
  findBookingById,
  findBookingForWorker,
  findBookingByCode,
  listCustomerBookings,
  listWorkerBookingsToday,
  searchWorkerBookings,
  listAdminBookings,
  findBookingDetailForAdmin,
  updateBookingStatus,
  createPayment,
  createTransactionAtomic,
  generateBookingCode,
  generateTransactionNumber,
};
