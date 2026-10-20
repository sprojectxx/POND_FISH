/**
 * Engine 20: Operational Exceptions Engine
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (AP-20, Sections 169–173)
 * Real-time operational exception detection, severity grading, safe diagnostic context,
 * and authorization-controlled resolution workflows with immutable audit logging.
 */

const pool = require('../db/pool');
const auditEngine = require('./audit');
const bookingExpiryEngine = require('./booking-expiry');

/**
 * Aggregates real operational anomalies from authoritative database tables
 */
async function listOperationalExceptions({ category = null, severity = null } = {}) {
  const exceptions = [];

  // 1. FAILED PAYMENTS
  const failedPaymentsRes = await pool.query(`
    SELECT p.id, p.transaction_id, p.booking_id, p.amount, p.method, p.status, p.created_at
    FROM payments p
    WHERE p.status IN ('FAILED', 'ERROR')
    ORDER BY p.created_at DESC
    LIMIT 25;
  `);

  for (const p of failedPaymentsRes.rows) {
    exceptions.push({
      id: `payment-${p.id}`,
      category: 'FAILED_PAYMENTS',
      severity: 'CRITICAL',
      issue: 'Payment Gateway Failure',
      entityType: 'PAYMENT',
      entityId: p.id,
      timestamp: p.created_at,
      currentState: `Payment status: ${p.status}`,
      suggestedAction: 'Review gateway webhook payload and assist customer with retry.',
      canResolve: false,
      allowedAction: null,
      context: {
        amount: p.amount,
        method: p.method,
        transaction_id: p.transaction_id,
        booking_id: p.booking_id,
      },
    });
  }

  // 2. OVERDUE UNCOLLECTED BOOKINGS (past 48h expiry)
  const overdueBookingsRes = await pool.query(`
    SELECT b.id, b.booking_code, b.customer_id, b.total_amount, b.status, b.expires_at, b.created_at, c.name AS customer_name
    FROM bookings b
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE b.status IN ('PENDING_COLLECTION', 'CONFIRMED') AND b.expires_at < NOW()
    ORDER BY b.expires_at ASC
    LIMIT 25;
  `);

  for (const b of overdueBookingsRes.rows) {
    exceptions.push({
      id: `booking-${b.id}`,
      category: 'EXPIRED_BOOKINGS',
      severity: 'HIGH',
      issue: 'Overdue Booking Past 48-Hour Expiry Window',
      entityType: 'BOOKING',
      entityId: b.id,
      timestamp: b.expires_at,
      currentState: `Status: ${b.status} (Expired at ${new Date(b.expires_at).toLocaleString()})`,
      suggestedAction: 'Execute booking expiration lifecycle to release reserved fish inventory and restore credits.',
      canResolve: true,
      allowedAction: 'EXPIRE_OVERDUE_BOOKING',
      context: {
        booking_code: b.booking_code,
        customer_name: b.customer_name || 'Guest',
        total_amount: b.total_amount,
      },
    });
  }

  // 3. INVENTORY ANOMALIES: EXPIRED BATCHES & DEPLETED LISTINGS
  const expiredBatchesRes = await pool.query(`
    SELECT b.id, b.fish_id, f.name AS fish_name, b.batch_code, b.physical_qty, b.expiry_at
    FROM inventory_batches b
    JOIN fish f ON b.fish_id = f.id
    WHERE b.expiry_at < NOW() AND b.physical_qty > 0
    ORDER BY b.expiry_at ASC
    LIMIT 25;
  `);

  for (const eb of expiredBatchesRes.rows) {
    exceptions.push({
      id: `batch-${eb.id}`,
      category: 'INVENTORY_ANOMALIES',
      severity: 'HIGH',
      issue: 'Expired Fish Batch Retaining Physical Stock',
      entityType: 'INVENTORY_BATCH',
      entityId: eb.id,
      timestamp: eb.expiry_at,
      currentState: `Physical Qty: ${eb.physical_qty} kg (Expired at ${new Date(eb.expiry_at).toLocaleDateString()})`,
      suggestedAction: 'Write off expired batch and update freshness status.',
      canResolve: false,
      allowedAction: null,
      context: {
        fish_name: eb.fish_name,
        batch_code: eb.batch_code,
        physical_qty: eb.physical_qty,
      },
    });
  }

  const depletedStockRes = await pool.query(`
    SELECT f.id, f.name AS fish_name, f.unit_price, f.freshness_state, COALESCE(i.available_quantity, 0) AS available_quantity, f.updated_at
    FROM fish f
    LEFT JOIN inventory i ON f.id = i.fish_id
    WHERE f.physical_available = true AND (i.available_quantity IS NULL OR i.available_quantity <= 0)
    ORDER BY f.name ASC;
  `);

  for (const ds of depletedStockRes.rows) {
    exceptions.push({
      id: `fish-depleted-${ds.id}`,
      category: 'INVENTORY_ANOMALIES',
      severity: 'MEDIUM',
      issue: 'Fish Listed Available with Zero Stock',
      entityType: 'FISH',
      entityId: ds.id,
      timestamp: ds.updated_at,
      currentState: `Physical available: true | Available Stock: ${ds.available_quantity} kg`,
      suggestedAction: 'Deactivate physical availability flag until stock receiving arrives.',
      canResolve: true,
      allowedAction: 'DEACTIVATE_PHYSICAL_AVAILABILITY',
      context: {
        fish_name: ds.fish_name,
        unit_price: ds.unit_price,
        freshness_state: ds.freshness_state,
      },
    });
  }

  // 4. NOTIFICATION FAILURES
  const failedNotifsRes = await pool.query(`
    SELECT d.id, d.notification_id, d.channel, d.status, d.error_message, d.failed_at, n.title, n.customer_id
    FROM notification_deliveries d
    JOIN notifications n ON d.notification_id = n.id
    WHERE d.status = 'FAILED'
    ORDER BY d.created_at DESC
    LIMIT 20;
  `);

  for (const fn of failedNotifsRes.rows) {
    exceptions.push({
      id: `notif-${fn.id}`,
      category: 'NOTIFICATION_FAILURES',
      severity: 'LOW',
      issue: 'Notification Push/Delivery Failure',
      entityType: 'NOTIFICATION_DELIVERY',
      entityId: fn.id,
      timestamp: fn.failed_at || new Date(),
      currentState: `Channel: ${fn.channel} | Status: FAILED`,
      suggestedAction: 'Verify customer FCM registration token and retry notification.',
      canResolve: false,
      allowedAction: null,
      context: {
        notification_title: fn.title,
        error_message: fn.error_message || 'Unreachable push provider',
      },
    });
  }

  // 5. STALE GPS TELEMETRY
  const staleGpsRes = await pool.query(`
    SELECT 
      j.id, j.truck_number, j.driver_name, j.started_at,
      p.recorded_at AS last_ping_at
    FROM gps_journeys j
    LEFT JOIN LATERAL (
      SELECT recorded_at FROM gps_positions WHERE journey_id = j.id ORDER BY recorded_at DESC LIMIT 1
    ) p ON true
    WHERE j.status = 'LIVE' AND (p.recorded_at IS NULL OR p.recorded_at < NOW() - INTERVAL '15 minutes');
  `);

  for (const sg of staleGpsRes.rows) {
    exceptions.push({
      id: `gps-${sg.id}`,
      category: 'STALE_GPS',
      severity: 'HIGH',
      issue: 'Live Truck Telemetry Stale (>15 minutes)',
      entityType: 'GPS_JOURNEY',
      entityId: sg.id,
      timestamp: sg.last_ping_at || sg.started_at,
      currentState: `Status: LIVE | Last Ping: ${sg.last_ping_at ? new Date(sg.last_ping_at).toLocaleTimeString() : 'Never'}`,
      suggestedAction: 'Contact driver or verify OneLap GPS device connectivity. Telemetry loss is an operational alert; do not mutate active journey state.',
      canResolve: false,
      allowedAction: null,
      context: {
        truck_number: sg.truck_number,
        driver_name: sg.driver_name,
      },
    });
  }

  // Filter by category / severity if requested
  let filtered = exceptions;
  if (category) {
    filtered = filtered.filter(e => e.category === category);
  }
  if (severity) {
    filtered = filtered.filter(e => e.severity === severity);
  }

  // Sort by Severity priority: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
  filtered.sort((a, b) => (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5));

  return filtered;
}

/**
 * Resolve an operational exception through the appropriate business engine
 */
async function resolveException({ actionType, entityId, reason = 'Admin exception resolution', adminId = 'admin-system' } = {}) {
  if (!actionType || !entityId) {
    throw new Error('Action type and entity ID are required for exception resolution');
  }

  let result = null;

  switch (actionType) {
    case 'EXPIRE_OVERDUE_BOOKING': {
      // Calls existing authoritative booking expiry engine
      result = await bookingExpiryEngine.expireBooking(entityId, { force: true });
      break;
    }
    case 'DEACTIVATE_PHYSICAL_AVAILABILITY': {
      // Updates fish availability safely
      const updateRes = await pool.query(
        'UPDATE fish SET physical_available = false, updated_at = NOW() WHERE id = $1 RETURNING id, name, physical_available;',
        [entityId]
      );
      if (updateRes.rows.length === 0) {
        throw new Error(`Fish with ID ${entityId} not found`);
      }
      result = { success: true, fish: updateRes.rows[0] };
      break;
    }
    default:
      throw new Error(`Unsupported or unapproved resolution action: ${actionType}`);
  }

  // Immutable audit log recording for the resolution
  try {
    await auditEngine.recordAuditLog({
      actorType: 'ADMIN',
      actorId: adminId,
      action: `RESOLVE_EXCEPTION_${actionType}`,
      entityType: 'EXCEPTIONS',
      entityId: String(entityId),
      payload: {
        actionType,
        reason,
        result,
        resolved_at: new Date().toISOString(),
      },
    });
  } catch (auditErr) {
    console.error('[ExceptionsEngine] Failed to write audit record:', auditErr.message);
  }

  return {
    success: true,
    actionType,
    entityId,
    result,
  };
}

module.exports = {
  name: 'ExceptionsEngine',
  listOperationalExceptions,
  resolveException,
};
