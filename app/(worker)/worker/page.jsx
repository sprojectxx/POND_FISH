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

    let bg = 'rgba(148, 163, 184, 0.15)';
    let color = '#94A3B8';
    let text = display;

    if (display === 'CONFIRMED') {
      bg = 'rgba(56, 189, 248, 0.15)';
      color = '#38BDF8';
      text = 'Ready for Pickup';
    } else if (display === 'PENDING_COLLECTION') {
      bg = 'rgba(250, 204, 21, 0.15)';
      color = '#FACC15';
      text = 'Preparing Fish';
    } else if (display === 'COMPLETED') {
      bg = 'rgba(34, 197, 94, 0.15)';
      color = '#22C55E';
      text = 'Collected';
    } else if (display === 'CANCELLED' || display === 'EXPIRED') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#EF4444';
    }

    return (
      <span
        style={{
          background: bg,
          color: color,
          padding: '4px 10px',
          borderRadius: '6px',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#F8FAFC' }}>
            Store Counter Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Real-time customer bookings queue and counter operations
          </p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          style={{
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#F8FAFC',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Refreshing...' : '↻ Refresh Queue'}
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
            Awaiting Collection
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#38BDF8' }}>
            {counts.confirmed || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Ready for customer arrival
          </div>
        </div>

        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
            Preparing in Store
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#FACC15' }}>
            {counts.pendingCollection || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Descaling / cutting in progress
          </div>
        </div>

        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
            Completed Today
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#22C55E' }}>
            {counts.completedToday || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Handed over to customers
          </div>
        </div>

        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
            Expired / Void
          </div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#EF4444' }}>
            {counts.expired || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Lapsed 48-hour pickup window
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <Link
          href="/worker/bookings/scan"
          style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #0369A1, #0284C7)',
            borderRadius: '12px',
            padding: '20px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ fontSize: '36px' }}>📷</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>Scan Customer QR Code</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Open tablet camera to verify pickup ticket</div>
          </div>
        </Link>

        <Link
          href="/worker/bookings/search"
          style={{
            textDecoration: 'none',
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '20px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '36px' }}>🔍</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>Manual Booking Lookup</div>
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>Search by Booking Code, name, or phone</div>
          </div>
        </Link>
      </div>

      {/* Active Booking Queue Header */}
      <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#F8FAFC' }}>
            Today's Active Store Bookings ({bookings.length})
          </h2>
          <Link
            href="/worker/bookings"
            style={{ fontSize: '13px', color: '#38BDF8', fontWeight: '700', textDecoration: 'none' }}
          >
            View Full Queue →
          </Link>
        </div>

        {/* Error Notice */}
        {error && (
          <div style={{ padding: '20px', color: '#EF4444', fontSize: '14px', textAlign: 'center' }}>
            {error}
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={fetchQueue}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !error && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            Loading store booking queue...
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC', marginBottom: '6px' }}>
              No active bookings waiting for action
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
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
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #1E293B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#F8FAFC' }}>
                        {booking.booking_code}
                      </span>
                      {getStatusBadge(booking.status, booking.expires_at)}
                    </div>
                    <div style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>
                      <strong style={{ color: '#F8FAFC' }}>{booking.customer_name}</strong> • {booking.customer_phone || 'Customer'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {booking.item_count || 1} catch items ({booking.total_quantity_kg || 0} kg) • ₹{booking.total_amount}
                      <span style={{ marginLeft: '8px', color: '#64748B' }}>
                        Expires: {expiresAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/worker/bookings/${booking.id}`)}
                    style={{
                      background: '#0284C7',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
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
