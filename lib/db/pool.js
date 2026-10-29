/**
 * Native PostgreSQL Connection Pool Foundation
 * Traceability: Documentation/PondFish_Database_ERD_Data_Model_v1.md & Final Locked Architecture
 * Uses native 'pg' Pool with parameterized SQL queries. Zero ORM abstraction.
 */

const { Pool } = require('pg');

let pool = globalThis.__pondfish_pg_pool || null;

/**
 * Classifies whether a database error is an infrastructure connection or pool exhaustion error
 * @param {Error} error
 * @returns {boolean}
 */
function isDatabaseConnectionError(error) {
  if (!error) return false;
  const msg = error.message || '';
  const code = error.code || '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === '57P01' || // admin_shutdown
    code === '53300' || // too_many_connections
    code === 'EMAXCONNSESSION' ||
    code === 'ECHECKOUTFAILED' ||
    msg.includes('max clients reached') ||
    msg.includes('timeout exceeded when connecting') ||
    msg.includes('Connection terminated unexpectedly')
  );
}

function getPool() {
  if (!pool || pool.ended) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        '[DB FATAL] DATABASE_URL is not configured. PondFish requires an authoritative Supabase-hosted PostgreSQL connection string.'
      );
    }

    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const isProduction = process.env.NODE_ENV === 'production';
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    // Sizing Decision: Bounded pool limit per process (configurable via DB_POOL_MAX).
    // In serverless environments (Vercel), each container handles one request at a time.
    // Setting max: 1 in serverless prevents a single container from hoarding connections,
    // allowing up to 15 concurrent serverless lambdas without exceeding Supavisor's 15-connection limit.
    // In local dev/testing environments, max defaults to 2 to allow concurrent test queries.
    const defaultMax = isServerless ? 1 : 2;
    const parsedMax = parseInt(process.env.DB_POOL_MAX || '', 10);
    const max = Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : defaultMax;

    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max,
      idleTimeoutMillis: isServerless ? 1000 : 5000, // 1s idle release in serverless to return connections to Supavisor immediately
      connectionTimeoutMillis: 5000, // 5s connection checkout timeout (fails fast with controlled error)
      statement_timeout: 10000, // 10s statement timeout to avoid hanging queries
    });

    pool.on('error', (err) => {
      console.error('[DB POOL ERROR] Unexpected client error on idle client:', err.message);
    });

    globalThis.__pondfish_pg_pool = pool;
  }

  return pool;
}

/**
 * Resets the active database pool (used for testing or teardown)
 */
async function resetPool() {
  const currentPool = globalThis.__pondfish_pg_pool || pool;
  if (currentPool) {
    try {
      await currentPool.end();
    } catch {}
  }
  pool = null;
  globalThis.__pondfish_pg_pool = null;
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
    if (isDatabaseConnectionError(error)) {
      error.isConnectionError = true;
      console.error('[DB CONNECTION EXHAUSTION DIAGNOSTIC]', {
        code: error.code,
        message: error.message,
        poolMetrics: getPoolMetrics(),
      });
    }
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
  let client;
  try {
    client = await p.connect();
  } catch (connectError) {
    if (isDatabaseConnectionError(connectError)) {
      connectError.isConnectionError = true;
    }
    throw connectError;
  }

  let clientError = false;
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Flag clientError so the connection is destroyed rather than returned to pool in an uncertain state
      clientError = true;
      console.error('[DB TRANSACTION ROLLBACK ERROR] Rollback query failed:', rollbackError.message);
      // Rollback failure must NOT mask the original error
    }
    if (isDatabaseConnectionError(error)) {
      error.isConnectionError = true;
    }
    throw error;
  } finally {
    try {
      client.release(clientError ? true : undefined);
    } catch (releaseErr) {
      console.error('[DB TRANSACTION RELEASE ERROR] Failed to release client:', releaseErr.message);
    }
  }
}

/**
 * Returns safe, structured metrics on the active pool state
 * @returns {{ status: string, totalCount: number, idleCount: number, waitingCount: number, max: number }}
 */
function getPoolMetrics() {
  const currentPool = globalThis.__pondfish_pg_pool || pool;
  if (!currentPool || currentPool.ended) {
    return { status: 'CLOSED', totalCount: 0, idleCount: 0, waitingCount: 0, max: 0 };
  }
  return {
    status: 'ACTIVE',
    totalCount: currentPool.totalCount || 0,
    idleCount: currentPool.idleCount || 0,
    waitingCount: currentPool.waitingCount || 0,
    max: currentPool.options?.max || 0,
  };
}

module.exports = {
  getPool,
  resetPool,
  isDatabaseConnectionError,
  getPoolMetrics,
  query,
  withTransaction,
};
