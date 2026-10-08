/**
 * Transaction Repository Foundation
 * Traceability: PondFish Database ERD Data Model v1 (Section 19), Master PRD v2 (Section 18)
 * Handles retrieval of authoritative financial transactions and line items.
 * Native parameterized PostgreSQL queries. Zero ORM abstraction.
 */

const { query } = require('../pool');

/**
 * Retrieve successful transactions for the current business day (or specific date)
 * Formats data for TV display and operational feeds with customer and item details.
 * 
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {string} [options.businessDate] - Optional 'YYYY-MM-DD' filter (defaults to active business day)
 * @returns {Promise<Array<object>>}
 */
async function getTodaySuccessfulTransactions({ limit = 50, businessDate = null } = {}) {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  let dateFilterClause = `DATE(t.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`;
  const params = [parsedLimit];

  if (businessDate && typeof businessDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(businessDate.trim())) {
    params.push(businessDate.trim());
    dateFilterClause = `DATE(t.created_at AT TIME ZONE 'Asia/Kolkata') = $${params.length}::date`;
  }

  // 1. Fetch transactions
  const txSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.bill_id,
      t.booking_id,
      t.customer_id,
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      t.total_bill_amount,
      t.sub_qty_covered_kg,
      t.sub_credit_used,
      t.extra_amount_payable,
      t.final_paid_amount,
      t.payment_method,
      t.status,
      t.created_at,
      b.booking_code
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN bookings b ON t.booking_id = b.id
    WHERE t.status = 'COMPLETED'
      AND ${dateFilterClause}
    ORDER BY t.created_at DESC
    LIMIT $1;
  `;

  const txRes = await query(txSql, params);
  const transactions = txRes.rows;

  if (transactions.length === 0) {
    return [];
  }

  // 2. Fetch line items for retrieved transactions
  const txIds = transactions.map((t) => t.id);
  const itemsSql = `
    SELECT 
      ti.id,
      ti.transaction_id,
      ti.fish_id,
      f.name AS fish_name,
      f.image_url AS fish_image_url,
      ti.quantity_kg,
      ti.unit_price,
      ti.subtotal
    FROM transaction_items ti
    JOIN fish f ON ti.fish_id = f.id
    WHERE ti.transaction_id = ANY($1::uuid[]);
  `;

  const itemsRes = await query(itemsSql, [txIds]);
  const itemsByTx = {};
  for (const item of itemsRes.rows) {
    if (!itemsByTx[item.transaction_id]) {
      itemsByTx[item.transaction_id] = [];
    }
    itemsByTx[item.transaction_id].push({
      id: item.id,
      fishId: item.fish_id,
      fishName: item.fish_name,
      fishImageUrl: item.fish_image_url,
      quantityKg: parseFloat(item.quantity_kg) || 0,
      unitPrice: parseFloat(item.unit_price) || 0,
      subtotal: parseFloat(item.subtotal) || 0,
    });
  }

  // 3. Assemble normalized records
  return transactions.map((tx) => ({
    id: tx.id,
    transactionNumber: tx.transaction_number,
    bookingCode: tx.booking_code || null,
    billId: tx.bill_id || null,
    customerId: tx.customer_id,
    customerName: tx.customer_name || 'Walk-in Customer',
    customerPhone: tx.customer_phone || null,
    totalBillAmount: parseFloat(tx.total_bill_amount) || 0,
    subQtyCoveredKg: parseFloat(tx.sub_qty_covered_kg) || 0,
    subCreditUsed: parseFloat(tx.sub_credit_used) || 0,
    extraAmountPayable: parseFloat(tx.extra_amount_payable) || 0,
    finalPaidAmount: parseFloat(tx.final_paid_amount) || 0,
    paymentMethod: tx.payment_method,
    status: tx.status,
    createdAt: tx.created_at,
    items: itemsByTx[tx.id] || [],
  }));
}

/**
 * Retrieve a single transaction by ID with items
 * @param {string} transactionId
 * @returns {Promise<object|null>}
 */
async function getTransactionById(transactionId) {
  if (!transactionId) return null;

  const txSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.bill_id,
      t.booking_id,
      t.customer_id,
      c.name AS customer_name,
      t.total_bill_amount,
      t.sub_qty_covered_kg,
      t.sub_credit_used,
      t.extra_amount_payable,
      t.final_paid_amount,
      t.payment_method,
      t.status,
      t.created_at,
      b.booking_code
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN bookings b ON t.booking_id = b.id
    WHERE t.id = $1;
  `;

  const txRes = await query(txSql, [transactionId]);
  if (txRes.rows.length === 0) return null;

  const tx = txRes.rows[0];

  const itemsSql = `
    SELECT 
      ti.id,
      ti.fish_id,
      f.name AS fish_name,
      ti.quantity_kg,
      ti.unit_price,
      ti.subtotal
    FROM transaction_items ti
    JOIN fish f ON ti.fish_id = f.id
    WHERE ti.transaction_id = $1;
  `;

  const itemsRes = await query(itemsSql, [transactionId]);

  return {
    id: tx.id,
    transactionNumber: tx.transaction_number,
    bookingCode: tx.booking_code || null,
    customerId: tx.customer_id,
    customerName: tx.customer_name || 'Walk-in Customer',
    totalBillAmount: parseFloat(tx.total_bill_amount) || 0,
    subCreditUsed: parseFloat(tx.sub_credit_used) || 0,
    finalPaidAmount: parseFloat(tx.final_paid_amount) || 0,
    paymentMethod: tx.payment_method,
    status: tx.status,
    createdAt: tx.created_at,
    items: itemsRes.rows.map((item) => ({
      id: item.id,
      fishId: item.fish_id,
      fishName: item.fish_name,
      quantityKg: parseFloat(item.quantity_kg) || 0,
      unitPrice: parseFloat(item.unit_price) || 0,
      subtotal: parseFloat(item.subtotal) || 0,
    })),
  };
}

/**
 * Retrieve paginated physical/online transactions for a customer
 * Traceability: API Spec Section 41 (GET /api/v1/customer/transactions)
 * @param {string} customerId
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {Promise<Array<object>>}
 */
async function getCustomerTransactions(customerId, { limit = 50, offset = 0 } = {}) {
  if (!customerId) return [];

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const txSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.bill_id,
      t.booking_id,
      t.customer_id,
      t.total_bill_amount,
      t.sub_qty_covered_kg,
      t.sub_credit_used,
      t.extra_amount_payable,
      t.razorpay_gateway_fee,
      t.gst_on_fee_18,
      t.final_paid_amount,
      t.payment_method,
      t.status,
      t.created_at,
      b.booking_code,
      bl.bill_number,
      bl.image_url AS bill_image_url
    FROM transactions t
    LEFT JOIN bookings b ON t.booking_id = b.id
    LEFT JOIN bills bl ON t.bill_id = bl.id
    WHERE t.customer_id = $1
      AND t.status = 'COMPLETED'
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3;
  `;

  const txRes = await query(txSql, [customerId, parsedLimit, parsedOffset]);
  const transactions = txRes.rows;
  if (transactions.length === 0) return [];

  const txIds = transactions.map((t) => t.id);
  const itemsSql = `
    SELECT 
      ti.id,
      ti.transaction_id,
      ti.fish_id,
      f.name AS fish_name,
      f.image_url AS fish_image_url,
      ti.quantity_kg,
      ti.unit_price,
      ti.subtotal
    FROM transaction_items ti
    JOIN fish f ON ti.fish_id = f.id
    WHERE ti.transaction_id = ANY($1::uuid[]);
  `;

  const itemsRes = await query(itemsSql, [txIds]);
  const itemsByTx = {};
  for (const item of itemsRes.rows) {
    if (!itemsByTx[item.transaction_id]) itemsByTx[item.transaction_id] = [];
    itemsByTx[item.transaction_id].push({
      id: item.id,
      fishId: item.fish_id,
      fishName: item.fish_name,
      fishImageUrl: item.fish_image_url,
      quantityKg: parseFloat(item.quantity_kg) || 0,
      unitPrice: parseFloat(item.unit_price) || 0,
      subtotal: parseFloat(item.subtotal) || 0,
    });
  }

  return transactions.map((tx) => ({
    id: tx.id,
    transactionNumber: tx.transaction_number,
    billId: tx.bill_id || null,
    billNumber: tx.bill_number || (tx.booking_code ? `#${tx.booking_code}` : null),
    billImageUrl: tx.bill_image_url || null,
    bookingId: tx.booking_id || null,
    bookingCode: tx.booking_code || null,
    customerId: tx.customer_id,
    totalBillAmount: parseFloat(tx.total_bill_amount) || 0,
    subQtyCoveredKg: parseFloat(tx.sub_qty_covered_kg) || 0,
    subCreditUsed: parseFloat(tx.sub_credit_used) || 0,
    extraAmountPayable: parseFloat(tx.extra_amount_payable) || 0,
    razorpayGatewayFee: parseFloat(tx.razorpay_gateway_fee) || 0,
    gstOnFee: parseFloat(tx.gst_on_fee_18) || 0,
    finalPaidAmount: parseFloat(tx.final_paid_amount) || 0,
    paymentMethod: tx.payment_method,
    status: tx.status,
    createdAt: tx.created_at,
    items: itemsByTx[tx.id] || [],
  }));
}

/**
 * Retrieve a customer-owned transaction by ID
 * @param {string} transactionId
 * @param {string} customerId
 * @returns {Promise<object|null>}
 */
async function getCustomerTransactionById(transactionId, customerId) {
  if (!transactionId || !customerId) return null;

  const txSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.bill_id,
      t.booking_id,
      t.customer_id,
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      t.total_bill_amount,
      t.sub_qty_covered_kg,
      t.sub_credit_used,
      t.extra_amount_payable,
      t.razorpay_gateway_fee,
      t.gst_on_fee_18,
      t.final_paid_amount,
      t.payment_method,
      t.status,
      t.created_at,
      b.booking_code,
      bl.bill_number,
      bl.image_url AS bill_image_url
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN bookings b ON t.booking_id = b.id
    LEFT JOIN bills bl ON t.bill_id = bl.id
    WHERE t.id = $1 AND t.customer_id = $2;
  `;

  const txRes = await query(txSql, [transactionId, customerId]);
  if (txRes.rows.length === 0) return null;

  const tx = txRes.rows[0];
  const itemsSql = `
    SELECT 
      ti.id,
      ti.fish_id,
      f.name AS fish_name,
      f.image_url AS fish_image_url,
      ti.quantity_kg,
      ti.unit_price,
      ti.subtotal
    FROM transaction_items ti
    JOIN fish f ON ti.fish_id = f.id
    WHERE ti.transaction_id = $1;
  `;

  const itemsRes = await query(itemsSql, [transactionId]);

  return {
    id: tx.id,
    transactionNumber: tx.transaction_number,
    billId: tx.bill_id || null,
    billNumber: tx.bill_number || (tx.booking_code ? `#${tx.booking_code}` : null),
    billImageUrl: tx.bill_image_url || null,
    bookingId: tx.booking_id || null,
    bookingCode: tx.booking_code || null,
    customerId: tx.customer_id,
    customerName: tx.customer_name || 'Valued Customer',
    customerPhone: tx.customer_phone || null,
    totalBillAmount: parseFloat(tx.total_bill_amount) || 0,
    subQtyCoveredKg: parseFloat(tx.sub_qty_covered_kg) || 0,
    subCreditUsed: parseFloat(tx.sub_credit_used) || 0,
    extraAmountPayable: parseFloat(tx.extra_amount_payable) || 0,
    razorpayGatewayFee: parseFloat(tx.razorpay_gateway_fee) || 0,
    gstOnFee: parseFloat(tx.gst_on_fee_18) || 0,
    finalPaidAmount: parseFloat(tx.final_paid_amount) || 0,
    paymentMethod: tx.payment_method,
    status: tx.status,
    createdAt: tx.created_at,
    items: itemsRes.rows.map((item) => ({
      id: item.id,
      fishId: item.fish_id,
      fishName: item.fish_name,
      fishImageUrl: item.fish_image_url,
      quantityKg: parseFloat(item.quantity_kg) || 0,
      unitPrice: parseFloat(item.unit_price) || 0,
      subtotal: parseFloat(item.subtotal) || 0,
    })),
  };
}

/**
 * Atomic creation of a physical store purchase transaction and line items
 * @param {object} client - Active pg client inside transaction
 * @param {object} params
 * @returns {Promise<object>} Created transaction with items
 */
async function createPhysicalTransactionAtomic(client, {
  billId,
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
    throw new Error('A transaction client is required for createPhysicalTransactionAtomic.');
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const txnNumber = `PF-TXN-${dateStr}-${rand}`;

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
      NULL,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12::"PaymentMethod",
      $13,
      NOW()
    )
    RETURNING *;
  `;

  const txnParams = [
    txnNumber,
    billId,
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
 * List, search, filter and paginate transactions for admin console
 * Traceability: ADMIN-13 (Sections 106, 107)
 * 
 * @param {object} [options]
 * @param {string} [options.search]
 * @param {string} [options.status]
 * @param {string} [options.paymentMethod]
 * @param {string} [options.dateFrom]
 * @param {string} [options.dateTo]
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 * @returns {Promise<{ transactions: Array<object>, total: number, counts: object }>}
 */
async function listAdminTransactions({
  search = null,
  status = null,
  paymentMethod = null,
  dateFrom = null,
  dateTo = null,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  // Status counts summary across all transactions
  const countsSql = `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_count,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count,
      COUNT(*) FILTER (WHERE status = 'REFUNDED')::int AS refunded_count,
      COALESCE(SUM(total_bill_amount), 0)::float AS total_bill_sum,
      COALESCE(SUM(final_paid_amount), 0)::float AS final_paid_sum
    FROM transactions;
  `;
  const countsRes = await query(countsSql);
  const counts = countsRes.rows[0] || {
    total_count: 0,
    completed_count: 0,
    pending_count: 0,
    failed_count: 0,
    cancelled_count: 0,
    refunded_count: 0,
    total_bill_sum: 0,
    final_paid_sum: 0,
  };

  const conditions = [];
  const params = [];

  // Status filter
  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  // Payment method filter
  if (paymentMethod && paymentMethod !== 'ALL') {
    params.push(paymentMethod);
    conditions.push(`t.payment_method = $${params.length}::"PaymentMethod"`);
  }

  // Date filters
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (!isNaN(fromDate.getTime())) {
      params.push(fromDate);
      conditions.push(`t.created_at >= $${params.length}`);
    }
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      params.push(toDate);
      conditions.push(`t.created_at <= $${params.length}`);
    }
  }

  // Search filter
  if (search && search.trim()) {
    const term = search.trim();
    const searchPattern = `%${term}%`;
    const numValue = parseFloat(term);
    const isNum = !isNaN(numValue) && isFinite(term);

    params.push(searchPattern);
    const patternIdx = params.length;

    let searchClause = `(
      t.transaction_number ILIKE $${patternIdx}
      OR t.id::text ILIKE $${patternIdx}
      OR c.name ILIKE $${patternIdx}
      OR c.mobile_number ILIKE $${patternIdx}
      OR bl.bill_number ILIKE $${patternIdx}
      OR bl.manual_bill_id ILIKE $${patternIdx}
      OR bk.booking_code ILIKE $${patternIdx}
      OR w.name ILIKE $${patternIdx}
      OR EXISTS (
        SELECT 1 FROM transaction_items ti_s
        JOIN fish f_s ON ti_s.fish_id = f_s.id
        WHERE ti_s.transaction_id = t.id AND f_s.name ILIKE $${patternIdx}
      )
    `;

    if (isNum) {
      params.push(numValue);
      const numIdx = params.length;
      searchClause += ` OR t.total_bill_amount = $${numIdx} OR t.final_paid_amount = $${numIdx}`;
    }

    searchClause += `)`;
    conditions.push(searchClause);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const countSql = `
    SELECT COUNT(DISTINCT t.id)::int AS total
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN workers w ON t.worker_id = w.id
    LEFT JOIN bills bl ON t.bill_id = bl.id
    LEFT JOIN bookings bk ON t.booking_id = bk.id
    ${whereClause};
  `;
  const countRes = await query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  // Fetch paginated transactions
  const dataParams = [...params, safeLimit, safeOffset];
  const listSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.bill_id,
      bl.bill_number,
      bl.manual_bill_id,
      bl.image_url AS bill_image_url,
      t.booking_id,
      bk.booking_code,
      t.customer_id,
      c.name AS customer_name,
      c.mobile_number AS customer_phone,
      t.worker_id,
      w.name AS worker_name,
      t.total_bill_amount,
      t.sub_qty_covered_kg,
      t.sub_credit_used,
      t.extra_amount_payable,
      t.razorpay_gateway_fee,
      t.gst_on_fee_18,
      t.final_paid_amount,
      t.payment_method,
      t.status,
      t.created_at,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', ti.id,
            'fish_id', ti.fish_id,
            'fish_name', f.name,
            'quantity_kg', ti.quantity_kg,
            'unit_price', ti.unit_price,
            'subtotal', ti.subtotal
          ))
          FROM transaction_items ti
          JOIN fish f ON ti.fish_id = f.id
          WHERE ti.transaction_id = t.id
        ), '[]'::json
      ) AS items
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN workers w ON t.worker_id = w.id
    LEFT JOIN bills bl ON t.bill_id = bl.id
    LEFT JOIN bookings bk ON t.booking_id = bk.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const listRes = await query(listSql, dataParams);

  return {
    transactions: listRes.rows.map(tx => ({
      id: tx.id,
      transactionNumber: tx.transaction_number,
      billId: tx.bill_id,
      billNumber: tx.manual_bill_id || tx.bill_number || (tx.booking_code ? `#${tx.booking_code}` : null),
      billImageUrl: tx.bill_image_url,
      bookingId: tx.booking_id,
      bookingCode: tx.booking_code,
      customerId: tx.customer_id,
      customerName: tx.customer_name || 'Walk-in Customer',
      customerPhone: tx.customer_phone,
      workerId: tx.worker_id,
      workerName: tx.worker_name || 'Online / Counter',
      totalBillAmount: parseFloat(tx.total_bill_amount) || 0,
      subQtyCoveredKg: parseFloat(tx.sub_qty_covered_kg) || 0,
      subCreditUsed: parseFloat(tx.sub_credit_used) || 0,
      extraAmountPayable: parseFloat(tx.extra_amount_payable) || 0,
      razorpayGatewayFee: parseFloat(tx.razorpay_gateway_fee) || 0,
      gstOnFee: parseFloat(tx.gst_on_fee_18) || 0,
      finalPaidAmount: parseFloat(tx.final_paid_amount) || 0,
      paymentMethod: tx.payment_method,
      status: tx.status,
      createdAt: tx.created_at,
      items: (tx.items || []).map(item => ({
        id: item.id,
        fishId: item.fish_id,
        fishName: item.fish_name,
        quantityKg: parseFloat(item.quantity_kg) || 0,
        unitPrice: parseFloat(item.unit_price) || 0,
        subtotal: parseFloat(item.subtotal) || 0,
      })),
    })),
    total,
    counts: {
      all: counts.total_count,
      completed: counts.completed_count,
      pending: counts.pending_count,
      failed: counts.failed_count,
      cancelled: counts.cancelled_count,
      refunded: counts.refunded_count,
      totalBillSum: counts.total_bill_sum,
      finalPaidSum: counts.final_paid_sum,
    },
  };
}

/**
 * Retrieve comprehensive details for a single transaction for admin investigation
 * Traceability: ADMIN-13 (Sections 108–116)
 * 
 * @param {string} transactionId
 * @returns {Promise<object|null>}
 */
async function getAdminTransactionDetail(transactionId) {
  if (!transactionId) return null;

  const txSql = `
    SELECT 
      t.id,
      t.transaction_number,
      t.bill_id,
      t.booking_id,
      t.customer_id,
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
      t.created_at,
      -- Customer details
      json_build_object(
        'id', c.id,
        'name', c.name,
        'mobile_number', c.mobile_number,
        'age', c.age,
        'area', c.area,
        'created_at', c.created_at
      ) AS customer,
      -- Worker details
      CASE WHEN w.id IS NOT NULL THEN
        json_build_object(
          'id', w.id,
          'name', w.name,
          'mobile_number', w.mobile_number
        )
      ELSE NULL END AS worker,
      -- Bill details
      CASE WHEN bl.id IS NOT NULL THEN
        json_build_object(
          'id', bl.id,
          'bill_number', bl.bill_number,
          'manual_bill_id', bl.manual_bill_id,
          'image_url', bl.image_url,
          'extracted_text', bl.extracted_text,
          'ai_confidence_score', bl.ai_confidence_score,
          'status', bl.status,
          'created_at', bl.created_at
        )
      ELSE NULL END AS bill,
      -- Booking details
      CASE WHEN bk.id IS NOT NULL THEN
        json_build_object(
          'id', bk.id,
          'booking_code', bk.booking_code,
          'status', bk.status,
          'total_amount', bk.total_amount,
          'created_at', bk.created_at
        )
      ELSE NULL END AS booking
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN workers w ON t.worker_id = w.id
    LEFT JOIN bills bl ON t.bill_id = bl.id
    LEFT JOIN bookings bk ON t.booking_id = bk.id
    WHERE t.id = $1;
  `;

  const txRes = await query(txSql, [transactionId]);
  if (txRes.rows.length === 0) return null;
  const tx = txRes.rows[0];

  // Fetch line items
  const itemsSql = `
    SELECT 
      ti.id,
      ti.fish_id,
      f.name AS fish_name,
      f.image_url AS fish_image_url,
      ti.quantity_kg,
      ti.unit_price,
      ti.subtotal
    FROM transaction_items ti
    JOIN fish f ON ti.fish_id = f.id
    WHERE ti.transaction_id = $1;
  `;
  const itemsRes = await query(itemsSql, [transactionId]);

  // Fetch AI extraction logs if bill_id exists
  let aiLogs = [];
  if (tx.bill_id) {
    const aiSql = `
      SELECT id, raw_response, confidence_score, extraction_duration, created_at
      FROM ai_extraction_logs
      WHERE bill_id = $1
      ORDER BY created_at DESC;
    `;
    const aiRes = await query(aiSql, [tx.bill_id]);
    aiLogs = aiRes.rows;
  }

  // Fetch payments
  const paySql = `
    SELECT id, razorpay_order_id, razorpay_payment_id, amount, method, status, created_at
    FROM payments
    WHERE transaction_id = $1 OR ($2::uuid IS NOT NULL AND booking_id = $2::uuid)
    ORDER BY created_at DESC;
  `;
  const payRes = await query(paySql, [transactionId, tx.booking_id || null]);

  // Fetch audit logs
  const auditSql = `
    SELECT id, actor_type, actor_id, action, entity_type, entity_id, payload, timestamp
    FROM audit_logs
    WHERE (entity_type = 'TRANSACTION' AND entity_id = $1::text)
       OR (payload ILIKE '%' || $1::text || '%')
       OR (payload ILIKE '%' || $2::text || '%')
    ORDER BY timestamp DESC;
  `;
  const auditRes = await query(auditSql, [transactionId, tx.transaction_number]);

  return {
    id: tx.id,
    transactionNumber: tx.transaction_number,
    billId: tx.bill_id,
    bookingId: tx.booking_id,
    customerId: tx.customer_id,
    workerId: tx.worker_id,
    totalBillAmount: parseFloat(tx.total_bill_amount) || 0,
    subQtyCoveredKg: parseFloat(tx.sub_qty_covered_kg) || 0,
    subCreditUsed: parseFloat(tx.sub_credit_used) || 0,
    extraAmountPayable: parseFloat(tx.extra_amount_payable) || 0,
    razorpayGatewayFee: parseFloat(tx.razorpay_gateway_fee) || 0,
    gstOnFee: parseFloat(tx.gst_on_fee_18) || 0,
    finalPaidAmount: parseFloat(tx.final_paid_amount) || 0,
    paymentMethod: tx.payment_method,
    status: tx.status,
    createdAt: tx.created_at,
    customer: tx.customer,
    worker: tx.worker,
    bill: tx.bill,
    booking: tx.booking,
    items: itemsRes.rows.map(item => ({
      id: item.id,
      fishId: item.fish_id,
      fishName: item.fish_name,
      fishImageUrl: item.fish_image_url,
      quantityKg: parseFloat(item.quantity_kg) || 0,
      unitPrice: parseFloat(item.unit_price) || 0,
      subtotal: parseFloat(item.subtotal) || 0,
    })),
    aiLogs: aiLogs.map(a => {
      let parsed = null;
      try { parsed = JSON.parse(a.raw_response); } catch {}
      return {
        id: a.id,
        rawResponse: a.raw_response,
        parsedData: parsed,
        confidenceScore: parseFloat(a.confidence_score) || null,
        extractionDuration: a.extraction_duration,
        createdAt: a.created_at,
      };
    }),
    payments: payRes.rows.map(p => ({
      id: p.id,
      orderId: p.razorpay_order_id,
      paymentId: p.razorpay_payment_id,
      amount: parseFloat(p.amount) || 0,
      method: p.method,
      status: p.status,
      createdAt: p.created_at,
    })),
    auditLogs: auditRes.rows.map(a => {
      let payloadParsed = null;
      try { payloadParsed = JSON.parse(a.payload); } catch { payloadParsed = a.payload; }
      return {
        id: a.id,
        actorType: a.actor_type,
        actorId: a.actor_id,
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        payload: payloadParsed,
        timestamp: a.timestamp,
      };
    }),
  };
}

module.exports = {
  getTodaySuccessfulTransactions,
  getTransactionById,
  getCustomerTransactions,
  getCustomerTransactionById,
  createPhysicalTransactionAtomic,
  listAdminTransactions,
  getAdminTransactionDetail,
};

