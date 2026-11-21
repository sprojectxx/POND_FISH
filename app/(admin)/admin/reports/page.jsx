'use client';

/**
 * AP-18: Reports & Commercial Exports
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 152–163)
 * Financial reconciliation, inventory audit, booking summaries, and spreadsheet-safe CSV exports.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminSubNav, AdminPagination, AdminTableSkeleton } from '@/components/ui';

const REPORT_TABS = [
  { id: 'revenue', label: 'Revenue Report' },
  { id: 'sales', label: 'Sales & Transactions' },
  { id: 'bookings', label: 'Customer Bookings' },
  { id: 'subscriptions', label: 'Subscription Ledger' },
  { id: 'inventory', label: 'Inventory & Freshness' },
  { id: 'workers', label: 'Worker Operations' },
];

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async (tab, selectedPeriod, fromVal, toVal, pageNum, limitVal = 25) => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/v1/admin/reports?type=${tab}&period=${selectedPeriod}&page=${pageNum}&limit=${limitVal || 25}`;
      if (selectedPeriod === 'custom') {
        if (fromVal) url += `&from=${encodeURIComponent(fromVal)}`;
        if (toVal) url += `&to=${encodeURIComponent(toVal)}`;
      }

      const res = await fetch(url);

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/reports';
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to generate report');
      }

      setReportData(json.data);
    } catch (err) {
      console.error('[Reports Error]:', err);
      setError(err.message || 'Unable to generate report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(activeTab, period, customFrom, customTo, page, limit);
  }, [activeTab, period, page, limit, fetchReport]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setPage(1);
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setPage(1);
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (period === 'custom') {
      setPage(1);
      fetchReport(activeTab, 'custom', customFrom, customTo, 1, limit);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      let url = `/api/v1/admin/reports/export?type=${activeTab}&period=${period}`;
      if (period === 'custom') {
        if (customFrom) url += `&from=${encodeURIComponent(customFrom)}`;
        if (customTo) url += `&to=${encodeURIComponent(customTo)}`;
      }

      const res = await fetch(url);

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/reports';
        return;
      }

      if (!res.ok) {
        throw new Error('Export request failed.');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `pondfish_${activeTab}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`Export Error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Store Operations', href: '/admin/settings', exact: true },
          { label: 'Reports & Exports', href: '/admin/reports' },
          { label: 'Activity Log', href: '/admin/audit' },
          { label: 'Order Alerts', href: '/admin/exceptions' },
          { label: 'Security & Passwords', href: '/admin/security' },
          { label: 'My Profile', href: '/admin/profile' },
        ]}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Reports &amp; Commercial Exports
          </h1>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => fetchReport(activeTab, period, customFrom, customTo, page, limit)}
            disabled={loading}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#0F2C59',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              className={loading ? 'pf-animate-spin' : ''}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            style={{
              background: '#1E56A0',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              height: '38px',
              padding: '0 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: exporting ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{exporting ? 'Preparing download...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Report Module Tabs */}
      <div style={{ display: 'inline-flex', padding: '4px', background: '#F1F5F9', borderRadius: '12px', border: '1px solid #E2E8F0', gap: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {REPORT_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: active ? '#1E56A0' : 'transparent',
                color: active ? '#FFFFFF' : '#64748B',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Date Period Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginRight: '6px' }}>
          Timeframe:
        </div>
        <div style={{ display: 'inline-flex', padding: '3px', background: '#F1F5F9', borderRadius: '8px', gap: '3px' }}>
          {[
            { id: 'today', label: 'Daily (Today)' },
            { id: 'this_week', label: 'Weekly (7d)' },
            { id: 'this_month', label: 'Monthly' },
            { id: 'custom', label: 'Custom Range' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => handlePeriodChange(btn.id)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                background: period === btn.id ? '#1E56A0' : 'transparent',
                color: period === btn.id ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <form onSubmit={handleApplyCustom} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ background: '#F8FAFC', color: '#0F2C59', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', outline: 'none' }}
            />
            <span style={{ color: '#64748B', fontSize: '12px', fontWeight: '600' }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ background: '#F8FAFC', color: '#0F2C59', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', outline: 'none' }}
            />
            <button
              type="submit"
              style={{ background: '#1E56A0', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              Apply
            </button>
          </form>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#991B1B', fontSize: '13px', fontWeight: '600' }}>
          <span>{error}</span>
          <button onClick={() => fetchReport(activeTab, period, customFrom, customTo, page, limit)} style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>
            Retry
          </button>
        </div>
      )}

      {/* Report Content */}
      {reportData && (
        <div>
          {/* Summary Metric Cards */}
          <div
            className="pf-admin-metrics-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}
          >
            {activeTab === 'revenue' && (
              <>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Net Revenue</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{formatCurrency(reportData.summary.total_revenue)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Bill Value</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{formatCurrency(reportData.summary.total_bill_value)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Sub Credit Used</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#4338CA', marginTop: '6px' }}>{formatCurrency(reportData.summary.total_sub_credit_used)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Transactions</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{reportData.summary.transaction_count}</div>
                </div>
              </>
            )}

            {activeTab === 'sales' && (
              <>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Bill Value</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{formatCurrency(reportData.summary.total_bill_value)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Subscription Credit Used</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#4338CA', marginTop: '6px' }}>{formatCurrency(reportData.summary.total_sub_used)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Final Paid Amount</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{formatCurrency(reportData.summary.total_paid)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Transaction Count</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{reportData.summary.transaction_count}</div>
                </div>
              </>
            )}

            {activeTab === 'bookings' && (
              <>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Bookings</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{reportData.summary.total_bookings}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Completed</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{reportData.summary.completed}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Pending Fulfillment</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{reportData.summary.pending}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Expired (48h)</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#D97706', marginTop: '6px' }}>{reportData.summary.expired}</div>
                </div>
              </>
            )}

            {activeTab === 'subscriptions' && (
              <>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Active Members</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{reportData.summary.active_count}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Expiring Soon (7d)</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#D97706', marginTop: '6px' }}>{reportData.summary.expiring_soon}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Outstanding Credit</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{formatCurrency(reportData.summary.outstanding_credit)}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Plan Sales Revenue</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{formatCurrency(reportData.summary.subscription_sales)}</div>
                </div>
              </>
            )}

            {activeTab === 'inventory' && (
              <>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Fish Listed</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{reportData.summary.total_fish}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Physical Stock</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{reportData.summary.total_physical_kg} kg</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Available Stock</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{reportData.summary.total_available_kg} kg</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Low Stock (&lt;10kg)</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: reportData.summary.low_stock_count > 0 ? '#DC2626' : '#059669', marginTop: '6px' }}>{reportData.summary.low_stock_count}</div>
                </div>
              </>
            )}

            {activeTab === 'workers' && (
              <>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Active Staff</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{reportData.summary.active_workers}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Orders Handled</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{reportData.summary.orders_handled}</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Completed Bookings</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{reportData.summary.completed_bookings}</div>
                </div>
              </>
            )}
          </div>

          {/* Table Section */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'visible', position: 'relative', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
            {/* Subtle Top Loading Line */}
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: '#E2E8F0',
                  overflow: 'hidden',
                  zIndex: 10,
                  borderTopLeftRadius: '16px',
                  borderTopRightRadius: '16px',
                }}
              >
                <div
                  className="pf-animate-indeterminate"
                  style={{
                    width: '45%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            )}

            <div style={{ overflowX: 'auto', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                    {activeTab === 'revenue' && (
                      <>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Transactions</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bill Value</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sub Credit Used</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Revenue</th>
                      </>
                    )}
                    {activeTab === 'sales' && (
                      <>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tx Number</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date/Time</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bill Total</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sub Covered</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid Amount</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Method</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                      </>
                    )}
                    {activeTab === 'bookings' && (
                      <>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Booking Code</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created At</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expires At</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credit Used</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid Online</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                      </>
                    )}
                    {activeTab === 'subscriptions' && (
                      <>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plan</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credit Balance</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weekly Qty</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                      </>
                    )}
                    {activeTab === 'inventory' && (
                      <>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fish Name</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price/kg</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Freshness</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Physical (kg)</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available (kg)</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reserved (kg)</th>
                      </>
                    )}
                    {activeTab === 'workers' && (
                      <>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff Name</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contact</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Orders Handled</th>
                        <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed Bookings</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <AdminTableSkeleton columns={5} rows={5} />
                  ) : reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                        <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600' }}>No report data for the selected period.</p>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try selecting a broader date range above.</span>
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((r, i) => (
                      <tr
                        key={r.id || r.date || i}
                        style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {activeTab === 'revenue' && (
                          <>
                            <td style={{ padding: '14px 18px', color: '#64748B' }}>{new Date(r.date).toLocaleDateString()}</td>
                            <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>{r.transaction_count}</td>
                            <td style={{ padding: '14px 18px', color: '#1E56A0', fontWeight: '600' }}>{formatCurrency(r.bill_value)}</td>
                            <td style={{ padding: '14px 18px', color: '#4338CA', fontWeight: '600' }}>{formatCurrency(r.sub_used)}</td>
                            <td style={{ padding: '14px 18px', fontWeight: '800', color: '#059669' }}>{formatCurrency(r.revenue)}</td>
                          </>
                        )}
                        {activeTab === 'sales' && (
                          <>
                            <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#1E56A0', fontWeight: '600' }}>{r.transaction_number}</td>
                            <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '14px 18px', fontWeight: '600', color: '#0F2C59' }}>{r.customer_name}</td>
                            <td style={{ padding: '14px 18px', color: '#0F2C59' }}>{formatCurrency(r.total_bill_amount)}</td>
                            <td style={{ padding: '14px 18px', color: '#4338CA' }}>{formatCurrency(r.sub_credit_used)}</td>
                            <td style={{ padding: '14px 18px', fontWeight: '700', color: '#059669' }}>{formatCurrency(r.final_paid_amount)}</td>
                            <td style={{ padding: '14px 18px', color: '#64748B' }}>{r.payment_method}</td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '9999px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                                {r.status}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'bookings' && (
                          <>
                            <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#1E56A0', fontWeight: '600' }}>{r.booking_code}</td>
                            <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>{new Date(r.expires_at).toLocaleString()}</td>
                            <td style={{ padding: '14px 18px', fontWeight: '600', color: '#0F2C59' }}>{r.customer_name} ({r.customer_mobile})</td>
                            <td style={{ padding: '14px 18px', color: '#0F2C59', fontWeight: '600' }}>{formatCurrency(r.total_amount)}</td>
                            <td style={{ padding: '14px 18px', color: '#4338CA' }}>{formatCurrency(r.sub_credit_used)}</td>
                            <td style={{ padding: '14px 18px', color: '#059669', fontWeight: '600' }}>{formatCurrency(r.razorpay_paid)}</td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '9999px', background: r.status === 'COMPLETED' ? '#ECFDF5' : '#EFF6FF', color: r.status === 'COMPLETED' ? '#065F46' : '#1E56A0', border: `1px solid ${r.status === 'COMPLETED' ? '#A7F3D0' : '#BFDBFE'}` }}>
                                {r.status}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'subscriptions' && (
                          <>
                            <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: '14px 18px', fontWeight: '600', color: '#0F2C59' }}>{r.customer_name} ({r.customer_mobile})</td>
                            <td style={{ padding: '14px 18px', fontWeight: '700', color: '#1E56A0' }}>{r.plan_title}</td>
                            <td style={{ padding: '14px 18px', color: '#0F2C59' }}>{formatCurrency(r.plan_price)}</td>
                            <td style={{ padding: '14px 18px', color: '#059669', fontWeight: '700' }}>{formatCurrency(r.credit_balance)}</td>
                            <td style={{ padding: '14px 18px', color: '#64748B' }}>{r.weekly_qty_used} kg</td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '9999px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                                {r.status}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'inventory' && (
                          <>
                            <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>{r.name}</td>
                            <td style={{ padding: '14px 18px', color: '#1E56A0', fontWeight: '600' }}>{formatCurrency(r.unit_price)}</td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '9999px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '11px', fontWeight: '700' }}>
                                {r.freshness_state}
                              </span>
                            </td>
                            <td style={{ padding: '14px 18px', color: '#0F2C59' }}>{r.physical_quantity} kg</td>
                            <td style={{ padding: '14px 18px', color: '#059669', fontWeight: '700' }}>{r.available_quantity} kg</td>
                            <td style={{ padding: '14px 18px', color: '#D97706' }}>{r.reserved_quantity} kg</td>
                          </>
                        )}
                        {activeTab === 'workers' && (
                          <>
                            <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>{r.name}</td>
                            <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#1E56A0' }}>{r.mobile_number}</td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '9999px', background: r.active ? '#ECFDF5' : '#FEF2F2', color: r.active ? '#065F46' : '#991B1B', border: `1px solid ${r.active ? '#A7F3D0' : '#FECACA'}` }}>
                                {r.active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>{r.orders_handled}</td>
                            <td style={{ padding: '14px 18px', color: '#059669', fontWeight: '600' }}>{r.completed_bookings}</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Standardized Pagination Controls */}
            {reportData.pagination && (
              <AdminPagination
                page={reportData.pagination.page || page}
                totalPages={Math.ceil((reportData.pagination.total || 0) / (reportData.pagination.limit || limit || 25)) || 1}
                total={reportData.pagination.total || 0}
                limit={reportData.pagination.limit || limit || 25}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  fetchReport(activeTab, period, customFrom, customTo, newPage, limit);
                }}
                onLimitChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                  fetchReport(activeTab, period, customFrom, customTo, 1, newLimit);
                }}
                itemName="records"
                loading={loading}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
