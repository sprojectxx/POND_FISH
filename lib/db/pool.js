/**
 * Native PostgreSQL Connection Pool Foundation
 * Traceability: Documentation/PondFish_Database_ERD_Data_Model_v1.md & Final Locked Architecture
 * Uses native 'pg' Pool with parameterized SQL queries. Zero ORM abstraction.
 */

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        '[DB FATAL] DATABASE_URL is not configured. PondFish requires an authoritative Supabase-hosted PostgreSQL connection string.'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[DB POOL ERROR] Unexpected client error on idle client:', err.message);
    });
  }

  return pool;
}

/**
 * Execute a parameterized SQL query
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Array of parameters
 * @returns {Promise<{ rows: Array, rowCount: number }>}
 */
async function query(text, params = []) {
  const start = Date.now();
  const client = getPool();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${text.slice(0, 100)}`);
    }
    return res;
  } catch (error) {
    console.error(`[DB QUERY ERROR] ${error.message} (Query: ${text.slice(0, 100)})`);
    throw error;
  }
}

/**
 * Execute operations within a database transaction
 * @param {Function} callback - Function receiving transaction client (client.query)
 */
async function withTransaction(callback) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
};
