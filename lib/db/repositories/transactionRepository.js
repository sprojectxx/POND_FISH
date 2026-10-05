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

module.exports = {
  getTodaySuccessfulTransactions,
  getTransactionById,
  getCustomerTransactions,
  getCustomerTransactionById,
  createPhysicalTransactionAtomic,
};

