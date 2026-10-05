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

module.exports = {
  getTodaySuccessfulTransactions,
  getTransactionById,
};
