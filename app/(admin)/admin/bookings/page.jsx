'use client';

/**
 * ADMIN-12 — Bookings Management Module
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 96–105)
 * - PondFish Core Business Engines Specification v1 (Sections 13, 14)
 * - Slice 16 Scope: Admin Booking Visibility, Search, Filtering, Detail & Operational Cancellation
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';

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
    limit: 20,
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

  // Fetch Bookings with Query Parameters
  const fetchBookings = useCallback(
    async (pageToLoad = pagination.page) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', '20');

        if (search.trim()) params.set('search', search.trim());
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
    [pagination.page, search, statusFilter, sourceFilter, dateFrom, dateTo]
  );

  // Initial load and filter change trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        fetchBookings(1);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [search, statusFilter, sourceFilter, dateFrom, dateTo]);

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
    <div style={{ maxWidth: '1440px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
              Bookings Management
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                background: '#E8F1F5', color: '#1E56A0',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              ADMIN-12
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '6px 0 0' }}>
            Supervise online customer bookings, monitor 48-hour pickup expiration, inspect worker collection state, and perform approved operational cancellations.
          </p>
        </div>

        <button
          id="btn-refresh-bookings"
          onClick={() => fetchBookings(pagination.page)}
          disabled={loading}
          style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E56A0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Refresh
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
            ✕
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
          <span>✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Status Counters Dashboard */}
      <div
        className="pf-admin-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          onClick={() => setStatusFilter('ALL')}
          style={{
            background: statusFilter === 'ALL' ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${statusFilter === 'ALL' ? '#38BDF8' : '#E2E8F0'}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>
            All Bookings
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0F2C59', marginTop: '4px' }}>
            {counts.all || 0}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('CONFIRMED')}
          style={{
            background: statusFilter === 'CONFIRMED' ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${statusFilter === 'CONFIRMED' ? '#38BDF8' : '#E2E8F0'}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '600', textTransform: 'uppercase' }}>
            Confirmed
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#38BDF8', marginTop: '4px' }}>
            {counts.confirmed || 0}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('PENDING_COLLECTION')}
          style={{
            background: statusFilter === 'PENDING_COLLECTION' ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${statusFilter === 'PENDING_COLLECTION' ? '#F59E0B' : '#E2E8F0'}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '600', textTransform: 'uppercase' }}>
            Preparing / Collection
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#F59E0B', marginTop: '4px' }}>
            {counts.pendingCollection || 0}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('COMPLETED')}
          style={{
            background: statusFilter === 'COMPLETED' ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${statusFilter === 'COMPLETED' ? '#10B981' : '#E2E8F0'}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#10B981', fontWeight: '600', textTransform: 'uppercase' }}>
            Completed
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>
            {counts.completed || 0}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('CANCELLED')}
          style={{
            background: statusFilter === 'CANCELLED' ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${statusFilter === 'CANCELLED' ? '#EF4444' : '#E2E8F0'}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600', textTransform: 'uppercase' }}>
            Cancelled
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#EF4444', marginTop: '4px' }}>
            {counts.cancelled || 0}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('EXPIRED')}
          style={{
            background: statusFilter === 'EXPIRED' ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${statusFilter === 'EXPIRED' ? '#94A3B8' : '#E2E8F0'}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>
            Expired (48h)
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#64748B', marginTop: '4px' }}>
            {counts.expired || 0}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Search Input */}
        <div style={{ flex: '1 1 260px', width: '100%', minWidth: 0, position: 'relative' }}>
          <input
            id="input-search-bookings"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Booking ID, Customer, Phone, Fish, or Amount..."
            style={{
              width: '100%',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#0F2C59',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status Dropdown */}
        <select
          id="select-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            flex: '1 1 130px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#0F2C59',
            fontSize: '13px',
            boxSizing: 'border-box',
            minWidth: 0,
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="CREATED">Created</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PENDING_COLLECTION">Pending Collection</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>

        {/* Source Dropdown */}
        <select
          id="select-source-filter"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={{
            flex: '1 1 130px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#0F2C59',
            fontSize: '13px',
            boxSizing: 'border-box',
            minWidth: 0,
          }}
        >
          <option value="ALL">All Sources</option>
          <option value="Online">Online</option>
          <option value="Physical-store">Physical-store</option>
        </select>

        {/* Date From */}
        <div style={{ flex: '1 1 130px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>FROM</span>
          <input
            id="input-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              flex: 1,
              width: '100%',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '9px 10px',
              color: '#0F2C59',
              fontSize: '13px',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          />
        </div>

        {/* Date To */}
        <div style={{ flex: '1 1 130px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>TO</span>
          <input
            id="input-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              flex: 1,
              width: '100%',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '9px 10px',
              color: '#0F2C59',
              fontSize: '13px',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          />
        </div>

        {hasActiveFilters && (
          <button
            id="btn-clear-filters"
            onClick={clearFilters}
            style={{
              background: '#E2E8F0',
              border: 'none',
              color: '#425B73',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: '600',
              boxSizing: 'border-box',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bookings Table Card */}
      <div
        className="pf-admin-table-card"
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
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
          ↔ Scroll horizontally to view all columns
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
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Booking ID</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Customer</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Source</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Fish &amp; Quantity</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Total Payment</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Sub / Add. Payment</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Created</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Expiry / Collection Time</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>

                    <div>Loading bookings queue...</div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>

                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#425B73' }}>No bookings found</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                      {hasActiveFilters
                        ? 'Try modifying search keywords or clearing active filters.'
                        : 'No customer bookings currently recorded.'}
                    </div>
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
                      }}
                    >
                      {/* Booking ID */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#38BDF8', fontFamily: 'monospace' }}>
                          {b.booking_code}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                          {b.id.substring(0, 8)}...
                        </div>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0F2C59' }}>
                          {b.customer_name || 'Retail Customer'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                          +91 {b.customer_phone || '—'}
                        </div>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: 'rgba(2, 132, 199, 0.15)',
                            color: '#38BDF8',
                            border: '1px solid #0284C7',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        >
                          Online
                        </span>
                      </td>

                      {/* Fish & Quantity */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0F2C59' }}>
                          {b.fish_names || 'Fish item'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '600' }}>
                          {Number(b.total_quantity_kg || 0).toFixed(2)} kg
                          <span style={{ color: '#64748B', fontWeight: '400', marginLeft: '6px' }}>
                            ({b.item_count || 1} {b.item_count === 1 ? 'item' : 'items'})
                          </span>
                        </div>
                      </td>

                      {/* Total Payment */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#0F2C59' }}>
                          ₹{Number(b.total_amount || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Subscription & Additional Payment */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '12px', color: b.sub_credit_used > 0 ? '#10B981' : '#64748B' }}>
                          Sub: ₹{Number(b.sub_credit_used || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '12px', color: b.razorpay_paid > 0 ? '#38BDF8' : '#64748B' }}>
                          Add: ₹{Number(b.razorpay_paid || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: cfg.bg,
                            color: cfg.text,
                            border: `1px solid ${cfg.border}`,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {cfg.label}
                        </span>
                      </td>

                      {/* Created */}
                      <td style={{ padding: '14px 16px', color: '#425B73', fontSize: '12px' }}>
                        <div>{new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Expiry / Collection Time */}
                      <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                        {isCompleted ? (
                          <div>
                            <span style={{ color: '#10B981', fontWeight: '600' }}>✓ Fulfilled</span>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
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
                          <div style={{ color: '#EF4444', fontSize: '11px' }}>Cancelled</div>
                        ) : (
                          <div>
                            <div style={{ color: isExpired ? '#EF4444' : '#F59E0B', fontWeight: '500' }}>
                              {isExpired ? 'Expired window' : '48h Expiry'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
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
                              background: '#E2E8F0',
                              border: 'none',
                              color: '#0F2C59',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Details
                          </button>

                          {isCancellable && (
                            <button
                              id={`btn-cancel-${b.id}`}
                              onClick={() => openCancelModal(b)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid #EF4444',
                                color: '#EF4444',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
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

        {/* Pagination Toolbar */}
        <div
          className="pf-admin-pagination-bar"
          style={{
            padding: '14px 20px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748B',
          }}
        >
          <div>
            Showing{' '}
            <strong style={{ color: '#0F2C59' }}>
              {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong style={{ color: '#0F2C59' }}>
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{' '}
            of <strong style={{ color: '#0F2C59' }}>{pagination.total}</strong> bookings
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              id="btn-prev-page"
              onClick={() => fetchBookings(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: pagination.page <= 1 ? '#475569' : '#CBD5E1',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ padding: '0 4px', color: '#0F2C59', fontWeight: '600' }}>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              id="btn-next-page"
              onClick={() => fetchBookings(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: pagination.page >= pagination.totalPages ? '#475569' : '#CBD5E1',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
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
                ✕
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
                        📋 Audit Trail
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
              <select
                id="select-cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#0F2C59',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Fish unavailable">Fish unavailable</option>
                <option value="Technical issue">Technical issue</option>
                <option value="Operational issue">Operational issue</option>
                <option value="Other">Other</option>
              </select>
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
