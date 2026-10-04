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

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const statusParam = activeTab === 'ALL' ? '' : `status=${activeTab}`;
      const res = await fetch(`/api/v1/worker/bookings/today?${statusParam}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
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
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 4px 0' }}>
            Store Booking Queue
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Operational list of customer orders by lifecycle status
          </p>
        </div>
        <Link
          href="/worker/bookings/scan"
          style={{
            background: '#0284C7',
            color: '#FFFFFF',
            textDecoration: 'none',
            padding: '9px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          📷 Scan QR Code
        </Link>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #1E293B',
          paddingBottom: '12px',
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
              border: 'none',
              background: activeTab === tab.key ? '#0284C7' : '#1E293B',
              color: activeTab === tab.key ? '#FFFFFF' : '#94A3B8',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Card */}
      <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', overflow: 'hidden' }}>
        {error && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#EF4444', fontSize: '14px' }}>
            {error}
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={fetchBookings}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {loading && !error && (
          <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            Loading bookings for {activeTab}...
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC', marginBottom: '6px' }}>
              No bookings match this filter
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
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
