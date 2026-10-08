'use client';

/**
 * ADMIN-13 — Transactions Management Console
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 106–117)
 * - PondFish Core Business Engines Specification v1 (Sections 18, 21)
 * - Master PRD v2 (Section 18)
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';

const STATUS_CONFIG = {
  COMPLETED: { label: 'Successful', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: '#059669' },
  PENDING: { label: 'Pending', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '#D97706' },
  FAILED: { label: 'Failed', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: '#DC2626' },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '#475569' },
  REFUNDED: { label: 'Refunded / Restored', bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: '#7E22CE' },
};

const PAYMENT_METHOD_LABELS = {
  CASH: { label: 'Cash Counter', icon: '💵', color: '#10B981' },
  RAZORPAY: { label: 'Razorpay UPI/Card', icon: '💳', color: '#38BDF8' },
  SUBSCRIPTION_ONLY: { label: 'Subscription Only', icon: '👑', color: '#F59E0B' },
};

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return `₹${num.toFixed(2)}`;
}

function formatDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    cancelled: 0,
    refunded: 0,
    totalBillSum: 0,
    finalPaidSum: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [, startTransition] = useTransition();

  // Fetch transactions with query parameters
  const fetchTransactions = useCallback(
    async (pageToLoad = pagination.page) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', '20');

        if (search.trim()) params.set('search', search.trim());
        if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
        if (paymentMethodFilter && paymentMethodFilter !== 'ALL') params.set('paymentMethod', paymentMethodFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await fetch(`/api/v1/admin/transactions?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setTransactions(data.transactions || []);
          if (data.counts) setCounts(data.counts);
          if (data.pagination) setPagination(data.pagination);
        } else {
          setErrorMsg(data.error?.message || 'Failed to load transactions.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Network error fetching transactions.');
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, search, statusFilter, paymentMethodFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchTransactions(1);
  }, [statusFilter, paymentMethodFilter, dateFrom, dateTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTransactions(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setPaymentMethodFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div style={{ padding: '32px', color: '#F8FAFC', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '28px' }}>💳</span>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em' }}>
              Transaction Management (ADMIN-13)
            </h1>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '14px', margin: 0 }}>
            Authoritative financial records, customer attribution, physical bill verification, AI discrepancy inspection, and restitution governance.
          </p>
        </div>

        <button
          onClick={() => fetchTransactions(pagination.page)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1E293B',
            color: '#38BDF8',
            border: '1px solid #334155',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Total Transactions
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#F8FAFC' }}>
            {counts.all || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Gross: {formatCurrency(counts.totalBillSum)}
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Successful / Completed
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#10B981' }}>
            {counts.completed || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Paid: {formatCurrency(counts.finalPaidSum)}
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Pending Processing
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#F59E0B' }}>
            {counts.pending || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Awaiting finalization
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Refunded / Restored
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#A855F7' }}>
            {counts.refunded || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Stock & Credit reversed
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Cancelled / Failed
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#EF4444' }}>
            {(counts.cancelled || 0) + (counts.failed || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Exceptions recorded
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 320px', position: 'relative' }}>
              <input
                id="search-transactions"
                type="text"
                placeholder="Search by Transaction ID, Bill ID, Customer Name/Phone, Worker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                background: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              🔍 Search
            </button>

            {(search || statusFilter !== 'ALL' || paymentMethodFilter !== 'ALL' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: 'transparent',
                  color: '#94A3B8',
                  border: '1px solid #475569',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Secondary Filter Row */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #334155' }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8', marginRight: '4px' }}>Status:</span>
              {['ALL', 'COMPLETED', 'PENDING', 'CANCELLED', 'REFUNDED', 'FAILED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    background: statusFilter === st ? '#38BDF8' : '#0F172A',
                    color: statusFilter === st ? '#0F172A' : '#94A3B8',
                    border: '1px solid #334155',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: statusFilter === st ? '700' : '500',
                    cursor: 'pointer',
                  }}
                >
                  {st === 'ALL' ? 'All' : (STATUS_CONFIG[st]?.label || st)}
                </button>
              ))}
            </div>

            {/* Payment Method Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Payment:</span>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                style={{
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash Counter</option>
                <option value="RAZORPAY">Razorpay UPI/Card</option>
                <option value="SUBSCRIPTION_ONLY">Subscription Only</option>
              </select>
            </div>

            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Date:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <span style={{ color: '#64748B', fontSize: '12px' }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Transactions Data Table */}
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Transaction ID</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Bill ID</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Customer</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Fish Cuts</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>Qty (kg)</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>Bill Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>Sub Credit Used</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>Paid Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Payment Method</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Worker / Channel</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Date / Time</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔄</div>
                    <div>Loading transactions...</div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ padding: '64px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧾</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#F8FAFC', marginBottom: '4px' }}>
                      No Transactions Found
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      Try adjusting your search criteria or filter range.
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const statusMeta = STATUS_CONFIG[tx.status] || {
                    label: tx.status,
                    bg: '#334155',
                    text: '#F8FAFC',
                    border: '#475569',
                  };
                  const paymentMeta = PAYMENT_METHOD_LABELS[tx.paymentMethod] || {
                    label: tx.paymentMethod,
                    icon: '💳',
                    color: '#94A3B8',
                  };

                  const totalKg = (tx.items || []).reduce((acc, it) => acc + (parseFloat(it.quantityKg) || 0), 0);

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: '1px solid #334155',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Transaction ID */}
                      <td style={{ padding: '14px 16px' }}>
                        <Link
                          href={`/admin/transactions/${tx.id}`}
                          style={{
                            color: '#38BDF8',
                            fontFamily: 'monospace',
                            fontWeight: '600',
                            textDecoration: 'none',
                          }}
                        >
                          {tx.transactionNumber}
                        </Link>
                      </td>

                      {/* Bill ID */}
                      <td style={{ padding: '14px 16px' }}>
                        {tx.billNumber ? (
                          <span style={{ fontFamily: 'monospace', color: '#E2E8F0', background: '#0F172A', padding: '3px 8px', borderRadius: '4px' }}>
                            {tx.billNumber}
                          </span>
                        ) : (
                          <span style={{ color: '#64748B' }}>Online Order</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#F8FAFC' }}>
                          {tx.customerName}
                        </div>
                        {tx.customerPhone && (
                          <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                            {tx.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Fish Cuts */}
                      <td style={{ padding: '14px 16px' }}>
                        {tx.items && tx.items.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {tx.items.slice(0, 2).map((it, idx) => (
                              <div key={idx} style={{ fontSize: '12px', color: '#CBD5E1' }}>
                                • {it.fishName} ({it.quantityKg} kg)
                              </div>
                            ))}
                            {tx.items.length > 2 && (
                              <span style={{ fontSize: '11px', color: '#38BDF8' }}>
                                +{tx.items.length - 2} more cuts
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#64748B' }}>No cuts</span>
                        )}
                      </td>

                      {/* Quantity kg */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600', color: '#F8FAFC' }}>
                        {totalKg > 0 ? `${totalKg.toFixed(2)} kg` : '—'}
                      </td>

                      {/* Bill Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#CBD5E1' }}>
                        {formatCurrency(tx.totalBillAmount)}
                      </td>

                      {/* Subscription Used */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: tx.subCreditUsed > 0 ? '#C084FC' : '#64748B' }}>
                        {tx.subCreditUsed > 0 ? `-${formatCurrency(tx.subCreditUsed)}` : '₹0.00'}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#4ADE80' }}>
                        {formatCurrency(tx.finalPaidAmount)}
                      </td>

                      {/* Payment Method */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#0F172A',
                            border: `1px solid ${paymentMeta.color}`,
                            color: paymentMeta.color,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        >
                          <span>{paymentMeta.icon}</span> {paymentMeta.label}
                        </span>
                      </td>

                      {/* Worker Attribution */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: tx.workerName ? '#E2E8F0' : '#64748B' }}>
                          {tx.workerName || 'Online Self-Checkout'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: statusMeta.bg,
                            color: statusMeta.text,
                            border: `1px solid ${statusMeta.border}`,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Date/Time */}
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                        {formatDate(tx.createdAt)}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Link
                          id={`btn-investigate-${tx.id}`}
                          href={`/admin/transactions/${tx.id}`}
                          style={{
                            display: 'inline-block',
                            background: '#0F172A',
                            color: '#38BDF8',
                            border: '1px solid #38BDF8',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          Investigate
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#0F172A', borderTop: '1px solid #334155' }}>
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>
              Showing {transactions.length} of {pagination.total} records (Page {pagination.page} of {pagination.totalPages})
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchTransactions(pagination.page - 1)}
                style={{
                  background: pagination.page <= 1 ? '#1E293B' : '#0284C7',
                  color: pagination.page <= 1 ? '#64748B' : '#FFFFFF',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>

              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchTransactions(pagination.page + 1)}
                style={{
                  background: pagination.page >= pagination.totalPages ? '#1E293B' : '#0284C7',
                  color: pagination.page >= pagination.totalPages ? '#64748B' : '#FFFFFF',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
