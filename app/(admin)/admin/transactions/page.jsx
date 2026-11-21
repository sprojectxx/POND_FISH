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
import { AdminSubNav, AdminPagination, AdminSelect, AdminTableSkeleton } from '@/components/ui';

const STATUS_CONFIG = {
  COMPLETED: { label: 'Successful', bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
  PENDING: { label: 'Pending', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  FAILED: { label: 'Failed', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  CANCELLED: { label: 'Cancelled', bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
  REFUNDED: { label: 'Refunded / Restored', bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' },
};

const PAYMENT_METHOD_LABELS = {
  CASH: { label: 'Cash Counter', bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  RAZORPAY: { label: 'Razorpay UPI/Card', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  SUBSCRIPTION_ONLY: { label: 'Subscription Only', bg: '#FAF5FF', color: '#6B21A8', border: '#E9D5FF' },
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
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const [, startTransition] = useTransition();

  // Fetch transactions with query parameters
  const fetchTransactions = useCallback(
    async (pageToLoad = pagination.page, limitToLoad = pagination.limit) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const currentLimit = limitToLoad || pagination.limit || 25;
        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', currentLimit.toString());

        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
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
    [pagination.page, pagination.limit, debouncedSearch, statusFilter, paymentMethodFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchTransactions(1);
  }, [debouncedSearch, statusFilter, paymentMethodFilter, dateFrom, dateTo]);

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

  const hasActiveFilters = Boolean(
    search.trim() ||
    statusFilter !== 'ALL' ||
    paymentMethodFilter !== 'ALL' ||
    dateFrom ||
    dateTo
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Online Bookings', href: '/admin/bookings' },
          { label: 'Counter POS Bills & Transactions', href: '/admin/transactions' },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0F2C59', margin: 0, letterSpacing: '-0.02em' }}>
              Transactions &amp; POS Bills
            </h1>
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Point-of-sale counter bills and verified online self-checkout transaction ledger
          </div>
        </div>

        <button
          onClick={() => fetchTransactions(pagination.page)}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '36px',
            background: '#FFFFFF',
            color: '#0F2C59',
            border: '1px solid #CBD5E1',
            padding: '0 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <svg
            width="14"
            height="14"
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
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Status Segmented Performance Ribbon */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '8px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)',
        }}
      >
        {[
          {
            key: 'ALL',
            label: 'All Transactions',
            count: counts.all || 0,
            sub: `Gross: ${formatCurrency(counts.totalBillSum)}`,
            dotColor: '#38BDF8',
            activeBg: '#0F2C59',
            activeBorder: '#0F2C59',
            activeText: '#FFFFFF',
            activeLabel: '#93C5FD',
            activeSub: 'rgba(255, 255, 255, 0.8)',
            shadow: '0 4px 14px rgba(15, 44, 89, 0.22)',
          },
          {
            key: 'COMPLETED',
            label: 'Successful / Paid',
            count: counts.completed || 0,
            sub: `Paid: ${formatCurrency(counts.finalPaidSum)}`,
            dotColor: '#16A34A',
            activeBg: '#DCFCE7',
            activeBorder: '#16A34A',
            activeText: '#15803D',
            activeLabel: '#14532D',
            activeSub: '#166534',
            shadow: '0 4px 14px rgba(22, 163, 74, 0.16)',
          },
          {
            key: 'PENDING',
            label: 'Pending Processing',
            count: counts.pending || 0,
            sub: 'Awaiting finalization',
            dotColor: '#D97706',
            activeBg: '#FEF3C7',
            activeBorder: '#D97706',
            activeText: '#B45309',
            activeLabel: '#78350F',
            activeSub: '#92400E',
            shadow: '0 4px 14px rgba(217, 119, 6, 0.18)',
          },
          {
            key: 'REFUNDED',
            label: 'Refunded / Restored',
            count: counts.refunded || 0,
            sub: 'Stock & credit reversed',
            dotColor: '#9333EA',
            activeBg: '#F3E8FF',
            activeBorder: '#9333EA',
            activeText: '#7E22CE',
            activeLabel: '#581C87',
            activeSub: '#6B21A8',
            shadow: '0 4px 14px rgba(147, 51, 234, 0.16)',
          },
          {
            key: 'FAILED',
            label: 'Cancelled / Failed',
            count: (counts.cancelled || 0) + (counts.failed || 0),
            sub: 'Exceptions recorded',
            dotColor: '#DC2626',
            activeBg: '#FEE2E2',
            activeBorder: '#DC2626',
            activeText: '#DC2626',
            activeLabel: '#7F1D1D',
            activeSub: '#991B1B',
            shadow: '0 4px 14px rgba(220, 38, 38, 0.18)',
          },
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              style={{
                background: isActive ? tab.activeBg : '#FFFFFF',
                color: isActive ? tab.activeText : '#0F2C59',
                border: isActive ? `2px solid ${tab.activeBorder}` : '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: isActive ? '11px 13px' : '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? tab.shadow : '0 1px 3px rgba(15, 44, 89, 0.03)',
                textAlign: 'left',
                minHeight: '82px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#CBD5E1';
                  e.currentTarget.style.background = '#F8FAFC';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.background = '#FFFFFF';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: isActive ? tab.activeLabel : '#64748B',
                }}>
                  {tab.label}
                </span>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: tab.dotColor,
                  boxShadow: isActive ? `0 0 6px ${tab.dotColor}` : 'none',
                  flexShrink: 0,
                }} />
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '900',
                marginTop: '4px',
                color: isActive ? tab.activeText : '#0F2C59',
                lineHeight: 1.1,
              }}>
                {tab.count}
              </div>
              <div style={{
                fontSize: '11px',
                marginTop: '3px',
                color: isActive ? tab.activeSub : '#64748B',
                fontWeight: '500',
              }}>
                {tab.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '14px 18px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(15, 44, 89, 0.03)',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input with Search Icon */}
          <div style={{ flex: '2 1 280px', position: 'relative' }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="search-transactions"
              type="text"
              placeholder="Search by Transaction ID, Bill ID, Customer Name, Phone, Worker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#0F2C59',
                padding: '9px 36px 9px 36px',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchTransactions(1);
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Payment Method Select */}
          <div style={{ minWidth: '180px' }}>
            <AdminSelect
              value={paymentMethodFilter}
              onChange={(val) => setPaymentMethodFilter(val)}
              options={[
                { value: 'ALL', label: 'All Payment Methods' },
                { value: 'CASH', label: 'Cash Counter' },
                { value: 'RAZORPAY', label: 'Razorpay UPI/Card' },
                { value: 'SUBSCRIPTION_ONLY', label: 'Subscription Only' },
              ]}
              style={{ width: '100%' }}
            />
          </div>

          {/* Date Range Picker */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '7px 12px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From Date"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#0F2C59',
                fontSize: '12px',
                fontWeight: '600',
                outline: 'none',
              }}
            />
            <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700' }}>&rarr;</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To Date"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#0F2C59',
                fontSize: '12px',
                fontWeight: '600',
                outline: 'none',
              }}
            />
          </div>

          {/* Reset Filters Pill Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Reset Filters</span>
            </button>
          )}
        </form>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '14px 18px', borderRadius: '10px', marginBottom: '20px', fontSize: '14px', fontWeight: '600' }}>
          {errorMsg}
        </div>
      )}

      {/* Transactions Data Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15, 44, 89, 0.03)', minHeight: '460px', position: 'relative' }}>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Transaction ID</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Bill ID</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Customer</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Fish Cuts</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Qty (kg)</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Bill Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Sub Credit Used</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '110px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Paid Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Payment Method</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Worker / Channel</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Date / Time</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={13} rows={5} />
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ padding: '80px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', color: '#1E56A0', marginBottom: '16px' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                        <line x1="6" y1="15" x2="10" y2="15" />
                        <line x1="14" y1="15" x2="18" y2="15" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
                      No Transactions Recorded
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px' }}>
                      Point-of-sale counter bills and verified web customer transactions will be indexed here automatically.
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          background: '#1E56A0',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const statusMeta = STATUS_CONFIG[tx.status] || {
                    label: tx.status,
                    bg: '#F1F5F9',
                    text: '#475569',
                    border: '#CBD5E1',
                  };
                  const paymentMeta = PAYMENT_METHOD_LABELS[tx.paymentMethod] || {
                    label: tx.paymentMethod,
                    bg: '#F8FAFC',
                    color: '#64748B',
                    border: '#E2E8F0',
                  };

                  const totalKg = (tx.items || []).reduce((acc, it) => acc + (parseFloat(it.quantityKg) || 0), 0);

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                    >
                      {/* Transaction ID */}
                      <td style={{ padding: '14px 16px' }}>
                        <Link
                          href={`/admin/transactions/${tx.id}`}
                          style={{
                            display: 'inline-block',
                            background: '#EFF6FF',
                            color: '#1E56A0',
                            border: '1px solid #BFDBFE',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            fontSize: '12px',
                            textDecoration: 'none',
                          }}
                        >
                          {tx.transactionNumber}
                        </Link>
                      </td>

                      {/* Bill ID */}
                      <td style={{ padding: '14px 16px' }}>
                        {tx.billNumber ? (
                          <span style={{ fontFamily: 'monospace', color: '#0F2C59', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                            {tx.billNumber}
                          </span>
                        ) : (
                          <span style={{ color: '#64748B', fontSize: '12px' }}>Online Order</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#0F2C59' }}>
                          {tx.customerName}
                        </div>
                        {tx.customerPhone && (
                          <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                            {tx.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Fish Cuts */}
                      <td style={{ padding: '14px 16px' }}>
                        {tx.items && tx.items.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {tx.items.slice(0, 2).map((it, idx) => (
                              <div key={idx} style={{ fontSize: '12px', color: '#0F2C59' }}>
                                • {it.fishName} ({it.quantityKg} kg)
                              </div>
                            ))}
                            {tx.items.length > 2 && (
                              <span style={{ fontSize: '11px', color: '#1E56A0', fontWeight: '600', marginTop: '2px' }}>
                                +{tx.items.length - 2} more cuts
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>No cuts recorded</span>
                        )}
                      </td>

                      {/* Quantity kg */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#0F2C59' }}>
                        {totalKg > 0 ? `${totalKg.toFixed(2)} kg` : '—'}
                      </td>

                      {/* Bill Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#0F2C59', fontWeight: '600' }}>
                        {formatCurrency(tx.totalBillAmount)}
                      </td>

                      {/* Subscription Used */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: tx.subCreditUsed > 0 ? '#7C3AED' : '#94A3B8', fontWeight: tx.subCreditUsed > 0 ? '700' : '500' }}>
                        {tx.subCreditUsed > 0 ? `-${formatCurrency(tx.subCreditUsed)}` : '₹0.00'}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#16A34A', fontSize: '13px' }}>
                        {formatCurrency(tx.finalPaidAmount)}
                      </td>

                      {/* Payment Method */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: paymentMeta.bg,
                            border: `1px solid ${paymentMeta.border}`,
                            color: paymentMeta.color,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {paymentMeta.label}
                        </span>
                      </td>

                      {/* Worker Attribution */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: tx.workerName ? '#0F2C59' : '#64748B', fontWeight: tx.workerName ? '600' : '400', fontSize: '12px' }}>
                          {tx.workerName || 'Online Self-Checkout'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: statusMeta.bg,
                            color: statusMeta.text,
                            border: `1px solid ${statusMeta.border}`,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusMeta.text }} />
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Date/Time */}
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatDate(tx.createdAt)}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Link
                          id={`btn-investigate-${tx.id}`}
                          href={`/admin/transactions/${tx.id}`}
                          style={{
                            display: 'inline-block',
                            background: '#FFFFFF',
                            color: '#1E56A0',
                            border: '1px solid #CBD5E1',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: '700',
                            boxShadow: '0 1px 2px rgba(15, 44, 89, 0.04)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination Bar */}
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(newPage) => fetchTransactions(newPage, pagination.limit)}
          onLimitChange={(newLimit) => {
            setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
            fetchTransactions(1, newLimit);
          }}
          itemName="records"
          loading={loading}
        />
      </div>
    </div>
  );
}
