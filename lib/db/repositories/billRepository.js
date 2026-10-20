/**
 * Bill Persistence Repository
 * Traceability: PondFish Database ERD Data Model v1 (Section 17), API Specification v1 (Sections 18-23)
 * Manages physical store bills, manual Bill ID overrides, and AI extraction logs.
 * Native parameterized PostgreSQL queries. Zero ORM abstraction.
 */

const { query } = require('../pool');

/**
 * Create a new bill record
 * @param {object} [client] - Optional active transaction client
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.imageUrl
 * @param {string} [params.billNumber]
 * @param {string} [params.extractedText]
 * @param {number} [params.aiConfidenceScore]
 * @param {string} [params.manualBillId]
 * @param {string} [params.status='PENDING'] - 'PENDING' | 'EXTRACTED' | 'MANUALLY_VERIFIED' | 'PROCESSED' | 'REJECTED'
 * @returns {Promise<object>}
 */
async function createBill(client, {
  customerId,
  imageUrl,
  billNumber = null,
  extractedText = null,
  aiConfidenceScore = null,
  manualBillId = null,
  status = 'PENDING',
}) {
  const runner = client || { query };
  const sql = `
    INSERT INTO bills (
      id,
      customer_id,
      bill_number,
      image_url,
      extracted_text,
      ai_confidence_score,
      manual_bill_id,
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
      NOW()
    )
    RETURNING *;
  `;

  const values = [
    customerId,
    billNumber ? billNumber.trim().toUpperCase() : null,
    imageUrl,
    extractedText,
    aiConfidenceScore !== null && !isNaN(aiConfidenceScore) ? parseFloat(aiConfidenceScore) : null,
    manualBillId ? manualBillId.trim().toUpperCase() : null,
    status,
  ];

  const res = await runner.query(sql, values);
  return res.rows[0];
}

/**
 * Retrieve a bill by its unique ID
 * @param {string} billId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function getBillById(billId, client = null) {
  if (!billId) return null;
  const runner = client || { query };
  const sql = `
    SELECT 
      b.id,
      b.customer_id,
      b.bill_number,
      b.image_url,
      b.extracted_text,
      b.ai_confidence_score,
      b.manual_bill_id,
      b.status,
      b.created_at,
      c.name AS customer_name,
      c.mobile_number AS customer_phone
    FROM bills b
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE b.id = $1;
  `;
  const res = await runner.query(sql, [billId]);
  return res.rows[0] || null;
}

/**
 * Update bill status
 * @param {object} client
 * @param {string} billId
 * @param {string} status - 'PENDING' | 'EXTRACTED' | 'MANUALLY_VERIFIED' | 'PROCESSED' | 'REJECTED'
 * @returns {Promise<object|null>}
 */
async function updateBillStatus(client, billId, status) {
  const runner = client || { query };
  const sql = `
    UPDATE bills
    SET status = $1
    WHERE id = $2
    RETURNING *;
  `;
  const res = await runner.query(sql, [status, billId]);
  return res.rows[0] || null;
}

/**
 * Update manual bill number override
 * @param {object} client
 * @param {string} billId
 * @param {string} billNumber
 * @param {boolean} [isManual=true]
 * @returns {Promise<object|null>}
 */
async function updateBillNumber(client, billId, billNumber, isManual = true) {
  const runner = client || { query };
  const normalized = billNumber ? billNumber.trim().toUpperCase() : null;
  const sql = isManual
    ? `
      UPDATE bills
      SET manual_bill_id = $1, bill_number = COALESCE(bill_number, $1), status = 'MANUALLY_VERIFIED'
      WHERE id = $2
      RETURNING *;
    `
    : `
      UPDATE bills
      SET bill_number = $1
      WHERE id = $2
      RETURNING *;
    `;
  const res = await runner.query(sql, [normalized, billId]);
  return res.rows[0] || null;
}

/**
 * Update extraction details on an existing bill
 * @param {object} client
 * @param {string} billId
 * @param {object} params
 */
async function updateBillExtraction(client, billId, { billNumber, extractedText, aiConfidenceScore, status }) {
  const runner = client || { query };
  const sql = `
    UPDATE bills
    SET 
      bill_number = COALESCE($1, bill_number),
      extracted_text = COALESCE($2, extracted_text),
      ai_confidence_score = COALESCE($3, ai_confidence_score),
      status = COALESCE($4, status)
    WHERE id = $5
    RETURNING *;
  `;
  const res = await runner.query(sql, [
    billNumber ? billNumber.trim().toUpperCase() : null,
    extractedText || null,
    aiConfidenceScore !== null && !isNaN(aiConfidenceScore) ? parseFloat(aiConfidenceScore) : null,
    status || null,
    billId,
  ]);
  return res.rows[0] || null;
}

/**
 * Check if a bill number or manual bill ID has already been successfully processed.
 * Enforces PRD Section 8.4 & API Section 23 duplicate bill protection.
 * @param {string} billNumber
 * @param {string} [excludeBillId] - Optional current bill ID to exclude
 * @param {object} [client]
 * @returns {Promise<boolean>}
 */
async function isBillNumberAlreadyProcessed(billNumber, excludeBillId = null, client = null) {
  if (!billNumber || typeof billNumber !== 'string') return false;
  const runner = client || { query };
  const normalized = billNumber.trim().toUpperCase();

  const params = [normalized];
  let excludeClause = '';
  if (excludeBillId) {
    params.push(excludeBillId);
    excludeClause = `AND b.id != $${params.length}`;
  }

  // Check 1: Existing bill marked PROCESSED
  const billCheckSql = `
    SELECT id 
    FROM bills b
    WHERE (b.bill_number = $1 OR b.manual_bill_id = $1)
      AND b.status = 'PROCESSED'
      ${excludeClause}
    LIMIT 1;
  `;
  const billRes = await runner.query(billCheckSql, params);
  if (billRes.rows.length > 0) return true;

  // Check 2: Existing completed transaction linking to a bill with that number
  const txCheckSql = `
    SELECT t.id
    FROM transactions t
    JOIN bills b ON t.bill_id = b.id
    WHERE (b.bill_number = $1 OR b.manual_bill_id = $1)
      AND t.status = 'COMPLETED'
      ${excludeClause}
    LIMIT 1;
  `;
  const txRes = await runner.query(txCheckSql, params);
  return txRes.rows.length > 0;
}

/**
 * Insert record into immutable ai_extraction_logs table
 * @param {object} [client]
 * @param {object} params
 * @param {string} params.billId
 * @param {string} params.rawResponse
 * @param {number} params.confidenceScore
 * @param {number} params.extractionDuration - in milliseconds
 * @returns {Promise<object>}
 */
async function logAiExtraction(client, { billId, rawResponse, confidenceScore, extractionDuration }) {
  const runner = client || { query };
  const sql = `
    INSERT INTO ai_extraction_logs (
      id,
      bill_id,
      raw_response,
      confidence_score,
      extraction_duration,
      created_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      NOW()
    )
    RETURNING *;
  `;
  const res = await runner.query(sql, [
    billId,
    typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse),
    confidenceScore !== null && !isNaN(confidenceScore) ? parseFloat(confidenceScore) : 0,
    parseInt(extractionDuration, 10) || 0,
  ]);
  return res.rows[0];
}

module.exports = {
  createBill,
  getBillById,
  updateBillStatus,
  updateBillNumber,
  updateBillExtraction,
  isBillNumberAlreadyProcessed,
  logAiExtraction,
};
