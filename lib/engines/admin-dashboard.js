/**
 * Engine 15: Admin Aggregated Operations Dashboard Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 15)
 * & Page-by-Page UI Specification Admin Portal (AP-02)
 */

const pool = require('../db/pool');

function parseDateRange(period, from, to) {
  const now = new Date();
  let startDate;
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'this_week': {
      const w = new Date(now);
      w.setDate(now.getDate() - 7);
      startDate = new Date(w.getFullYear(), w.getMonth(), w.getDate(), 0, 0, 0, 0);
      break;
    }
    case 'this_month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    }
    case 'custom': {
      if (from) {
        const parsedFrom = new Date(from);
        if (!isNaN(parsedFrom.getTime())) {
          startDate = new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), parsedFrom.getDate(), 0, 0, 0, 0);
        }
      }
      if (to) {
        const parsedTo = new Date(to);
        if (!isNaN(parsedTo.getTime())) {
          endDate = new Date(parsedTo.getFullYear(), parsedTo.getMonth(), parsedTo.getDate(), 23, 59, 59, 999);
        }
      }
      if (!startDate) {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      }
      break;
    }
    case 'today':
    default: {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      period = 'today';
      break;
    }
  }

  return {
    period,
    startDate,
    endDate,
  };
}

async function getDashboardMetrics({ period = 'today', from = null, to = null } = {}) {
  const { period: resolvedPeriod, startDate, endDate } = parseDateRange(period, from, to);

  // 1. Inventory Summary (Live state)
  const invRes = await pool.query(`
    SELECT 
      (SELECT COUNT(*)::int FROM fish) AS total_fish,
      (SELECT COUNT(*)::int FROM fish WHERE physical_available = true) AS available_fish,
      (SELECT COUNT(*)::int FROM fish WHERE physical_available = false) AS unavailable_fish,
      (SELECT COUNT(*)::int FROM inventory WHERE available_quantity < 10) AS low_stock,
      (SELECT COUNT(*)::int FROM fish WHERE freshness_state = 'GREY') AS aging_fish,
      (SELECT COUNT(*)::int FROM fish WHERE freshness_state = 'RED') AS expired_fish,
      (SELECT COALESCE(SUM(physical_quantity), 0) FROM inventory) AS total_physical_kg,
      (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory) AS total_available_kg,
      (SELECT COALESCE(SUM(reserved_quantity), 0) FROM inventory) AS total_reserved_kg
  `);
  const invRow = invRes.rows[0] || {};

  // 2. Bookings (Filtered by range for created bookings, plus current pending)
  const bookRes = await pool.query(`
    SELECT 
      COUNT(*)::int AS period_bookings,
      COUNT(*) FILTER (WHERE status = 'PENDING_COLLECTION' OR status = 'CONFIRMED')::int AS pending_collection,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired
    FROM bookings
    WHERE created_at >= $1 AND created_at <= $2
  `, [startDate, endDate]);
  const bookRow = bookRes.rows[0] || {};

  // 3. Transactions (Filtered by date range)
  const txRes = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_transactions,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS successful,
      COUNT(*) FILTER (WHERE status != 'COMPLETED')::int AS failed,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_bill_amount ELSE 0 END), 0) AS total_bill_value,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN sub_credit_used ELSE 0 END), 0) AS sub_credit_used,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN final_paid_amount ELSE 0 END), 0) AS final_paid_amount
    FROM transactions
    WHERE created_at >= $1 AND created_at <= $2
  `, [startDate, endDate]);
  const txRow = txRes.rows[0] || {};

  // Payment methods breakdown
  const pmRes = await pool.query(`
    SELECT 
      payment_method,
      COUNT(*)::int AS count,
      COALESCE(SUM(final_paid_amount), 0) AS total_amount
    FROM transactions
    WHERE status = 'COMPLETED' AND created_at >= $1 AND created_at <= $2
    GROUP BY payment_method
  `, [startDate, endDate]);

  // 4. Subscriptions (Active counts, expiring within 7 days, sales in period, outstanding credits)
  const subRes = await pool.query(`
    SELECT 
      (SELECT COUNT(*)::int FROM customer_subscriptions WHERE status = 'ACTIVE' AND expires_at > NOW()) AS active_subscriptions,
      (SELECT COUNT(*)::int FROM customer_subscriptions WHERE status = 'ACTIVE' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS expiring_soon,
      (SELECT COALESCE(SUM(credit_balance), 0) FROM customer_subscriptions WHERE status = 'ACTIVE') AS outstanding_credit,
      (SELECT COALESCE(SUM(p.price), 0) FROM customer_subscriptions cs JOIN subscription_plans p ON cs.plan_id = p.id WHERE cs.created_at >= $1 AND cs.created_at <= $2) AS subscription_sales
  `, [startDate, endDate]);
  const subRow = subRes.rows[0] || {};

  // 5. Truck & GPS Live Status (Always reflects latest operational journey)
  const truckRes = await pool.query(`
    SELECT 
      j.id AS journey_id, 
      j.truck_number, 
      j.driver_name, 
      j.status, 
      j.published_to_customer,
      j.origin, 
      j.destination, 
      j.fish_manifest, 
      j.started_at, 
      j.ended_at,
      p.latitude, 
      p.longitude, 
      p.speed, 
      p.heading, 
      p.recorded_at AS last_ping_at
    FROM gps_journeys j
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, speed, heading, recorded_at
      FROM gps_positions
      WHERE journey_id = j.id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) p ON true
    ORDER BY j.created_at DESC
    LIMIT 1
  `);
  const truckData = truckRes.rows[0] || null;

  // 6. Freshness Alerts (Fish items in Red, Yellow, Grey status)
  const freshRes = await pool.query(`
    SELECT 
      id, 
      name, 
      unit_price, 
      freshness_state, 
      updated_at
    FROM fish
    WHERE freshness_state IN ('RED', 'YELLOW', 'GREY')
    ORDER BY 
      CASE freshness_state 
        WHEN 'RED' THEN 1 
        WHEN 'YELLOW' THEN 2 
        WHEN 'GREY' THEN 3 
        ELSE 4 
      END,
      updated_at DESC
    LIMIT 10
  `);

  // 7. Worker Summary
  const workerRes = await pool.query(`
    SELECT 
      (SELECT COUNT(*)::int FROM workers WHERE active = true) AS active_workers,
      (SELECT COUNT(*)::int FROM transactions WHERE created_at >= $1 AND created_at <= $2) AS orders_handled_today,
      (SELECT COUNT(*)::int FROM bookings WHERE status = 'COMPLETED' AND updated_at >= $1 AND updated_at <= $2) AS completed_bookings_today
  `, [startDate, endDate]);
  const workerRow = workerRes.rows[0] || {};

  return {
    dateRange: {
      period: resolvedPeriod,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    inventory: {
      total_fish: invRow.total_fish || 0,
      available_fish: invRow.available_fish || 0,
      unavailable_fish: invRow.unavailable_fish || 0,
      low_stock: invRow.low_stock || 0,
      aging_fish: invRow.aging_fish || 0,
      expired_fish: invRow.expired_fish || 0,
      total_physical_kg: parseFloat(invRow.total_physical_kg || 0),
      total_available_kg: parseFloat(invRow.total_available_kg || 0),
      total_reserved_kg: parseFloat(invRow.total_reserved_kg || 0),
    },
    bookings: {
      period_bookings: bookRow.period_bookings || 0,
      pending_collection: bookRow.pending_collection || 0,
      completed: bookRow.completed || 0,
      cancelled: bookRow.cancelled || 0,
      expired: bookRow.expired || 0,
    },
    transactions: {
      total_transactions: txRow.total_transactions || 0,
      successful: txRow.successful || 0,
      failed: txRow.failed || 0,
      total_bill_value: parseFloat(txRow.total_bill_value || 0),
      sub_credit_used: parseFloat(txRow.sub_credit_used || 0),
      final_paid_amount: parseFloat(txRow.final_paid_amount || 0),
      payment_methods: pmRes.rows || [],
    },
    subscriptions: {
      active_subscriptions: subRow.active_subscriptions || 0,
      expiring_soon: subRow.expiring_soon || 0,
      outstanding_credit: parseFloat(subRow.outstanding_credit || 0),
      subscription_sales: parseFloat(subRow.subscription_sales || 0),
    },
    truck: truckData ? {
      journey_id: truckData.journey_id,
      truck_number: truckData.truck_number,
      driver_name: truckData.driver_name,
      status: truckData.status,
      published_to_customer: truckData.published_to_customer,
      origin: truckData.origin,
      destination: truckData.destination,
      fish_manifest: truckData.fish_manifest || [],
      started_at: truckData.started_at,
      ended_at: truckData.ended_at,
      latest_position: truckData.latitude ? {
        latitude: truckData.latitude,
        longitude: truckData.longitude,
        speed: truckData.speed,
        heading: truckData.heading,
        last_ping_at: truckData.last_ping_at,
      } : null,
    } : {
      status: 'IDLE',
      truck_number: null,
      driver_name: null,
      latest_position: null,
    },
    freshness_alerts: freshRes.rows.map(f => ({
      id: f.id,
      name: f.name,
      unit_price: f.unit_price,
      freshness_state: f.freshness_state,
      updated_at: f.updated_at,
    })),
    workers: {
      active_workers: workerRow.active_workers || 0,
      orders_handled: workerRow.orders_handled_today || 0,
      completed_bookings: workerRow.completed_bookings_today || 0,
    },
  };
}

module.exports = {
  name: 'AdminDashboardEngine',
  getDashboardMetrics,
  parseDateRange,
};
