'use client';

/**
 * WP-02 — Worker Dashboard & Active Orders
 * Traceability: PondFish Worker Portal Spec (Section 10)
 * Fast operational overview, real-time counters, quick actions, and active booking queue.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function WorkerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({
    confirmed: 0,
    pendingCollection: 0,
    completedToday: 0,
    expired: 0,
    total: 0,
  });
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const res = await fetch('/api/v1/worker/bookings/today?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          router.replace('/worker/login');
          return;
        }
        setError(json.error?.message || 'Unable to load today\'s bookings.');
        return;
      }

      setBookings(json.data || []);
      setCounts(json.counts || {});
    } catch {
      setError('We couldn\'t load today\'s bookings. Check connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  function getStatusBadge(status, expiresAt) {
    const isExpired = new Date(expiresAt) < new Date() && status !== 'COMPLETED' && status !== 'CANCELLED';
    const display = isExpired ? 'EXPIRED' : status;

    let bg = '#F1F5F9';
    let color = '#64748B';
    let border = '#CBD5E1';
    let text = display;

    if (display === 'CONFIRMED') {
      bg = '#E0F2FE';
      color = '#0369A1';
      border = '#BAE6FD';
      text = 'Ready for Pickup';
    } else if (display === 'PENDING_COLLECTION') {
      bg = '#FEF3C7';
      color = '#B45309';
      border = '#FDE68A';
      text = 'Preparing Fish';
    } else if (display === 'COMPLETED') {
      bg = '#DCFCE7';
      color = '#166534';
      border = '#BBF7D0';
      text = 'Collected';
    } else if (display === 'CANCELLED' || display === 'EXPIRED') {
      bg = '#FEE2E2';
      color = '#DC2626';
      border = '#FECACA';
    }

    return (
      <span
        style={{
          background: bg,
          color: color,
          border: `1px solid ${border}`,
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <div>
      {/* Page Title & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 4px 0', color: '#0F2C59', letterSpacing: '-0.02em' }}>
            Store Counter Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
            Real-time customer bookings queue and counter operations
          </p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#0F2C59',
            padding: '9px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          {loading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="pf-worker-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Awaiting Collection
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#1E56A0', lineHeight: 1.1 }}>
            {counts.confirmed || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Ready for customer arrival
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Preparing in Store
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#D97706', lineHeight: 1.1 }}>
            {counts.pendingCollection || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Descaling / cutting in progress
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Completed Today
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#15803D', lineHeight: 1.1 }}>
            {counts.completedToday || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Handed over to customers
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Expired / Void
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#DC2626', lineHeight: 1.1 }}>
            {counts.expired || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Lapsed 48-hour pickup window
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="pf-worker-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <Link
          id="btn-worker-instore-sale"
          href="/worker/customers"
          style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #15803D, #16A34A)',
            borderRadius: '14px',
            padding: '20px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 6px 18px rgba(22, 163, 74, 0.25)',
          }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800' }}>In-Store Counter Sale</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>Scale slip OCR & cash checkout</div>
          </div>
        </Link>

        <Link
          id="btn-worker-customer-search"
          href="/worker/customers"
          style={{
            textDecoration: 'none',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '20px',
            color: '#0F2C59',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59' }}>Customer Search</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Lookup subscriptions & credit</div>
          </div>
        </Link>

        <Link
          id="btn-worker-scan-qr"
          href="/worker/bookings/scan"
          style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #1E56A0, #2563EB)',
            borderRadius: '14px',
            padding: '20px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 6px 18px rgba(30, 86, 160, 0.25)',
          }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800' }}>Scan Booking QR</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>Camera pickup ticket verify</div>
          </div>
        </Link>

        <Link
          id="btn-worker-booking-lookup"
          href="/worker/bookings/search"
          style={{
            textDecoration: 'none',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '20px',
            color: '#0F2C59',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59' }}>Booking Lookup</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Search by code, name, phone</div>
          </div>
        </Link>
      </div>

      {/* Active Booking Queue Card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
            Today's Active Store Bookings ({bookings.length})
          </h2>
          <Link
            href="/worker/bookings"
            style={{ fontSize: '13px', color: '#1E56A0', fontWeight: '800', textDecoration: 'none' }}
          >
            View Full Queue →
          </Link>
        </div>

        {/* Error Notice */}
        {error && (
          <div style={{ padding: '24px', color: '#DC2626', fontSize: '14px', textAlign: 'center', backgroundColor: '#FEF2F2' }}>
            {error}
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={fetchQueue}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0F2C59',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !error && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
            Loading store booking queue...
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', margin: '0 auto 14px', borderRadius: '12px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>
              No active bookings waiting for action
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              New online bookings placed by customers will appear here automatically.
            </p>
          </div>
        )}

        {/* Booking Items List */}
        {!loading && !error && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {bookings.map((booking) => {
              const expiresAt = new Date(booking.expires_at);
              return (
                <div
                  key={booking.id}
                  className="pf-worker-booking-item"
                  style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#0F2C59', fontFamily: 'monospace' }}>
                        {booking.booking_code}
                      </span>
                      {getStatusBadge(booking.status, booking.expires_at)}
                    </div>
                    <div style={{ fontSize: '13px', color: '#425B73', marginBottom: '4px' }}>
                      <strong style={{ color: '#0F2C59' }}>{booking.customer_name}</strong> • {booking.customer_phone || 'Customer'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      {booking.item_count || 1} catch items ({booking.total_quantity_kg || 0} kg) • ₹{booking.total_amount}
                      <span style={{ marginLeft: '10px', color: '#64748B', fontWeight: '600' }}>
                        Expires: {expiresAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/worker/bookings/${booking.id}`)}
                    style={{
                      background: '#1E56A0',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
                    }}
                  >
                    Open Booking →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
