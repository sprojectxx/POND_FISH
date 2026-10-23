'use client';

/**
 * WP-03 — Worker Booking Queue Page
 * Traceability: PondFish Worker Portal Spec (Section 11)
 * Tabbed/filtered view of all store bookings (ALL, CONFIRMED, PENDING_COLLECTION, COMPLETED, EXPIRED).
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_TABS = [
  { key: 'ALL', label: 'All Bookings' },
  { key: 'CONFIRMED', label: 'Ready for Pickup' },
  { key: 'PENDING_COLLECTION', label: 'Preparing' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'EXPIRED', label: 'Expired' },
];

export default function WorkerBookingQueuePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ALL');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const statusParam = activeTab === 'ALL' ? '' : `status=${activeTab}`;
      const res = await fetch(`/api/v1/worker/bookings/today?${statusParam}&limit=100`, {
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          router.replace('/worker/login');
          return;
        }
        setError(json.error?.message || 'Unable to load bookings.');
        return;
      }

      setBookings(json.data || []);
    } catch {
      setError('Unable to reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0F2C59', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Store Booking Queue
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
            Operational list of customer orders by lifecycle status
          </p>
        </div>
        <Link
          href="/worker/bookings/scan"
          style={{
            background: '#1E56A0',
            color: '#FFFFFF',
            textDecoration: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          Scan QR Code
        </Link>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '14px',
          marginBottom: '20px',
          overflowX: 'auto',
        }}
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              border: '1px solid',
              background: activeTab === tab.key ? '#1E56A0' : '#FFFFFF',
              color: activeTab === tab.key ? '#FFFFFF' : '#425B73',
              borderColor: activeTab === tab.key ? '#1E56A0' : '#CBD5E1',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === tab.key ? '0 2px 8px rgba(30, 86, 160, 0.2)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        {error && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#DC2626', fontSize: '14px', backgroundColor: '#FEF2F2' }}>
            {error}
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={fetchBookings}
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

        {loading && !error && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
            Loading bookings for {activeTab}...
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', margin: '0 auto 14px', borderRadius: '12px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>
              No bookings match this filter
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              There are currently no bookings with status &quot;{activeTab}&quot;.
            </p>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {bookings.map((booking) => {
              const expiresAt = new Date(booking.expires_at);
              const createdAt = new Date(booking.created_at);

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
                      {booking.item_count || 1} catch varieties • {booking.total_quantity_kg || 0} kg • Total: ₹{booking.total_amount}
                      <span style={{ marginLeft: '12px', color: '#64748B' }}>
                        Booked: {createdAt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ marginLeft: '12px', color: '#64748B' }}>
                        Expires: {expiresAt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                    Open Details →
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
