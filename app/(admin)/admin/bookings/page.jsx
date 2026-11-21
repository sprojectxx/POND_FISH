'use client';

/**
 * ADMIN-12 — Bookings Management Module
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 96–105)
 * - PondFish Core Business Engines Specification v1 (Sections 13, 14)
 * - Slice 16 Scope: Admin Booking Visibility, Search, Filtering, Detail & Operational Cancellation
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { AdminSubNav, AdminPagination, AdminSelect } from '@/components/ui';

const STATUS_CONFIG = {
  CREATED: { label: 'Created', bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  CONFIRMED: { label: 'Confirmed', bg: '#EFF6FF', text: '#1E56A0', border: '#BFDBFE' },
  PENDING_COLLECTION: { label: 'Pending Collection', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  COMPLETED: { label: 'Completed', bg: '#ECFDF5', text: '#159C57', border: '#A7F3D0' },
  CANCELLED: { label: 'Cancelled', bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  EXPIRED: { label: 'Expired', bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0' },
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    created: 0,
    confirmed: 0,
    pendingCollection: 0,
    completed: 0,
    cancelled: 0,
    expired: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Booking for Detail Drawer
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bookingDetail, setBookingDetail] = useState(null);

  // Cancellation Modal State
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('Fish unavailable');
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const [, startTransition] = useTransition();

  // Debounced search query to prevent typing lag
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Bookings with Query Parameters
  const fetchBookings = useCallback(
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
        if (sourceFilter && sourceFilter !== 'ALL') params.set('source', sourceFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await fetch(`/api/v1/admin/bookings?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setBookings(data.bookings || []);
          if (data.counts) setCounts(data.counts);
          if (data.pagination) setPagination(data.pagination);
        } else {
          setErrorMsg(data.error?.message || 'Failed to load bookings.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Network error fetching bookings.');
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, debouncedSearch, statusFilter, sourceFilter, dateFrom, dateTo]
  );

  // Immediate fetch on filter clicks or debounced search update
  useEffect(() => {
    startTransition(() => {
      fetchBookings(1);
    });
  }, [debouncedSearch, statusFilter, sourceFilter, dateFrom, dateTo]);

  // Fetch Booking Detail
  const openDetail = async (id) => {
    setSelectedBookingId(id);
    setDetailLoading(true);
    setBookingDetail(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/${id}`);
      const data = await res.json();
      if (data.success && data.booking) {
        setBookingDetail(data.booking);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load booking details.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error loading booking details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedBookingId(null);
    setBookingDetail(null);
  };

  // Open Cancellation Confirmation Modal
  const openCancelModal = (booking) => {
    setCancelModalBooking(booking);
    setCancelReason('Fish unavailable');
    setCancelNotes('');
    setCancelError(null);
  };

  const closeCancelModal = () => {
    setCancelModalBooking(null);
    setCancelReason('Fish unavailable');
    setCancelNotes('');
    setCancelError(null);
  };

  // Execute Operational Cancellation
  const handleConfirmCancellation = async () => {
    if (!cancelModalBooking) return;

    if (cancelReason === 'Other' && (!cancelNotes || cancelNotes.trim().length < 3)) {
      setCancelError('Please explain the cancellation reason in detail (minimum 3 characters).');
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/v1/admin/bookings/${cancelModalBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          cancellationNotes: cancelNotes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Cancellation rejected by business engine.');
      }

      setSuccessMsg(
        `Booking ${cancelModalBooking.booking_code} cancelled successfully. Reserved inventory and customer credits were restored.`
      );
      closeCancelModal();

      // Refresh list & detail if currently open
      fetchBookings(pagination.page);
      if (selectedBookingId === cancelModalBooking.id) {
        openDetail(cancelModalBooking.id);
      }
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setSourceFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter !== 'ALL' || sourceFilter !== 'ALL' || dateFrom || dateTo
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Online Bookings', href: '/admin/bookings' },
          { label: 'Counter POS Bills & Transactions', href: '/admin/transactions' },
        ]}
      />

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
              Bookings Management
            </h1>
          </div>
        </div>

        <button
          id="btn-refresh-bookings"
          onClick={() => fetchBookings(pagination.page)}
          disabled={loading}
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#1E56A0',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
          <span>Refresh</span>
        </button>
      </div>

      {/* Operational Alerts */}
      {errorMsg && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
          }}
        >
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: '16px' }}
          >
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10B981',
            color: '#6EE7B7',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
          }}
        >
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer', fontSize: '16px' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Status Pipeline Ribbon */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '8px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)',
        }}
      >
        {[
          {
            key: 'ALL',
            label: 'All Bookings',
            count: counts.all || 0,
            dotColor: '#38BDF8',
            activeBg: '#0F2C59',
            activeBorder: '#0F2C59',
            activeText: '#FFFFFF',
            activeLabel: '#93C5FD',
            shadow: '0 4px 14px rgba(15, 44, 89, 0.22)',
          },
          {
            key: 'CONFIRMED',
            label: 'Confirmed',
            count: counts.confirmed || 0,
            dotColor: '#2563EB',
            activeBg: '#EFF6FF',
            activeBorder: '#1E56A0',
            activeText: '#1E56A0',
            activeLabel: '#1E40AF',
            shadow: '0 4px 14px rgba(30, 86, 160, 0.16)',
          },
          {
            key: 'PENDING_COLLECTION',
            label: 'Awaiting Pickup',
            count: counts.pendingCollection || 0,
            dotColor: '#D97706',
            activeBg: '#FEF3C7',
            activeBorder: '#D97706',
            activeText: '#92400E',
            activeLabel: '#78350F',
            shadow: '0 4px 14px rgba(217, 119, 6, 0.18)',
          },
          {
            key: 'COMPLETED',
            label: 'Fulfilled',
            count: counts.completed || 0,
            dotColor: '#16A34A',
            activeBg: '#DCFCE7',
            activeBorder: '#16A34A',
            activeText: '#14532D',
            activeLabel: '#166534',
            shadow: '0 4px 14px rgba(22, 163, 74, 0.16)',
          },
          {
            key: 'CANCELLED',
            label: 'Cancelled',
            count: counts.cancelled || 0,
            dotColor: '#DC2626',
            activeBg: '#FEE2E2',
            activeBorder: '#DC2626',
            activeText: '#991B1B',
            activeLabel: '#7F1D1D',
            shadow: '0 4px 14px rgba(220, 38, 38, 0.18)',
          },
          {
            key: 'EXPIRED',
            label: 'Expired (48h)',
            count: counts.expired || 0,
            dotColor: '#64748B',
            activeBg: '#F1F5F9',
            activeBorder: '#475569',
            activeText: '#1E293B',
            activeLabel: '#334155',
            shadow: '0 4px 14px rgba(71, 85, 105, 0.16)',
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
                minHeight: '74px',
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
            </button>
          );
        })}
      </div>

      {/* Modern Command Search and Filter Bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(15, 44, 89, 0.03)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Search Input with Search Icon */}
        <div style={{ flex: '2 1 280px', position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="input-search-bookings"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Booking ID, customer name, phone, or fish..."
            style={{
              width: '100%',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '9px 12px 9px 36px',
              color: '#0F2C59',
              fontSize: '13px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '2px',
              }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
          <AdminSelect
            id="select-status-filter"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'CREATED', label: 'Created' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'PENDING_COLLECTION', label: 'Pending Collection' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'EXPIRED', label: 'Expired' },
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Source Dropdown */}
        <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
          <AdminSelect
            id="select-source-filter"
            value={sourceFilter}
            onChange={(val) => setSourceFilter(val)}
            options={[
              { value: 'ALL', label: 'All Sources' },
              { value: 'Online', label: 'Online' },
              { value: 'Physical-store', label: 'Physical Store' },
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Modern Date Range Box */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '6px 12px',
            boxSizing: 'border-box',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <input
            id="input-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From Date"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#0F2C59',
              fontSize: '12px',
              fontWeight: '500',
              padding: '2px 0',
              outline: 'none',
            }}
          />
          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700' }}>→</span>
          <input
            id="input-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To Date"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#0F2C59',
              fontSize: '12px',
              fontWeight: '500',
              padding: '2px 0',
              outline: 'none',
            }}
          />
        </div>

        {hasActiveFilters && (
          <button
            id="btn-clear-filters"
            onClick={clearFilters}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#1E56A0',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Bookings Table Card */}
      <div
        className="pf-admin-table-card"
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          minHeight: '460px',
          position: 'relative',
        }}
      >
        {/* Subtle Top Loading Line */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)',
              backgroundSize: '200% 100%',
              zIndex: 10,
            }}
          />
        )}
        <div
          className="pf-admin-scroll-hint"
          style={{
            display: 'none',
            padding: '8px 12px',
            background: '#F1F5F9',
            borderBottom: '1px solid #E2E8F0',
            fontSize: '11px',
            color: '#64748B',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          Scroll horizontally to view all columns
        </div>
        <div
          className="pf-admin-table-scroll"
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '980px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Booking ID</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Source</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fish &amp; Quantity</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Payment</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sub / Add. Payment</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expiry / Collection</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ opacity: loading && bookings.length > 0 ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
              {loading && bookings.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '120px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      <span>Loading bookings queue...</span>
                    </div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '80px 20px', textAlign: 'center' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      color: '#1E56A0',
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>
                      {hasActiveFilters ? 'No Matching Bookings' : 'No Customer Bookings Recorded'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
                      {hasActiveFilters
                        ? 'No orders match your active filter criteria. Try clearing search keywords or resetting filters.'
                        : 'Live customer orders reserved online or at store counter will appear here with pickup deadlines and fulfillment tracking.'}
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        style={{
                          marginTop: '16px',
                          background: '#1E56A0',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.CREATED;
                  const isCompleted = b.status === 'COMPLETED';
                  const isCancellable = ['CREATED', 'CONFIRMED', 'PENDING_COLLECTION'].includes(b.status);
                  const isExpired = new Date(b.expires_at) < new Date();

                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        background: selectedBookingId === b.id ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Booking ID */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{
                          display: 'inline-block',
                          fontWeight: '700',
                          color: '#1E56A0',
                          fontFamily: 'monospace',
                          background: '#EFF6FF',
                          border: '1px solid #DBEAFE',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}>
                          {b.booking_code}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '4px' }}>
                          {b.id.substring(0, 8)}...
                        </div>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#0F2C59' }}>
                          {b.customer_name || 'Retail Customer'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                          +91 {b.customer_phone || '—'}
                        </div>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: '#F1F5F9',
                            color: '#0F2C59',
                            border: '1px solid #E2E8F0',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        >
                          {b.source || 'Online'}
                        </span>
                      </td>

                      {/* Fish & Quantity */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0F2C59' }}>
                          {b.fish_names || 'Fish item'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#1E56A0', fontWeight: '700', marginTop: '2px' }}>
                          {Number(b.total_quantity_kg || 0).toFixed(2)} kg
                          <span style={{ color: '#64748B', fontWeight: '500', marginLeft: '6px', fontSize: '11px' }}>
                            ({b.item_count || 1} {b.item_count === 1 ? 'item' : 'items'})
                          </span>
                        </div>
                      </td>

                      {/* Total Payment */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '800', color: '#0F2C59', fontSize: '14px' }}>
                          ₹{Number(b.total_amount || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Subscription & Additional Payment */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '12px', color: b.sub_credit_used > 0 ? '#10B981' : '#64748B', fontWeight: b.sub_credit_used > 0 ? '600' : '400' }}>
                          Wallet: ₹{Number(b.sub_credit_used || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '12px', color: b.razorpay_paid > 0 ? '#1E56A0' : '#64748B', fontWeight: b.razorpay_paid > 0 ? '600' : '400' }}>
                          Paid: ₹{Number(b.razorpay_paid || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: cfg.bg,
                            color: cfg.text,
                            border: `1px solid ${cfg.border}`,
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.text }} />
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Created */}
                      <td style={{ padding: '14px 16px', color: '#475569', fontSize: '12px' }}>
                        <div style={{ fontWeight: '600', color: '#0F2C59' }}>{new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Expiry / Collection Time */}
                      <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                        {isCompleted ? (
                          <div>
                            <span style={{ color: '#10B981', fontWeight: '700' }}>Fulfilled</span>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                              {b.collection_time
                                ? new Date(b.collection_time).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Collection verified'}
                            </div>
                            {b.worker_name && (
                              <div style={{ fontSize: '10px', color: '#64748B' }}>by {b.worker_name}</div>
                            )}
                          </div>
                        ) : b.status === 'CANCELLED' ? (
                          <div style={{ color: '#EF4444', fontSize: '11px', fontWeight: '600' }}>Cancelled</div>
                        ) : (
                          <div>
                            <div style={{ color: isExpired ? '#EF4444' : '#F59E0B', fontWeight: '600' }}>
                              {isExpired ? 'Expired window' : '48h Expiry'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                              {b.expires_at
                                ? new Date(b.expires_at).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '48h from creation'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            id={`btn-view-${b.id}`}
                            onClick={() => openDetail(b.id)}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              color: '#1E56A0',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(15, 44, 89, 0.04)',
                            }}
                          >
                            Details
                          </button>

                          {isCancellable && (
                            <button
                              id={`btn-cancel-${b.id}`}
                              onClick={() => openCancelModal(b)}
                              style={{
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#DC2626',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
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
          onPageChange={(newPage) => fetchBookings(newPage, pagination.limit)}
          onLimitChange={(newLimit) => {
            setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
            fetchBookings(1, newLimit);
          }}
          itemName="bookings"
          loading={loading}
        />
      </div>

      {/* Booking Detail Drawer / Modal */}
      {selectedBookingId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 44, 89, 0.45)', backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              height: '100%',
              background: '#F8FAFC',
              borderLeft: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFFFFF',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                  <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                    Booking Details
                  </h2>
                </div>
                {bookingDetail && (
                  <div style={{ fontSize: '12px', color: '#38BDF8', fontFamily: 'monospace', marginTop: '4px' }}>
                    {bookingDetail.booking_code}
                  </div>
                )}
              </div>

              <button
                id="btn-close-detail"
                onClick={closeDetail}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                &times;
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>

                  <div>Loading comprehensive booking breakdown...</div>
                </div>
              ) : !bookingDetail ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#EF4444' }}>
                  Failed to load booking details.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Status Banner */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>CURRENT STATUS</div>
                      <div style={{ marginTop: '4px' }}>
                        <span
                          style={{
                            background: STATUS_CONFIG[bookingDetail.status]?.bg || '#334155',
                            color: STATUS_CONFIG[bookingDetail.status]?.text || '#F8FAFC',
                            border: `1px solid ${STATUS_CONFIG[bookingDetail.status]?.border || '#475569'}`,
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                        >
                          {STATUS_CONFIG[bookingDetail.status]?.label || bookingDetail.status}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>SOURCE</div>
                      <div style={{ fontSize: '13px', color: '#38BDF8', fontWeight: '700', marginTop: '4px' }}>
                        Online Customer Portal
                      </div>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Customer Information
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <div style={{ color: '#64748B', fontSize: '11px' }}>NAME</div>
                        <div style={{ fontWeight: '600', color: '#0F2C59' }}>{bookingDetail.customer_name || 'Retail Customer'}</div>
                      </div>
                      <div>
                        <div style={{ color: '#64748B', fontSize: '11px' }}>PHONE</div>
                        <div style={{ fontWeight: '600', color: '#425B73', fontFamily: 'monospace' }}>
                          +91 {bookingDetail.customer_phone || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#64748B', fontSize: '11px' }}>CUSTOMER ID</div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                          {bookingDetail.customer_id}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#64748B', fontSize: '11px' }}>LOCALITY / AREA</div>
                        <div style={{ color: '#425B73' }}>{bookingDetail.customer_area || 'Not provided'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Fish Line Items */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Booked Line Items
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {bookingDetail.items?.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            padding: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '600', color: '#0F2C59' }}>{item.fish_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {item.category_name || 'Fresh Catch'} • ₹{Number(item.unit_price).toFixed(2)} / kg
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: '#38BDF8' }}>
                              {Number(item.quantity_kg).toFixed(2)} kg
                            </div>
                            <div style={{ fontSize: '12px', color: '#0F2C59', fontWeight: '600' }}>
                              ₹{Number(item.subtotal).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Historical Financial Summary
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#425B73' }}>
                        <span>Total Booking Amount</span>
                        <span style={{ fontWeight: '700', color: '#0F2C59' }}>
                          ₹{Number(bookingDetail.total_amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#425B73' }}>
                        <span>Subscription Credit Used</span>
                        <span style={{ fontWeight: '600', color: '#10B981' }}>
                          ₹{Number(bookingDetail.sub_credit_used || 0).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#425B73' }}>
                        <span>Additional Online Payment (Razorpay)</span>
                        <span style={{ fontWeight: '600', color: '#38BDF8' }}>
                          ₹{Number(bookingDetail.razorpay_paid || 0).toFixed(2)}
                        </span>
                      </div>

                      {bookingDetail.razorpay_order_id && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                          <span>Razorpay Order ID</span>
                          <span style={{ fontFamily: 'monospace' }}>{bookingDetail.razorpay_order_id}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lifecycle & Expiry */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>
                      48-Hour Lifecycle &amp; Fulfillment
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: '#64748B' }}>CREATED AT</div>
                        <div style={{ color: '#425B73', marginTop: '2px' }}>
                          {new Date(bookingDetail.created_at).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: '#64748B' }}>EXPIRY DEADLINE</div>
                        <div style={{ color: '#F59E0B', marginTop: '2px', fontWeight: '600' }}>
                          {new Date(bookingDetail.expires_at).toLocaleString('en-IN')}
                        </div>
                      </div>

                      {bookingDetail.collection && (
                        <>
                          <div>
                            <div style={{ color: '#64748B' }}>FULFILLED BY WORKER</div>
                            <div style={{ color: '#10B981', fontWeight: '600', marginTop: '2px' }}>
                              {bookingDetail.collection.worker_name || 'Worker'} (+91 {bookingDetail.collection.worker_phone})
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748B' }}>TRANSACTION NUMBER</div>
                            <div style={{ color: '#38BDF8', fontFamily: 'monospace', marginTop: '2px' }}>
                              {bookingDetail.collection.transaction_number}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Audit Timeline */}
                  {bookingDetail.audit_timeline && bookingDetail.audit_timeline.length > 0 && (
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>
                         Audit Trail
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {bookingDetail.audit_timeline.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              background: '#F8FAFC',
                              borderRadius: '6px',
                              padding: '10px',
                              fontSize: '11px',
                              borderLeft: '3px solid #38BDF8',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: '#0F2C59' }}>
                              <span>{log.action}</span>
                              <span style={{ color: '#64748B', fontWeight: '400' }}>
                                {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                              </span>
                            </div>
                            <div style={{ color: '#64748B', marginTop: '4px' }}>
                              Actor: {log.actor_type} ({log.actor_id})
                            </div>
                            {log.payload?.reason && (
                              <div style={{ color: '#FCA5A5', marginTop: '2px' }}>
                                Reason: {log.payload.reason} {log.payload.notes ? `(${log.payload.notes})` : ''}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFFFFF',
              }}
            >
              <button
                onClick={closeDetail}
                style={{
                  background: '#E2E8F0',
                  border: 'none',
                  color: '#425B73',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              {bookingDetail && ['CREATED', 'CONFIRMED', 'PENDING_COLLECTION'].includes(bookingDetail.status) && (
                <button
                  id="btn-drawer-cancel-booking"
                  onClick={() => openCancelModal(bookingDetail)}
                  style={{
                    background: '#DC2626',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancelModalBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 44, 89, 0.5)', backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#F8FAFC',
              border: '1px solid #DC2626',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>

              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                Confirm Operational Booking Cancellation
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: '0 0 16px' }}>
              Cancellation has <strong style={{ color: '#10B981' }}>no cancellation fee</strong>. The backend will atomically release reserved inventory and restore customer subscription balances immediately.
            </p>

            {/* Error Message inside modal */}
            {cancelError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  color: '#FCA5A5',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                {cancelError}
              </div>
            )}

            {/* Restoration Breakdown Preview Box */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '18px',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: '700', color: '#38BDF8', marginBottom: '8px' }}>
                RESTORATION IMPACT PREVIEW
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#425B73' }}>
                <div>
                  <span style={{ color: '#64748B' }}>Booking ID:</span>{' '}
                  <strong style={{ color: '#0F2C59' }}>{cancelModalBooking.booking_code}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Customer:</span>{' '}
                  <strong style={{ color: '#0F2C59' }}>{cancelModalBooking.customer_name || 'Customer'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Inventory to Restore:</span>{' '}
                  <strong style={{ color: '#10B981' }}>
                    {Number(cancelModalBooking.total_quantity_kg || 0).toFixed(2)} kg
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Credit to Restore:</span>{' '}
                  <strong style={{ color: '#10B981' }}>
                    ₹
                    {(
                      Number(cancelModalBooking.sub_credit_used || 0) +
                      Number(cancelModalBooking.razorpay_paid || 0)
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '8px' }}>
                * Razorpay-paid amounts (₹{Number(cancelModalBooking.razorpay_paid || 0).toFixed(2)}) are automatically credited into the customer's Subscription Credit balance.
              </div>
            </div>

            {/* Mandatory Reason Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px' }}>
                Cancellation Reason <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <AdminSelect
                id="select-cancel-reason"
                value={cancelReason}
                onChange={(val) => setCancelReason(val)}
                options={[
                  { value: 'Fish unavailable', label: 'Fish unavailable' },
                  { value: 'Technical issue', label: 'Technical issue' },
                  { value: 'Operational issue', label: 'Operational issue' },
                  { value: 'Other', label: 'Other' },
                ]}
                style={{ width: '100%' }}
              />
            </div>

            {/* Explanatory Notes (Mandatory if Other) */}
            {cancelReason === 'Other' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px' }}>
                  Explanation <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  id="textarea-cancel-notes"
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  placeholder="Provide an operational reason for this cancellation..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#0F2C59',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                id="btn-keep-booking"
                onClick={closeCancelModal}
                disabled={cancelling}
                style={{
                  background: '#E2E8F0',
                  border: 'none',
                  color: '#425B73',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                }}
              >
                Keep Booking
              </button>

              <button
                id="btn-confirm-cancellation"
                onClick={handleConfirmCancellation}
                disabled={cancelling}
                style={{
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {cancelling ? 'Restoring & Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
