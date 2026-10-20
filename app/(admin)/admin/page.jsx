'use client';

/**
 * AP-02: Executive Operations Dashboard
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 26–37)
 * Authoritative, server-aggregated overview of operations, inventory, bookings,
 * transactions, subscriptions, live truck GPS, freshness alerts, and worker activity.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MetricCard, StatusBadge } from '@/components/ui';

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

      const res = await fetch(url);

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin';
        return;
      }

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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 6px 0', color: '#0F2C59', letterSpacing: '-0.02em' }}>
            Executive Operations Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            Authoritative operational health, commercial reconciliation, and live logistics overview.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="pf-admin-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 10px', borderRadius: '10px', border: '1px solid #CBD5E1', boxShadow: '0 2px 6px rgba(15, 44, 89, 0.04)' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'all_time', label: 'All Time' },
            { id: 'custom', label: 'Custom' },
          ].map((item) => {
            const isActive = period === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handlePeriodChange(item.id)}
                style={{
                  background: isActive ? '#1E56A0' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            );
          })}

          {period === 'custom' && (
            <form onSubmit={handleApplyCustom} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  background: '#F8FAFC',
                  color: '#0F2C59',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '12px',
                }}
              />
              <span style={{ color: '#64748B', fontSize: '12px' }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  background: '#F8FAFC',
                  color: '#0F2C59',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '12px',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#1E56A0',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
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
              color: '#1E56A0',
              cursor: 'pointer',
              padding: '6px',
              fontSize: '14px',
              marginLeft: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '10px', padding: '14px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: '700', color: '#DC2626' }}>Unable to load dashboard section: </span>
            <span style={{ color: '#DC2626' }}>{error}</span>
          </div>
          <button
            onClick={() => fetchMetrics(period, customFrom, customTo)}
            style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[...Array(8)].map((_, i) => (
            <MetricCard key={i} title="Loading..." value="" loading={true} />
          ))}
        </div>
      )}

      {metrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* SECTION 1: INVENTORY & STOCK */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <span>Live Inventory & Freshness</span>
              </h2>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                Total Physical: {metrics.inventory.total_physical_kg} kg • Available: {metrics.inventory.total_available_kg} kg • Reserved: {metrics.inventory.total_reserved_kg} kg
              </span>
            </div>
            <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <MetricCard title="Total Fish Listed" value={metrics.inventory.total_fish} variant="primary" />
              <MetricCard title="Available Fish" value={metrics.inventory.available_fish} variant="success" />
              <MetricCard title="Unavailable Fish" value={metrics.inventory.unavailable_fish} variant={metrics.inventory.unavailable_fish > 0 ? 'danger' : 'default'} />
              <MetricCard title="Low Stock (<10kg)" value={metrics.inventory.low_stock} variant={metrics.inventory.low_stock > 0 ? 'warning' : 'success'} />
              <MetricCard title="Aging Fish (Grey)" value={metrics.inventory.aging_fish} variant="default" />
              <MetricCard title="Expired Fish (Red)" value={metrics.inventory.expired_fish} variant={metrics.inventory.expired_fish > 0 ? 'danger' : 'success'} />
            </div>
          </section>

          {/* SECTION 2: BOOKINGS PIPELINE */}
          <section>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>Customer Bookings Pipeline</span>
            </h2>
            <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <MetricCard title="Period Bookings" value={metrics.bookings.period_bookings} variant="primary" />
              <MetricCard title="Pending Collection" value={metrics.bookings.pending_collection} variant="info" />
              <MetricCard title="Completed" value={metrics.bookings.completed} variant="success" />
              <MetricCard title="Cancelled" value={metrics.bookings.cancelled} variant="danger" />
              <MetricCard title="Expired (48h Expiry)" value={metrics.bookings.expired} variant="warning" />
            </div>
          </section>

          {/* SECTION 3: COMMERCIAL & TRANSACTIONS */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span>Transactions & Commercial Sales</span>
              </h2>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
                {metrics.transactions.payment_methods.map((pm) => (
                  <span key={pm.payment_method} style={{ background: '#FFFFFF', padding: '4px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#425B73', fontWeight: '600' }}>
                    {pm.payment_method}: {pm.count} ({formatCurrency(pm.total_amount)})
                  </span>
                ))}
              </div>
            </div>
            <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <MetricCard title="Total Transactions" value={metrics.transactions.total_transactions} variant="primary" />
              <MetricCard title="Successful / Finalized" value={metrics.transactions.successful} variant="success" />
              <MetricCard title="Failed / Aborted" value={metrics.transactions.failed} variant={metrics.transactions.failed > 0 ? 'danger' : 'default'} />
              <MetricCard title="Total Bill Value" value={formatCurrency(metrics.transactions.total_bill_value)} variant="info" />
              <MetricCard title="Subscription Used" value={formatCurrency(metrics.transactions.sub_credit_used)} variant="default" />
              <MetricCard title="Final Paid (Cash + UPI)" value={formatCurrency(metrics.transactions.final_paid_amount)} variant="success" />
            </div>
          </section>

          {/* SECTION 4: SUBSCRIPTIONS & TRUCK LOGISTICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Subscriptions Card Group */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  <path d="M13 5v2M13 17v2M13 11v2" />
                </svg>
                <span>Subscription Accounts</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <MetricCard title="Active Members" value={metrics.subscriptions.active_subscriptions} variant="primary" />
                <MetricCard title="Expiring Soon (7d)" value={metrics.subscriptions.expiring_soon} variant={metrics.subscriptions.expiring_soon > 0 ? 'warning' : 'default'} />
                <MetricCard title="Outstanding Credit" value={formatCurrency(metrics.subscriptions.outstanding_credit)} variant="info" />
                <MetricCard title="Plan Sales Revenue" value={formatCurrency(metrics.subscriptions.subscription_sales)} variant="success" />
              </div>
            </div>

            {/* Truck Card */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  <span>Logistics & Live Truck</span>
                </h3>
                <StatusBadge status={metrics.truck.status === 'LIVE' ? 'ACTIVE' : metrics.truck.status} label={metrics.truck.status} />
              </div>
              {metrics.truck.status !== 'IDLE' && metrics.truck.truck_number ? (
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Truck / Driver:</span>
                    <span style={{ fontWeight: '700', color: '#0F2C59' }}>{metrics.truck.truck_number} ({metrics.truck.driver_name})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B' }}>Customer Tracking:</span>
                    <StatusBadge
                      status={metrics.truck.published_to_customer ? 'ACTIVE' : 'EXPIRED'}
                      label={metrics.truck.published_to_customer ? 'Published Live' : 'Internal Only'}
                      size="sm"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Destination:</span>
                    <span style={{ color: '#0F2C59' }}>{metrics.truck.destination?.name || 'Store Destination'}</span>
                  </div>
                  {metrics.truck.latest_position && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Latest Telemetry:</span>
                      <span style={{ color: '#0F2C59' }}>
                        {metrics.truck.latest_position.speed} km/h (Ping: {new Date(metrics.truck.latest_position.last_ping_at).toLocaleTimeString()})
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: '8px' }}>
                    <a href="/admin/journeys" style={{ color: '#1E56A0', textDecoration: 'none', fontSize: '13px', fontWeight: '700' }}>
                      View Live Map & Telemetry →
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                  No active delivery journey in progress.
                  <div style={{ marginTop: '10px' }}>
                    <a href="/admin/journeys" style={{ color: '#1E56A0', textDecoration: 'none', fontWeight: '700' }}>
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
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Freshness State Alerts</span>
              </h3>
              {metrics.freshness_alerts.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
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
                        background: '#F8FAFC',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F2C59' }}>{alert.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>₹{alert.unit_price}/kg</div>
                      </div>
                      <StatusBadge
                        status={alert.freshness_state === 'RED' ? 'CRITICAL' : alert.freshness_state === 'YELLOW' ? 'WARNING' : alert.freshness_state === 'GREY' ? 'EXPIRED' : 'FRESH'}
                        label={alert.freshness_state}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Worker Summary Card */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Active Store Workers</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <MetricCard title="Active Staff" value={metrics.workers.active_workers} variant="primary" />
                <MetricCard title="Orders Handled" value={metrics.workers.orders_handled} variant="info" />
                <MetricCard title="Bookings Done" value={metrics.workers.completed_bookings} variant="success" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
