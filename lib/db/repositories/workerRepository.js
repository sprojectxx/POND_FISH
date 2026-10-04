/**
 * Worker Persistence Repository
 * Traceability: PondFish Database ERD (Section 4.2) & Worker Portal Spec (Section 9)
 * Handles worker authentication, profile retrieval, and credential verification using native pg.
 */

const crypto = require('crypto');
const { query } = require('../pool');

/**
 * Sanitize 10-digit Indian mobile number
 * @param {string|number} mobile
 * @returns {string}
 */
function sanitizeMobile(mobile) {
  if (!mobile) return '';
  return String(mobile).replace(/\D/g, '').slice(-10);
}

/**
 * Hash password securely using native pbkdf2
 * @param {string} password
 * @param {string} [salt]
 * @returns {string} format: salt:hash
 */
function hashPassword(password, salt = null) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return `${actualSalt}:${hash}`;
}

/**
 * Verify plaintext password against stored password hash
 * Supports salt:hash (pbkdf2), sha256 hex, or direct match
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;

  // Format 1: salt:hash (pbkdf2)
  if (storedHash.includes(':')) {
    const [salt, expectedHash] = storedHash.split(':');
    const computedHash = crypto.pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512').toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch {
      return false;
    }
  }

  // Format 2: Standard SHA-256 hash (64 hex characters)
  if (storedHash.length === 64) {
    const computedSha256 = crypto.createHash('sha256').update(plainPassword).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computedSha256, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch {
      return false;
    }
  }

  // Fallback direct equality check (e.g. initial dev baseline)
  return plainPassword === storedHash;
}

/**
 * Find an active worker by mobile number
 * @param {string} mobileNumber
 * @returns {Promise<object|null>}
 */
async function findWorkerByMobile(mobileNumber) {
  const cleaned = sanitizeMobile(mobileNumber);
  if (!cleaned) return null;

  const sql = `
    SELECT 
      id,
      name,
      mobile_number,
      password_hash,
      active,
      created_at,
      updated_at
    FROM workers
    WHERE mobile_number = $1
    LIMIT 1;
  `;
  const res = await query(sql, [cleaned]);
  return res.rows[0] || null;
}

/**
 * Find worker by ID
 * @param {string} workerId
 * @returns {Promise<object|null>}
 */
async function findWorkerById(workerId) {
  if (!workerId) return null;

  const sql = `
    SELECT 
      id,
      name,
      mobile_number,
      active,
      created_at,
      updated_at
    FROM workers
    WHERE id = $1
    LIMIT 1;
  `;
  const res = await query(sql, [workerId]);
  return res.rows[0] || null;
}

module.exports = {
  sanitizeMobile,
  hashPassword,
  verifyPassword,
  findWorkerByMobile,
  findWorkerById,
};
