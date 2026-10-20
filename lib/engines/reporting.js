/**
 * Engine 26: Reporting & Export Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 26),
 * Page-by-Page UI Specification Admin Portal (AP-18, Sections 152–163)
 * Server-side authoritative aggregations for Revenue, Sales, Bookings,
 * Subscriptions, Inventory, and Workers, with secure CSV export.
 */

const pool = require('../db/pool');
const { parseDateRange } = require('./admin-dashboard');

const ALLOWED_REPORT_TYPES = ['revenue', 'sales', 'bookings', 'subscriptions', 'inventory', 'workers'];

/**
 * Sanitize cell to prevent Spreadsheet Formula Injection (CSV injection)
 * Any value starting with =, +, -, @, \t, \r is prefixed with a single quote.
 */
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // Security check: Formula injection prefixes
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Quote if contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generate Report based on type and filters
 */
async function generateReport({ type = 'revenue', period = 'this_month', from = null, to = null, page = 1, limit = 50 } = {}) {
  if (!ALLOWED_REPORT_TYPES.includes(type)) {
    const err = new Error(`INVALID_REPORT_TYPE: ${type}`);
    err.code = 'INVALID_REPORT_TYPE';
    throw err;
  }

  const { period: resolvedPeriod, startDate, endDate } = parseDateRange(period, from, to);
  const offset = Math.max(0, (parseInt(page, 10) - 1) * parseInt(limit, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  switch (type) {
    case 'revenue': {
      // Summary
      const summaryRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(total_bill_amount), 0) AS total_bill_value,
          COALESCE(SUM(sub_credit_used), 0) AS total_sub_credit_used,
          COALESCE(SUM(final_paid_amount), 0) AS total_revenue
        FROM transactions
        WHERE status = 'COMPLETED' AND created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      // Payment methods breakdown
      const pmRes = await pool.query(`
        SELECT 
          payment_method,
          COUNT(*)::int AS count,
          COALESCE(SUM(final_paid_amount), 0) AS total
        FROM transactions
        WHERE status = 'COMPLETED' AND created_at >= $1 AND created_at <= $2
        GROUP BY payment_method;
      `, [startDate, endDate]);

      // Daily Breakdown
      const breakdownRes = await pool.query(`
        SELECT 
          DATE(created_at) AS date,
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(total_bill_amount), 0) AS bill_value,
          COALESCE(SUM(sub_credit_used), 0) AS sub_used,
          COALESCE(SUM(final_paid_amount), 0) AS revenue
        FROM transactions
        WHERE status = 'COMPLETED' AND created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT $3 OFFSET $4;
      `, [startDate, endDate, safeLimit, offset]);

      const countRes = await pool.query(`
        SELECT COUNT(DISTINCT DATE(created_at))::int AS total_days
        FROM transactions
        WHERE status = 'COMPLETED' AND created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      return {
        type: 'revenue',
        period: resolvedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          transaction_count: summaryRes.rows[0]?.transaction_count || 0,
          total_bill_value: parseFloat(summaryRes.rows[0]?.total_bill_value || 0),
          total_sub_credit_used: parseFloat(summaryRes.rows[0]?.total_sub_credit_used || 0),
          total_revenue: parseFloat(summaryRes.rows[0]?.total_revenue || 0),
          payment_methods: pmRes.rows,
        },
        pagination: {
          page: parseInt(page, 10),
          limit: safeLimit,
          total: countRes.rows[0]?.total_days || 0,
        },
        rows: breakdownRes.rows.map(r => ({
          date: r.date,
          transaction_count: r.transaction_count,
          bill_value: parseFloat(r.bill_value),
          sub_used: parseFloat(r.sub_used),
          revenue: parseFloat(r.revenue),
        })),
      };
    }

    case 'sales': {
      // Summary
      const summaryRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(total_bill_amount), 0) AS total_bill_value,
          COALESCE(SUM(sub_credit_used), 0) AS total_sub_used,
          COALESCE(SUM(final_paid_amount), 0) AS total_paid
        FROM transactions
        WHERE created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      const rowsRes = await pool.query(`
        SELECT 
          t.id,
          t.transaction_number,
          t.created_at,
          t.total_bill_amount,
          t.sub_qty_covered_kg,
          t.sub_credit_used,
          t.extra_amount_payable,
          t.final_paid_amount,
          t.payment_method,
          t.status,
          c.name AS customer_name,
          w.name AS worker_name
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN workers w ON t.worker_id = w.id
        WHERE t.created_at >= $1 AND t.created_at <= $2
        ORDER BY t.created_at DESC
        LIMIT $3 OFFSET $4;
      `, [startDate, endDate, safeLimit, offset]);

      const countRes = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM transactions
        WHERE created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      return {
        type: 'sales',
        period: resolvedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          transaction_count: summaryRes.rows[0]?.transaction_count || 0,
          total_bill_value: parseFloat(summaryRes.rows[0]?.total_bill_value || 0),
          total_sub_used: parseFloat(summaryRes.rows[0]?.total_sub_used || 0),
          total_paid: parseFloat(summaryRes.rows[0]?.total_paid || 0),
        },
        pagination: {
          page: parseInt(page, 10),
          limit: safeLimit,
          total: countRes.rows[0]?.total || 0,
        },
        rows: rowsRes.rows.map(r => ({
          id: r.id,
          transaction_number: r.transaction_number,
          created_at: r.created_at,
          customer_name: r.customer_name || 'Walk-in / In-Store',
          worker_name: r.worker_name || 'Self-Service',
          total_bill_amount: parseFloat(r.total_bill_amount || 0),
          sub_qty_covered_kg: parseFloat(r.sub_qty_covered_kg || 0),
          sub_credit_used: parseFloat(r.sub_credit_used || 0),
          final_paid_amount: parseFloat(r.final_paid_amount || 0),
          payment_method: r.payment_method,
          status: r.status,
        })),
      };
    }

    case 'bookings': {
      const summaryRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS total_bookings,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'PENDING_COLLECTION' OR status = 'CONFIRMED')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
          COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
          COALESCE(SUM(total_amount), 0) AS total_booking_value
        FROM bookings
        WHERE created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      const rowsRes = await pool.query(`
        SELECT 
          b.id,
          b.booking_code,
          b.created_at,
          b.expires_at,
          b.total_amount,
          b.sub_credit_used,
          b.razorpay_paid,
          b.status,
          c.name AS customer_name,
          c.mobile_number AS customer_mobile
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.created_at >= $1 AND b.created_at <= $2
        ORDER BY b.created_at DESC
        LIMIT $3 OFFSET $4;
      `, [startDate, endDate, safeLimit, offset]);

      const countRes = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM bookings
        WHERE created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      return {
        type: 'bookings',
        period: resolvedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          total_bookings: summaryRes.rows[0]?.total_bookings || 0,
          completed: summaryRes.rows[0]?.completed || 0,
          pending: summaryRes.rows[0]?.pending || 0,
          cancelled: summaryRes.rows[0]?.cancelled || 0,
          expired: summaryRes.rows[0]?.expired || 0,
          total_booking_value: parseFloat(summaryRes.rows[0]?.total_booking_value || 0),
        },
        pagination: {
          page: parseInt(page, 10),
          limit: safeLimit,
          total: countRes.rows[0]?.total || 0,
        },
        rows: rowsRes.rows.map(r => ({
          id: r.id,
          booking_code: r.booking_code,
          created_at: r.created_at,
          expires_at: r.expires_at,
          customer_name: r.customer_name || 'Guest',
          customer_mobile: r.customer_mobile ? `***${r.customer_mobile.slice(-4)}` : 'N/A', // Privacy safe
          total_amount: parseFloat(r.total_amount || 0),
          sub_credit_used: parseFloat(r.sub_credit_used || 0),
          razorpay_paid: parseFloat(r.razorpay_paid || 0),
          status: r.status,
        })),
      };
    }

    case 'subscriptions': {
      const summaryRes = await pool.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM customer_subscriptions WHERE status = 'ACTIVE' AND expires_at > NOW()) AS active_count,
          (SELECT COUNT(*)::int FROM customer_subscriptions WHERE status = 'ACTIVE' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS expiring_soon,
          (SELECT COALESCE(SUM(credit_balance), 0) FROM customer_subscriptions WHERE status = 'ACTIVE') AS outstanding_credit,
          (SELECT COALESCE(SUM(p.price), 0) FROM customer_subscriptions cs JOIN subscription_plans p ON cs.plan_id = p.id WHERE cs.created_at >= $1 AND cs.created_at <= $2) AS subscription_sales
      `, [startDate, endDate]);

      const rowsRes = await pool.query(`
        SELECT 
          cs.id,
          cs.created_at,
          cs.starts_at,
          cs.expires_at,
          cs.credit_balance,
          cs.weekly_qty_used,
          cs.status,
          c.name AS customer_name,
          c.mobile_number AS customer_mobile,
          p.title AS plan_title,
          p.price AS plan_price
        FROM customer_subscriptions cs
        JOIN customers c ON cs.customer_id = c.id
        JOIN subscription_plans p ON cs.plan_id = p.id
        WHERE cs.created_at >= $1 AND cs.created_at <= $2
        ORDER BY cs.created_at DESC
        LIMIT $3 OFFSET $4;
      `, [startDate, endDate, safeLimit, offset]);

      const countRes = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM customer_subscriptions
        WHERE created_at >= $1 AND created_at <= $2;
      `, [startDate, endDate]);

      return {
        type: 'subscriptions',
        period: resolvedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          active_count: summaryRes.rows[0]?.active_count || 0,
          expiring_soon: summaryRes.rows[0]?.expiring_soon || 0,
          outstanding_credit: parseFloat(summaryRes.rows[0]?.outstanding_credit || 0),
          subscription_sales: parseFloat(summaryRes.rows[0]?.subscription_sales || 0),
        },
        pagination: {
          page: parseInt(page, 10),
          limit: safeLimit,
          total: countRes.rows[0]?.total || 0,
        },
        rows: rowsRes.rows.map(r => ({
          id: r.id,
          created_at: r.created_at,
          starts_at: r.starts_at,
          expires_at: r.expires_at,
          customer_name: r.customer_name,
          customer_mobile: r.customer_mobile ? `***${r.customer_mobile.slice(-4)}` : 'N/A',
          plan_title: r.plan_title,
          plan_price: parseFloat(r.plan_price || 0),
          credit_balance: parseFloat(r.credit_balance || 0),
          weekly_qty_used: parseFloat(r.weekly_qty_used || 0),
          status: r.status,
        })),
      };
    }

    case 'inventory': {
      const summaryRes = await pool.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM fish) AS total_fish,
          (SELECT COALESCE(SUM(physical_quantity), 0) FROM inventory) AS total_physical_kg,
          (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory) AS total_available_kg,
          (SELECT COALESCE(SUM(reserved_quantity), 0) FROM inventory) AS total_reserved_kg,
          (SELECT COUNT(*)::int FROM inventory WHERE available_quantity < 10) AS low_stock_count
      `);

      const rowsRes = await pool.query(`
        SELECT 
          f.id,
          f.name,
          f.unit_price,
          f.freshness_state,
          f.physical_available,
          f.online_bookable,
          COALESCE(i.physical_quantity, 0) AS physical_quantity,
          COALESCE(i.available_quantity, 0) AS available_quantity,
          COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
          f.updated_at
        FROM fish f
        LEFT JOIN inventory i ON f.id = i.fish_id
        ORDER BY f.name ASC
        LIMIT $1 OFFSET $2;
      `, [safeLimit, offset]);

      const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM fish;');

      return {
        type: 'inventory',
        period: resolvedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          total_fish: summaryRes.rows[0]?.total_fish || 0,
          total_physical_kg: parseFloat(summaryRes.rows[0]?.total_physical_kg || 0),
          total_available_kg: parseFloat(summaryRes.rows[0]?.total_available_kg || 0),
          total_reserved_kg: parseFloat(summaryRes.rows[0]?.total_reserved_kg || 0),
          low_stock_count: summaryRes.rows[0]?.low_stock_count || 0,
        },
        pagination: {
          page: parseInt(page, 10),
          limit: safeLimit,
          total: countRes.rows[0]?.total || 0,
        },
        rows: rowsRes.rows.map(r => ({
          id: r.id,
          name: r.name,
          unit_price: parseFloat(r.unit_price || 0),
          freshness_state: r.freshness_state,
          physical_available: r.physical_available,
          online_bookable: r.online_bookable,
          physical_quantity: parseFloat(r.physical_quantity || 0),
          available_quantity: parseFloat(r.available_quantity || 0),
          reserved_quantity: parseFloat(r.reserved_quantity || 0),
          updated_at: r.updated_at,
        })),
      };
    }

    case 'workers': {
      const summaryRes = await pool.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM workers WHERE active = true) AS active_workers,
          (SELECT COUNT(*)::int FROM transactions WHERE created_at >= $1 AND created_at <= $2) AS orders_handled,
          (SELECT COUNT(*)::int FROM bookings WHERE status = 'COMPLETED' AND updated_at >= $1 AND updated_at <= $2) AS completed_bookings
      `, [startDate, endDate]);

      const rowsRes = await pool.query(`
        SELECT 
          w.id,
          w.name,
          w.mobile_number,
          w.active,
          (SELECT COUNT(*)::int FROM transactions WHERE worker_id = w.id AND status = 'COMPLETED' AND created_at >= $1 AND created_at <= $2) AS orders_handled,
          (SELECT COUNT(*)::int FROM bookings WHERE status = 'COMPLETED' AND updated_at >= $1 AND updated_at <= $2) AS completed_bookings
        FROM workers w
        ORDER BY w.name ASC
        LIMIT $3 OFFSET $4;
      `, [startDate, endDate, safeLimit, offset]);

      const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM workers;');

      return {
        type: 'workers',
        period: resolvedPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          active_workers: summaryRes.rows[0]?.active_workers || 0,
          orders_handled: summaryRes.rows[0]?.orders_handled || 0,
          completed_bookings: summaryRes.rows[0]?.completed_bookings || 0,
        },
        pagination: {
          page: parseInt(page, 10),
          limit: safeLimit,
          total: countRes.rows[0]?.total || 0,
        },
        rows: rowsRes.rows.map(r => ({
          id: r.id,
          name: r.name,
          mobile_number: r.mobile_number ? `***${r.mobile_number.slice(-4)}` : 'N/A',
          active: r.active,
          orders_handled: r.orders_handled,
          completed_bookings: r.completed_bookings,
        })),
      };
    }

    default:
      throw new Error(`Unhandled report type: ${type}`);
  }
}

/**
 * Generate CSV representation of the report
 */
async function generateCsvExport({ type = 'revenue', period = 'this_month', from = null, to = null } = {}) {
  // Fetch up to 10,000 rows for complete export without small UI pagination limit
  const report = await generateReport({ type, period, from, to, page: 1, limit: 10000 });

  const lines = [];

  // UTF-8 BOM for Microsoft Excel compatibility
  lines.push(`\uFEFF# PondFish Operational & Financial Report`);
  lines.push(`# Report Type: ${type.toUpperCase()}`);
  lines.push(`# Period: ${report.period} (${report.startDate.split('T')[0]} to ${report.endDate.split('T')[0]})`);
  lines.push(`# Generated At: ${new Date().toISOString()}`);
  lines.push('');

  // Headers and Rows mapping
  let headers = [];
  let rowFormatter = (r) => [];

  switch (type) {
    case 'revenue':
      headers = ['Date', 'Transactions', 'Bill Value (INR)', 'Subscription Credit Used (INR)', 'Net Revenue (INR)'];
      rowFormatter = (r) => [r.date, r.transaction_count, r.bill_value, r.sub_used, r.revenue];
      break;
    case 'sales':
      headers = ['Transaction Number', 'Timestamp', 'Customer', 'Staff Handler', 'Total Bill (INR)', 'Sub Qty Covered (kg)', 'Sub Credit Used (INR)', 'Final Paid (INR)', 'Payment Method', 'Status'];
      rowFormatter = (r) => [r.transaction_number, r.created_at, r.customer_name, r.worker_name, r.total_bill_amount, r.sub_qty_covered_kg, r.sub_credit_used, r.final_paid_amount, r.payment_method, r.status];
      break;
    case 'bookings':
      headers = ['Booking Code', 'Created At', 'Expires At', 'Customer', 'Masked Mobile', 'Total Amount (INR)', 'Sub Credit Used (INR)', 'Paid Online (INR)', 'Status'];
      rowFormatter = (r) => [r.booking_code, r.created_at, r.expires_at, r.customer_name, r.customer_mobile, r.total_amount, r.sub_credit_used, r.razorpay_paid, r.status];
      break;
    case 'subscriptions':
      headers = ['Created At', 'Customer', 'Masked Mobile', 'Plan Title', 'Plan Price (INR)', 'Credit Balance (INR)', 'Weekly Qty Used (kg)', 'Status'];
      rowFormatter = (r) => [r.created_at, r.customer_name, r.customer_mobile, r.plan_title, r.plan_price, r.credit_balance, r.weekly_qty_used, r.status];
      break;
    case 'inventory':
      headers = ['Fish Name', 'Unit Price (INR/kg)', 'Freshness State', 'Physical Available', 'Online Bookable', 'Physical Qty (kg)', 'Available Qty (kg)', 'Reserved Qty (kg)', 'Last Updated'];
      rowFormatter = (r) => [r.name, r.unit_price, r.freshness_state, r.physical_available, r.online_bookable, r.physical_quantity, r.available_quantity, r.reserved_quantity, r.updated_at];
      break;
    case 'workers':
      headers = ['Staff Name', 'Masked Mobile', 'Active Status', 'Orders Handled', 'Completed Bookings'];
      rowFormatter = (r) => [r.name, r.mobile_number, r.active ? 'ACTIVE' : 'INACTIVE', r.orders_handled, r.completed_bookings];
      break;
  }

  // Header row
  lines.push(headers.map(sanitizeCsvCell).join(','));

  // Data rows
  for (const row of report.rows) {
    const values = rowFormatter(row);
    lines.push(values.map(sanitizeCsvCell).join(','));
  }

  return {
    csvContent: lines.join('\r\n'),
    filename: `pondfish_${type}_report_${new Date().toISOString().split('T')[0]}.csv`,
    rowCount: report.rows.length,
  };
}

module.exports = {
  name: 'ReportingEngine',
  ALLOWED_REPORT_TYPES,
  generateReport,
  generateCsvExport,
  sanitizeCsvCell,
};
