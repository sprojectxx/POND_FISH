'use client';

/**
 * AP-02: Executive Operations Dashboard
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 26–37)
 * Authoritative, server-aggregated overview of operations, inventory, bookings,
 * transactions, subscriptions, live truck GPS, freshness alerts, and worker activity.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MetricCard, StatusBadge } from '@/components/ui';
import { getAdminLoginUrl, isPortalSubdomain } from '@/lib/portal-routing';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const PERIOD_LABELS = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    this_month: 'This Month',
    all_time: 'All Time',
    custom: 'Custom Range',
  };

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
        const isSub = isPortalSubdomain('admin');
        const dest = isSub ? '/' : '/admin';
        window.location.href = getAdminLoginUrl(`redirect=${encodeURIComponent(dest)}`);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#0F2C59', letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
        </div>

        {/* Right-Aligned Dropdown Filter & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#0F2C59',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(15, 44, 89, 0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{PERIOD_LABELS[period] || 'Filter Period'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '220px',
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 10px 25px rgba(15, 44, 89, 0.12)',
                  zIndex: 50,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'all_time', label: 'All Time' },
                  { id: 'custom', label: 'Custom Range' },
                ].map((item) => {
                  const isSelected = period === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handlePeriodChange(item.id);
                        if (item.id !== 'custom') setDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: isSelected ? '#EFF6FF' : 'transparent',
                        color: isSelected ? '#1E56A0' : '#334155',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: isSelected ? '700' : '500',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <span>{item.label}</span>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}

                {period === 'custom' && (
                  <form
                    onSubmit={(e) => {
                      handleApplyCustom(e);
                      setDropdownOpen(false);
                    }}
                    style={{
                      marginTop: '6px',
                      paddingTop: '8px',
                      borderTop: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>From:</span>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        style={{
                          background: '#F8FAFC',
                          color: '#0F2C59',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>To:</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        style={{
                          background: '#F8FAFC',
                          color: '#0F2C59',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
                        background: '#1E56A0',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '7px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginTop: '2px',
                      }}
                    >
                      Apply Range
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => fetchMetrics(period, customFrom, customTo)}
            title="Refresh Metrics"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#1E56A0',
              cursor: 'pointer',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.04)',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: 'transform 0.3s ease',
                transform: loading ? 'rotate(180deg)' : 'none',
              }}
            >
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
          {/* SECTION 1: INVENTORY & STOCK - Unified Biomass & Freshness Hub */}
          <section style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 10px rgba(15, 44, 89, 0.04)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1E56A0',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                    Live Inventory &amp; Freshness
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Biomass reserves, catalog listing health, and quality alerts</span>
                </div>
              </div>

              {/* Biomass Breakdown Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 14px', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Total Biomass: </span>
                  <strong style={{ color: '#0F2C59', fontWeight: '800' }}>{metrics.inventory.total_physical_kg} kg</strong>
                </div>
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '6px 14px', fontSize: '12px' }}>
                  <span style={{ color: '#065F46' }}>Available: </span>
                  <strong style={{ color: '#047857', fontWeight: '800' }}>{metrics.inventory.total_available_kg} kg</strong>
                </div>
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '6px 14px', fontSize: '12px' }}>
                  <span style={{ color: '#92400E' }}>Reserved: </span>
                  <strong style={{ color: '#B45309', fontWeight: '800' }}>{metrics.inventory.total_reserved_kg} kg</strong>
                </div>
              </div>
            </div>

            {/* Content Hub: Left Coverage Hero + Right Status Matrix */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 340px) 1fr',
              gap: '20px',
            }}>
              {/* Left Hero Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0F2C59 0%, #1E56A0 100%)',
                borderRadius: '14px',
                padding: '24px',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(15, 44, 89, 0.16)',
              }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '700' }}>
                    Active Catalog Ratio
                  </span>
                  <div style={{ fontSize: '40px', fontWeight: '900', margin: '10px 0 2px', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {metrics.inventory.available_fish} <span style={{ fontSize: '20px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.6)' }}>/ {metrics.inventory.total_fish}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#93C5FD', fontWeight: '600', marginTop: '6px' }}>
                    Varieties Listed &amp; Live for Booking
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px', fontWeight: '600' }}>
                    <span>Live Availability</span>
                    <span>{metrics.inventory.total_fish > 0 ? Math.round((metrics.inventory.available_fish / metrics.inventory.total_fish) * 100) : 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${metrics.inventory.total_fish > 0 ? (metrics.inventory.available_fish / metrics.inventory.total_fish) * 100 : 0}%`,
                      height: '100%',
                      background: '#38BDF8',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              </div>

              {/* Right Status Matrix: 4 Sleek Status Quadrants */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {/* Tile 1: Unavailable */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unavailable</span>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: metrics.inventory.unavailable_fish > 0 ? '#EF4444' : '#10B981',
                    }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: metrics.inventory.unavailable_fish > 0 ? '#DC2626' : '#0F2C59', margin: '8px 0 2px' }}>
                    {metrics.inventory.unavailable_fish}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Hidden from public app
                  </div>
                </div>

                {/* Tile 2: Low Stock */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Low Stock (&lt;10kg)</span>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: metrics.inventory.low_stock > 0 ? '#F59E0B' : '#10B981',
                    }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: metrics.inventory.low_stock > 0 ? '#D97706' : '#0F2C59', margin: '8px 0 2px' }}>
                    {metrics.inventory.low_stock}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    {metrics.inventory.low_stock > 0 ? 'Requires replenishment' : 'All species adequately stocked'}
                  </div>
                </div>

                {/* Tile 3: Aging Fish */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aging Batch (Grey)</span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748B' }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#475569', margin: '8px 0 2px' }}>
                    {metrics.inventory.aging_fish}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Approaching freshness cutoff
                  </div>
                </div>

                {/* Tile 4: Expired Fish */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expired Batch (Red)</span>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: metrics.inventory.expired_fish > 0 ? '#EF4444' : '#10B981',
                    }} />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: metrics.inventory.expired_fish > 0 ? '#DC2626' : '#16A34A', margin: '8px 0 2px' }}>
                    {metrics.inventory.expired_fish}
                  </div>
                  <div style={{ fontSize: '11px', color: metrics.inventory.expired_fish > 0 ? '#DC2626' : '#16A34A', fontWeight: '600' }}>
                    {metrics.inventory.expired_fish > 0 ? 'Action required: Remove stock' : 'Optimal freshness preserved'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: BOOKINGS PIPELINE - Connected Funnel Pipeline */}
          <section style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 10px rgba(15, 44, 89, 0.04)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1E56A0',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                    Customer Bookings Pipeline
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Real-time order reservation, preparation, and collection flow</span>
                </div>
              </div>

              {/* Exception Counters in Header */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '6px 12px', fontSize: '12px' }}>
                  <span style={{ color: '#991B1B' }}>Cancelled: </span>
                  <strong style={{ color: '#DC2626' }}>{metrics.bookings.cancelled}</strong>
                </div>
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '6px 12px', fontSize: '12px' }}>
                  <span style={{ color: '#92400E' }}>Expired (48h): </span>
                  <strong style={{ color: '#B45309' }}>{metrics.bookings.expired}</strong>
                </div>
              </div>
            </div>

            {/* Connected Funnel Stages */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto 1fr',
              alignItems: 'center',
              gap: '12px',
            }}>
              {/* Stage 1: Received */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1E56A0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stage 1: Placed
                </span>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#0F2C59', margin: '8px 0 4px' }}>
                  {metrics.bookings.period_bookings}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Total Period Orders
                </div>
              </div>

              {/* Connector Chevron */}
              <div style={{ color: '#CBD5E1', display: 'flex', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>

              {/* Stage 2: Pending Collection */}
              <div style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stage 2: Store Pickup
                </span>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#92400E', margin: '8px 0 4px' }}>
                  {metrics.bookings.pending_collection}
                </div>
                <div style={{ fontSize: '12px', color: '#B45309' }}>
                  Awaiting Collection
                </div>
              </div>

              {/* Connector Chevron */}
              <div style={{ color: '#CBD5E1', display: 'flex', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>

              {/* Stage 3: Completed */}
              <div style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stage 3: Completed
                </span>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#065F46', margin: '8px 0 4px' }}>
                  {metrics.bookings.completed}
                </div>
                <div style={{ fontSize: '12px', color: '#047857' }}>
                  Fulfilled &amp; Collected
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: COMMERCIAL & TRANSACTIONS - Financial Console */}
          <section style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 10px rgba(15, 44, 89, 0.04)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1E56A0',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                    Transactions &amp; Commercial Sales
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Revenue collection, billing reconciliations, and payment channels</span>
                </div>
              </div>

              {/* Payment Method Badges */}
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
                {metrics.transactions.payment_methods.map((pm) => (
                  <span key={pm.payment_method} style={{ background: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', color: '#334155', fontWeight: '600' }}>
                    <span style={{ color: '#1E56A0', fontWeight: '800' }}>{pm.payment_method}</span>: {pm.count} ({formatCurrency(pm.total_amount)})
                  </span>
                ))}
              </div>
            </div>

            {/* Split Commercial Layout: Left Revenue Summary + Right Transaction Performance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '20px' }}>
              {/* Left Revenue Card */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '14px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', fontWeight: '700' }}>
                    Net Collected Revenue
                  </span>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: '#0F2C59', margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
                    {formatCurrency(metrics.transactions.final_paid_amount)}
                  </div>
                  <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '700' }}>
                    Direct Cash + UPI Settlements
                  </span>
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Gross Bill Value:</span>
                    <strong style={{ color: '#0F2C59' }}>{formatCurrency(metrics.transactions.total_bill_value)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Wallet Credit Used:</span>
                    <strong style={{ color: '#1E56A0' }}>{formatCurrency(metrics.transactions.sub_credit_used)}</strong>
                  </div>
                </div>
              </div>

              {/* Right Performance Stats: 3 Broad Metric Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Volume</div>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: '#0F2C59', margin: '8px 0 4px' }}>
                    {metrics.transactions.total_transactions}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Total Transactions</span>
                </div>

                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#047857', fontWeight: '700', textTransform: 'uppercase' }}>Successful</div>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: '#065F46', margin: '8px 0 4px' }}>
                    {metrics.transactions.successful}
                  </div>
                  <span style={{ fontSize: '12px', color: '#047857' }}>Settled / Finalized</span>
                </div>

                <div style={{ background: metrics.transactions.failed > 0 ? '#FEF2F2' : '#F8FAFC', border: metrics.transactions.failed > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: metrics.transactions.failed > 0 ? '#DC2626' : '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Failed / Aborted</div>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: metrics.transactions.failed > 0 ? '#DC2626' : '#0F2C59', margin: '8px 0 4px' }}>
                    {metrics.transactions.failed}
                  </div>
                  <span style={{ fontSize: '12px', color: metrics.transactions.failed > 0 ? '#DC2626' : '#64748B' }}>
                    {metrics.transactions.failed > 0 ? 'Exceptions recorded' : 'Zero failures'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: SUBSCRIPTIONS & TRUCK LOGISTICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Subscriptions Integrated Console */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                    <path d="M13 5v2M13 17v2M13 11v2" />
                  </svg>
                  <span>Subscription Accounts</span>
                </h3>
                <a href="/admin/subscriptions" style={{ fontSize: '12px', fontWeight: '700', color: '#1E56A0', textDecoration: 'none' }}>
                  Manage Plans →
                </a>
              </div>

              {/* Top Membership Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F2C59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F2C59' }}>{metrics.subscriptions.active_subscriptions}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Active Members</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: metrics.subscriptions.expiring_soon > 0 ? '#FEF2F2' : '#F1F5F9',
                    color: metrics.subscriptions.expiring_soon > 0 ? '#DC2626' : '#64748B',
                    border: metrics.subscriptions.expiring_soon > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0'
                  }}>
                    {metrics.subscriptions.expiring_soon > 0 ? `${metrics.subscriptions.expiring_soon} Expiring Soon` : '0 Expiring (7d)'}
                  </span>
                </div>
              </div>

              {/* Two Financial Pillars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#0369A1', fontWeight: '700', textTransform: 'uppercase' }}>Outstanding Credit</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#0C4A6E', margin: '4px 0 2px' }}>
                    {formatCurrency(metrics.subscriptions.outstanding_credit)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#0284C7' }}>Member wallet balance</div>
                </div>

                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700', textTransform: 'uppercase' }}>Plan Sales Revenue</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#065F46', margin: '4px 0 2px' }}>
                    {formatCurrency(metrics.subscriptions.subscription_sales)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669' }}>Total tier purchases</div>
                </div>
              </div>
            </div>

            {/* Truck Card */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  <span>Logistics &amp; Live Truck</span>
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
                      View Live Map &amp; Telemetry →
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
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
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

            {/* Worker Summary Integrated Module */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Active Store Workers</span>
                </h3>
                <a href="/admin/staff" style={{ fontSize: '12px', fontWeight: '700', color: '#1E56A0', textDecoration: 'none' }}>
                  View Staff →
                </a>
              </div>

              {/* Workers Live Status Card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F2C59' }}>{metrics.workers.active_workers}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Active Staff On Duty</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 10px', borderRadius: '20px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#065F46' }}>Store Operational</span>
                </div>
              </div>

              {/* Operations Handled Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Orders Handled</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F2C59', margin: '4px 0 2px' }}>
                    {metrics.workers.orders_handled}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>POS / Counter Bills</div>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Bookings Done</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F2C59', margin: '4px 0 2px' }}>
                    {metrics.workers.completed_bookings}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Pickups Completed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
