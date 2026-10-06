'use client';

/**
 * AP-18: Reports & Commercial Exports
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 152–163)
 * Financial reconciliation, inventory audit, booking summaries, and spreadsheet-safe CSV exports.
 */

import React, { useState, useEffect, useCallback } from 'react';

const ADMIN_SECRET = 'pondfish-admin-key-2026';

const REPORT_TABS = [
  { id: 'revenue', label: '📊 Revenue Report' },
  { id: 'sales', label: '🛒 Sales & Transactions' },
  { id: 'bookings', label: '📦 Customer Bookings' },
  { id: 'subscriptions', label: '🎟️ Subscription Ledger' },
  { id: 'inventory', label: '🐟 Inventory & Freshness' },
  { id: 'workers', label: '👷 Worker Operations' },
];

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async (tab, selectedPeriod, fromVal, toVal, pageNum) => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/v1/admin/reports?type=${tab}&period=${selectedPeriod}&page=${pageNum}&limit=25`;
      if (selectedPeriod === 'custom') {
        if (fromVal) url += `&from=${encodeURIComponent(fromVal)}`;
        if (toVal) url += `&to=${encodeURIComponent(toVal)}`;
      }

      const res = await fetch(url, {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });

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
    fetchReport(activeTab, period, customFrom, customTo, page);
  }, [activeTab, period, page, fetchReport]);

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
      fetchReport(activeTab, 'custom', customFrom, customTo, 1);
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

      const res = await fetch(url, {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });

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
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#F8FAFC' }}>
            Reports & Commercial Exports
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>
            Authoritative financial audit, inventory balances, booking reconciliation, and CSV export.
          </p>
        </div>

        {/* Action button: Export CSV */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            style={{
              background: '#22C55E',
              color: '#0B1120',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: exporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {exporting ? 'Preparing download...' : '📥 Export CSV'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#38BDF8' : '#94A3B8',
              borderBottom: activeTab === tab.id ? '2px solid #38BDF8' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1E293B', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'today', label: 'Daily (Today)' },
          { id: 'this_week', label: 'Weekly (Last 7d)' },
          { id: 'this_month', label: 'Monthly' },
          { id: 'custom', label: 'Custom Range' },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => handlePeriodChange(btn.id)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: period === btn.id ? '600' : '400',
              background: period === btn.id ? '#38BDF8' : 'transparent',
              color: period === btn.id ? '#0B1120' : '#94A3B8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
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
              style={{ background: '#0B1120', color: '#F8FAFC', border: '1px solid #475569', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
            />
            <span style={{ color: '#64748B', fontSize: '12px' }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ background: '#0B1120', color: '#F8FAFC', border: '1px solid #475569', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
            />
            <button
              type="submit"
              style={{ background: '#38BDF8', color: '#0B1120', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Apply
            </button>
          </form>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #DC2626', borderRadius: '8px', padding: '14px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => fetchReport(activeTab, period, customFrom, customTo, page)} style={{ background: '#EF4444', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !reportData && (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
          Generating report data...
        </div>
      )}

      {/* Report Content */}
      {reportData && (
        <div>
          {/* Summary Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {activeTab === 'revenue' && (
              <>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Net Revenue</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{formatCurrency(reportData.summary.total_revenue)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Total Bill Value</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{formatCurrency(reportData.summary.total_bill_value)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Sub Credit Used</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#C084FC' }}>{formatCurrency(reportData.summary.total_sub_credit_used)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Transactions</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{reportData.summary.transaction_count}</div>
                </div>
              </>
            )}

            {activeTab === 'sales' && (
              <>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Total Fish Bill Value</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{formatCurrency(reportData.summary.total_bill_value)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Subscription Value Used</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#C084FC' }}>{formatCurrency(reportData.summary.total_sub_used)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Final Paid Amount</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{formatCurrency(reportData.summary.total_paid)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Transaction Count</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{reportData.summary.transaction_count}</div>
                </div>
              </>
            )}

            {activeTab === 'bookings' && (
              <>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Total Bookings</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{reportData.summary.total_bookings}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Completed</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{reportData.summary.completed}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Pending</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{reportData.summary.pending}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Expired (48h)</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#FACC15' }}>{reportData.summary.expired}</div>
                </div>
              </>
            )}

            {activeTab === 'subscriptions' && (
              <>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Active Members</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{reportData.summary.active_count}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Expiring Soon (7d)</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#FACC15' }}>{reportData.summary.expiring_soon}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Outstanding Credit</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{formatCurrency(reportData.summary.outstanding_credit)}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Plan Sales Revenue</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{formatCurrency(reportData.summary.subscription_sales)}</div>
                </div>
              </>
            )}

            {activeTab === 'inventory' && (
              <>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Total Fish Listed</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{reportData.summary.total_fish}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Total Physical Stock</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{reportData.summary.total_physical_kg} kg</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Available Stock</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{reportData.summary.total_available_kg} kg</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Low Stock Items (&lt;10kg)</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: reportData.summary.low_stock_count > 0 ? '#EAB308' : '#22C55E' }}>{reportData.summary.low_stock_count}</div>
                </div>
              </>
            )}

            {activeTab === 'workers' && (
              <>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Active Staff</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC' }}>{reportData.summary.active_workers}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Transactions Handled</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38BDF8' }}>{reportData.summary.orders_handled}</div>
                </div>
                <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Completed Bookings</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>{reportData.summary.completed_bookings}</div>
                </div>
              </>
            )}
          </div>

          {/* Table Section */}
          <div style={{ background: '#1E293B', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
            {reportData.rows.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '15px' }}>No report data for the selected period.</p>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Try selecting a broader date range above.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                      {activeTab === 'revenue' && (
                        <>
                          <th style={{ padding: '12px 16px' }}>Date</th>
                          <th style={{ padding: '12px 16px' }}>Transactions</th>
                          <th style={{ padding: '12px 16px' }}>Bill Value</th>
                          <th style={{ padding: '12px 16px' }}>Sub Credit Used</th>
                          <th style={{ padding: '12px 16px' }}>Net Revenue</th>
                        </>
                      )}
                      {activeTab === 'sales' && (
                        <>
                          <th style={{ padding: '12px 16px' }}>Tx Number</th>
                          <th style={{ padding: '12px 16px' }}>Date/Time</th>
                          <th style={{ padding: '12px 16px' }}>Customer</th>
                          <th style={{ padding: '12px 16px' }}>Bill Total</th>
                          <th style={{ padding: '12px 16px' }}>Sub Covered</th>
                          <th style={{ padding: '12px 16px' }}>Paid</th>
                          <th style={{ padding: '12px 16px' }}>Method</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                        </>
                      )}
                      {activeTab === 'bookings' && (
                        <>
                          <th style={{ padding: '12px 16px' }}>Booking Code</th>
                          <th style={{ padding: '12px 16px' }}>Created At</th>
                          <th style={{ padding: '12px 16px' }}>Expires At</th>
                          <th style={{ padding: '12px 16px' }}>Customer</th>
                          <th style={{ padding: '12px 16px' }}>Total</th>
                          <th style={{ padding: '12px 16px' }}>Credit Used</th>
                          <th style={{ padding: '12px 16px' }}>Paid Online</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                        </>
                      )}
                      {activeTab === 'subscriptions' && (
                        <>
                          <th style={{ padding: '12px 16px' }}>Created</th>
                          <th style={{ padding: '12px 16px' }}>Customer</th>
                          <th style={{ padding: '12px 16px' }}>Plan</th>
                          <th style={{ padding: '12px 16px' }}>Price</th>
                          <th style={{ padding: '12px 16px' }}>Credit Balance</th>
                          <th style={{ padding: '12px 16px' }}>Weekly Qty</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                        </>
                      )}
                      {activeTab === 'inventory' && (
                        <>
                          <th style={{ padding: '12px 16px' }}>Fish Name</th>
                          <th style={{ padding: '12px 16px' }}>Price/kg</th>
                          <th style={{ padding: '12px 16px' }}>Freshness</th>
                          <th style={{ padding: '12px 16px' }}>Physical (kg)</th>
                          <th style={{ padding: '12px 16px' }}>Available (kg)</th>
                          <th style={{ padding: '12px 16px' }}>Reserved (kg)</th>
                        </>
                      )}
                      {activeTab === 'workers' && (
                        <>
                          <th style={{ padding: '12px 16px' }}>Staff Name</th>
                          <th style={{ padding: '12px 16px' }}>Contact</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                          <th style={{ padding: '12px 16px' }}>Orders Handled</th>
                          <th style={{ padding: '12px 16px' }}>Completed Bookings</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((r, i) => (
                      <tr key={r.id || r.date || i} style={{ borderBottom: '1px solid #334155' }}>
                        {activeTab === 'revenue' && (
                          <>
                            <td style={{ padding: '12px 16px' }}>{new Date(r.date).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 16px' }}>{r.transaction_count}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.bill_value)}</td>
                            <td style={{ padding: '12px 16px', color: '#C084FC' }}>{formatCurrency(r.sub_used)}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#22C55E' }}>{formatCurrency(r.revenue)}</td>
                          </>
                        )}
                        {activeTab === 'sales' && (
                          <>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{r.transaction_number}</td>
                            <td style={{ padding: '12px 16px' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '12px 16px' }}>{r.customer_name}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.total_bill_amount)}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.sub_credit_used)}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#22C55E' }}>{formatCurrency(r.final_paid_amount)}</td>
                            <td style={{ padding: '12px 16px' }}>{r.payment_method}</td>
                            <td style={{ padding: '12px 16px' }}>{r.status}</td>
                          </>
                        )}
                        {activeTab === 'bookings' && (
                          <>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{r.booking_code}</td>
                            <td style={{ padding: '12px 16px' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '12px 16px' }}>{new Date(r.expires_at).toLocaleString()}</td>
                            <td style={{ padding: '12px 16px' }}>{r.customer_name} ({r.customer_mobile})</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.total_amount)}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.sub_credit_used)}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.razorpay_paid)}</td>
                            <td style={{ padding: '12px 16px' }}>{r.status}</td>
                          </>
                        )}
                        {activeTab === 'subscriptions' && (
                          <>
                            <td style={{ padding: '12px 16px' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 16px' }}>{r.customer_name} ({r.customer_mobile})</td>
                            <td style={{ padding: '12px 16px' }}>{r.plan_title}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.plan_price)}</td>
                            <td style={{ padding: '12px 16px', color: '#38BDF8' }}>{formatCurrency(r.credit_balance)}</td>
                            <td style={{ padding: '12px 16px' }}>{r.weekly_qty_used} kg</td>
                            <td style={{ padding: '12px 16px' }}>{r.status}</td>
                          </>
                        )}
                        {activeTab === 'inventory' && (
                          <>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{r.name}</td>
                            <td style={{ padding: '12px 16px' }}>{formatCurrency(r.unit_price)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#334155', fontSize: '11px' }}>
                                {r.freshness_state}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>{r.physical_quantity} kg</td>
                            <td style={{ padding: '12px 16px', color: '#22C55E' }}>{r.available_quantity} kg</td>
                            <td style={{ padding: '12px 16px', color: '#FACC15' }}>{r.reserved_quantity} kg</td>
                          </>
                        )}
                        {activeTab === 'workers' && (
                          <>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{r.name}</td>
                            <td style={{ padding: '12px 16px' }}>{r.mobile_number}</td>
                            <td style={{ padding: '12px 16px' }}>{r.active ? 'Active' : 'Inactive'}</td>
                            <td style={{ padding: '12px 16px' }}>{r.orders_handled}</td>
                            <td style={{ padding: '12px 16px' }}>{r.completed_bookings}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {reportData.pagination && reportData.pagination.total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#0F172A', borderTop: '1px solid #334155', fontSize: '12px', color: '#94A3B8' }}>
                <div>
                  Showing {Math.min(reportData.pagination.total, (reportData.pagination.page - 1) * reportData.pagination.limit + 1)} - {Math.min(reportData.pagination.total, reportData.pagination.page * reportData.pagination.limit)} of {reportData.pagination.total} records
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={reportData.pagination.page <= 1}
                    onClick={() => setPage(page - 1)}
                    style={{ background: '#1E293B', color: '#F8FAFC', border: '1px solid #475569', borderRadius: '4px', padding: '4px 10px', cursor: reportData.pagination.page <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={reportData.pagination.page * reportData.pagination.limit >= reportData.pagination.total}
                    onClick={() => setPage(page + 1)}
                    style={{ background: '#1E293B', color: '#F8FAFC', border: '1px solid #475569', borderRadius: '4px', padding: '4px 10px', cursor: reportData.pagination.page * reportData.pagination.limit >= reportData.pagination.total ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
