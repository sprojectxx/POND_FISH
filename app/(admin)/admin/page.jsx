'use client';

/**
 * AP-02: Executive Operations Dashboard
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 26–37)
 * Authoritative, server-aggregated overview of operations, inventory, bookings,
 * transactions, subscriptions, live truck GPS, freshness alerts, and worker activity.
 */

import React, { useState, useEffect, useCallback } from 'react';

const ADMIN_SECRET = 'pondfish-admin-key-2026';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async (selectedPeriod, fromVal, toVal) => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/v1/admin/dashboard?period=${encodeURIComponent(selectedPeriod)}`;
      if (selectedPeriod === 'custom') {
        if (fromVal) url += `&from=${encodeURIComponent(fromVal)}`;
        if (toVal) url += `&to=${encodeURIComponent(toVal)}`;
      }

      const res = await fetch(url, {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to load dashboard metrics');
      }

      setMetrics(json.data);
    } catch (err) {
      console.error('[Dashboard Error]:', err);
      setError(err.message || 'Unable to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(period, customFrom, customTo);
  }, [period, fetchMetrics]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (period === 'custom') {
      fetchMetrics('custom', customFrom, customTo);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFreshnessColor = (state) => {
    switch (state) {
      case 'GREEN': return '#22C55E';
      case 'YELLOW': return '#EAB308';
      case 'GREY': return '#94A3B8';
      case 'RED': return '#EF4444';
      default: return '#64748B';
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#F8FAFC' }}>
            Executive Operations Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>
            Authoritative operational health, commercial reconciliation, and live logistics overview.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1E293B', padding: '6px 10px', borderRadius: '8px', border: '1px solid #334155', flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'custom', label: 'Custom' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => handlePeriodChange(btn.id)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: period === btn.id ? '600' : '400',
                background: period === btn.id ? '#38BDF8' : 'transparent',
                color: period === btn.id ? '#0B1120' : '#94A3B8',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {btn.label}
            </button>
          ))}

          {period === 'custom' && (
            <form onSubmit={handleApplyCustom} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  background: '#0B1120',
                  color: '#F8FAFC',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                }}
              />
              <span style={{ color: '#64748B', fontSize: '12px' }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  background: '#0B1120',
                  color: '#F8FAFC',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#38BDF8',
                  color: '#0B1120',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </form>
          )}

          <button
            onClick={() => fetchMetrics(period, customFrom, customTo)}
            title="Refresh Metrics"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38BDF8',
              cursor: 'pointer',
              padding: '6px',
              fontSize: '14px',
              marginLeft: '4px',
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #DC2626', borderRadius: '8px', padding: '14px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: '600', color: '#FEE2E2' }}>Unable to load dashboard section: </span>
            <span style={{ color: '#FECACA' }}>{error}</span>
          </div>
          <button
            onClick={() => fetchMetrics(period, customFrom, customTo)}
            style={{ background: '#EF4444', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155', animation: 'pulse 1.5s infinite' }}>
              <div style={{ height: '14px', background: '#334155', borderRadius: '4px', width: '60%', marginBottom: '12px' }}></div>
              <div style={{ height: '28px', background: '#334155', borderRadius: '4px', width: '40%' }}></div>
            </div>
          ))}
        </div>
      )}

      {metrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* SECTION 1: INVENTORY & STOCK */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: 0 }}>
                🐟 Live Inventory & Freshness
              </h2>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                Total Physical: {metrics.inventory.total_physical_kg} kg | Available: {metrics.inventory.total_available_kg} kg | Reserved: {metrics.inventory.total_reserved_kg} kg
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Total Fish Listed</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>{metrics.inventory.total_fish}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Available Fish</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>{metrics.inventory.available_fish}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Unavailable Fish</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F87171' }}>{metrics.inventory.unavailable_fish}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Low Stock (&lt;10kg)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: metrics.inventory.low_stock > 0 ? '#EAB308' : '#22C55E' }}>
                  {metrics.inventory.low_stock}
                </div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Aging Fish (Grey)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#94A3B8' }}>{metrics.inventory.aging_fish}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Expired Fish (Red)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: metrics.inventory.expired_fish > 0 ? '#EF4444' : '#22C55E' }}>
                  {metrics.inventory.expired_fish}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: BOOKINGS PIPELINE */}
          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', marginBottom: '16px' }}>
              📦 Customer Bookings Pipeline
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Period Bookings</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>{metrics.bookings.period_bookings}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Pending Collection</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38BDF8' }}>{metrics.bookings.pending_collection}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Completed</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>{metrics.bookings.completed}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Cancelled</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F87171' }}>{metrics.bookings.cancelled}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Expired (48h Expiry)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FACC15' }}>{metrics.bookings.expired}</div>
              </div>
            </div>
          </section>

          {/* SECTION 3: COMMERCIAL & TRANSACTIONS */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: 0 }}>
                💰 Transactions & Commercial Sales
              </h2>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                {metrics.transactions.payment_methods.map((pm) => (
                  <span key={pm.payment_method} style={{ background: '#0F172A', padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155' }}>
                    {pm.payment_method}: {pm.count} ({formatCurrency(pm.total_amount)})
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Total Transactions</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>{metrics.transactions.total_transactions}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Successful / Finalized</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>{metrics.transactions.successful}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Failed / Aborted</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: metrics.transactions.failed > 0 ? '#EF4444' : '#94A3B8' }}>
                  {metrics.transactions.failed}
                </div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Total Bill Value</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38BDF8' }}>{formatCurrency(metrics.transactions.total_bill_value)}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Subscription Value Used</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#C084FC' }}>{formatCurrency(metrics.transactions.sub_credit_used)}</div>
              </div>
              <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>Final Paid (Cash + Razorpay)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ADE80' }}>{formatCurrency(metrics.transactions.final_paid_amount)}</div>
              </div>
            </div>
          </section>

          {/* SECTION 4: SUBSCRIPTIONS & TRUCK LOGISTICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Subscriptions Card Group */}
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#38BDF8', margin: '0 0 16px 0' }}>
                🎟️ Subscription Accounts
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Active Members</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#F8FAFC' }}>{metrics.subscriptions.active_subscriptions}</div>
                </div>
                <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Expiring Soon (7d)</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#FACC15' }}>{metrics.subscriptions.expiring_soon}</div>
                </div>
                <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Outstanding Credit</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8' }}>{formatCurrency(metrics.subscriptions.outstanding_credit)}</div>
                </div>
                <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Plan Sales Revenue</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22C55E' }}>{formatCurrency(metrics.subscriptions.subscription_sales)}</div>
                </div>
              </div>
            </div>

            {/* Truck Card */}
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#38BDF8', margin: 0 }}>
                  🚛 Logistics & Live Truck
                </h3>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: metrics.truck.status === 'LIVE' ? '#14532D' : '#334155',
                    color: metrics.truck.status === 'LIVE' ? '#4ADE80' : '#94A3B8',
                  }}
                >
                  {metrics.truck.status}
                </span>
              </div>
              {metrics.truck.status !== 'IDLE' && metrics.truck.truck_number ? (
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Truck / Driver:</span>
                    <span style={{ fontWeight: '500' }}>{metrics.truck.truck_number} ({metrics.truck.driver_name})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Customer Tracking:</span>
                    <span style={{ color: metrics.truck.published_to_customer ? '#22C55E' : '#94A3B8' }}>
                      {metrics.truck.published_to_customer ? 'Published Live' : 'Internal Only'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Destination:</span>
                    <span>{metrics.truck.destination?.name || 'Store Destination'}</span>
                  </div>
                  {metrics.truck.latest_position && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Latest Telemetry:</span>
                      <span>
                        {metrics.truck.latest_position.speed} km/h (Ping: {new Date(metrics.truck.latest_position.last_ping_at).toLocaleTimeString()})
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: '6px' }}>
                    <a href="/admin/journeys" style={{ color: '#38BDF8', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>
                      View Live Map & Telemetry →
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No active delivery journey in progress.
                  <div style={{ marginTop: '8px' }}>
                    <a href="/admin/journeys" style={{ color: '#38BDF8', textDecoration: 'none', fontWeight: '600' }}>
                      Create / Dispatch Journey →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5: FRESHNESS ALERTS & WORKER SUMMARY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Freshness Alerts Card */}
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#38BDF8', margin: '0 0 14px 0' }}>
                ⚠️ Freshness State Alerts
              </h3>
              {metrics.freshness_alerts.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No operational alerts. All listed fish are within fresh parameters.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {metrics.freshness_alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#0F172A',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        borderLeft: `4px solid ${getFreshnessColor(alert.freshness_state)}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#F8FAFC' }}>{alert.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>₹{alert.unit_price}/kg</div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: `${getFreshnessColor(alert.freshness_state)}22`,
                          color: getFreshnessColor(alert.freshness_state),
                        }}
                      >
                        {alert.freshness_state}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Worker Summary Card */}
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#38BDF8', margin: '0 0 14px 0' }}>
                👷 Active Store Workers
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ background: '#0F172A', padding: '14px 10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Active Staff</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{metrics.workers.active_workers}</div>
                </div>
                <div style={{ background: '#0F172A', padding: '14px 10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Orders Handled</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{metrics.workers.orders_handled}</div>
                </div>
                <div style={{ background: '#0F172A', padding: '14px 10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Bookings Done</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{metrics.workers.completed_bookings}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
