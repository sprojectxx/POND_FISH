/**
 * Admin Persistence Repository
 * Traceability: PondFish Database ERD (Section 4.3), Master PRD (Section 26 & 27)
 * Handles admin profile lookup, password verification, and credential updates via native pg.
 */

const bcrypt = require('bcryptjs');
const { query } = require('../pool');

const BCRYPT_ROUNDS = 12;

/**
 * Hash password securely using bcrypt (12 rounds)
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify plain password against stored password hash
 * Supports bcrypt ($2a$, $2b$, $2y$) and legacy formats
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;

  // Format 1: Bcrypt hash
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(plainPassword, storedHash);
    } catch {
      return false;
    }
  }

  // Format 2: Fallback direct comparison (dev baseline if any)
  return plainPassword === storedHash;
}

/**
 * Find admin by email (case-insensitive)
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findAdminByEmail(email) {
  if (!email) return null;
  const sql = `
    SELECT 
      id,
      name,
      email,
      password_hash,
      is_super_admin,
      created_at,
      updated_at
    FROM admins
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query(sql, [email.trim()]);
  return res.rows[0] || null;
}

/**
 * Find admin by ID
 * @param {string} adminId
 * @returns {Promise<object|null>}
 */
async function findAdminById(adminId) {
  if (!adminId) return null;
  const sql = `
    SELECT 
      id,
      name,
      email,
      password_hash,
      is_super_admin,
      created_at,
      updated_at
    FROM admins
    WHERE id = $1
    LIMIT 1;
  `;
  const res = await query(sql, [adminId]);
  return res.rows[0] || null;
}

/**
 * Update admin password hash and touch updated_at
 * @param {string} adminId
 * @param {string} passwordHash
 * @returns {Promise<object>}
 */
async function updateAdminPassword(adminId, passwordHash) {
  if (!adminId || !passwordHash) {
    throw new Error('adminId and passwordHash are required.');
  }
  const sql = `
    UPDATE admins
    SET 
      password_hash = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, email, is_super_admin, updated_at;
  `;
  const res = await query(sql, [passwordHash, adminId]);
  if (res.rows.length === 0) {
    throw new Error('Admin account not found.');
  }
  return res.rows[0];
}

/**
 * Touch admin updated_at timestamp
 * @param {string} adminId
 * @returns {Promise<object>}
 */
async function touchAdminUpdated(adminId) {
  if (!adminId) return null;
  const sql = `
    UPDATE admins
    SET updated_at = NOW()
    WHERE id = $1
    RETURNING id, updated_at;
  `;
  const res = await query(sql, [adminId]);
  return res.rows[0] || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  findAdminByEmail,
  findAdminById,
  updateAdminPassword,
  touchAdminUpdated,
};
