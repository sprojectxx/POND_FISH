'use client';

/**
 * WP-06 to WP-10 — Worker Booking Details, Preparation & Handover Completion Page
 * Traceability: PondFish Worker Portal Spec (Sections 14, 15, 16, 17, 18, 69)
 * Full order fulfillment sequence: review items, preparation checklist (PENDING_COLLECTION),
 * payment verification, handover confirmation, and atomic completion with QR invalidation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function WorkerBookingDetailsPage({ params }) {
  const router = useRouter();
  const bookingId = params.id;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Preparation & Completion state
  const [preparing, setPreparing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedTxn, setCompletedTxn] = useState(null);
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  const [prepChecklist, setPrepChecklist] = useState({
    inspected: false,
    cutAndCleaned: false,
    packed: false,
  });

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const res = await fetch(`/api/v1/worker/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          router.replace('/worker/login');
          return;
        }
        setError(json.error?.message || 'Unable to retrieve booking details.');
        return;
      }

      setBooking(json.data);
      if (json.data.status === 'COMPLETED') {
        setCompleted(true);
      }
    } catch {
      setError('Unable to reach the server. Please check connection.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Handle transition: CONFIRMED -> PENDING_COLLECTION
  async function handleMarkPreparing() {
    setPreparing(true);
    const token = localStorage.getItem('pondfish_worker_token');

    try {
      const res = await fetch(`/api/v1/worker/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'PENDING_COLLECTION' }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || 'Failed to update preparation status.');
        return;
      }

      setBooking(json.data);
    } catch {
      alert('Network failure. Could not update status.');
    } finally {
      setPreparing(false);
    }
  }

  // Handle final completion: PENDING_COLLECTION -> COMPLETED
  async function handleCompleteOrder() {
    if (!handoverConfirmed) {
      alert('Please confirm that the fresh fish has been physically handed over to the customer.');
      return;
    }

    setCompleting(true);
    const token = localStorage.getItem('pondfish_worker_token');

    try {
      const res = await fetch(`/api/v1/worker/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || 'Failed to finalize order completion.');
        return;
      }

      setCompleted(true);
      setCompletedTxn(json.data?.transaction || null);
      if (json.data?.booking) {
        setBooking(json.data.booking);
      }
    } catch {
      alert('Network failure during order finalization.');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
        Loading booking details...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div style={{ width: '48px', height: '48px', margin: '0 auto 14px', borderRadius: '12px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#DC2626', marginBottom: '8px' }}>
          Booking Unavailable
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px' }}>{error || 'Booking not found.'}</p>
        <Link
          href="/worker/bookings"
          style={{
            background: '#1E56A0',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            textDecoration: 'none',
          }}
        >
          ← Return to Booking Queue
        </Link>
      </div>
    );
  }

  const items = booking.items || [];
  const expiresAt = new Date(booking.expires_at);
  const isExpired = expiresAt < new Date() && booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED';
  const isTerminal = booking.status === 'COMPLETED' || booking.status === 'CANCELLED' || isExpired;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Breadcrumb & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          href="/worker/bookings"
          style={{ color: '#1E56A0', fontSize: '13px', fontWeight: '800', textDecoration: 'none' }}
        >
          ← Back to Booking Queue
        </Link>
        <div style={{ fontSize: '12px', color: '#64748B' }}>
          Booking Ref: <strong style={{ color: '#0F2C59' }}>{booking.booking_code}</strong>
        </div>
      </div>

      {/* Completion Banner if successfully fulfilled */}
      {completed && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '16px',
            padding: '20px 24px',
            color: '#166534',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: '800', color: '#15803D' }}>
            <span>✓</span> Booking Completed & Fulfilled Successfully!
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#166534' }}>
            The fresh catch has been handed over to the customer. Reserved inventory has been permanently consumed and the customer&apos;s digital QR ticket has been invalidated.
          </p>
          {completedTxn && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#15803D', fontWeight: '600' }}>
              Authoritative Transaction Reference: <strong>{completedTxn.transaction_number}</strong>
            </div>
          )}
        </div>
      )}

      {/* Main Order Card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        {/* Card Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#F8FAFC',
          }}
        >
          <div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F2C59', letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
              {booking.booking_code}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Created: {new Date(booking.created_at).toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '800',
                textTransform: 'uppercase',
                background:
                  booking.status === 'COMPLETED'
                    ? '#DCFCE7'
                    : booking.status === 'PENDING_COLLECTION'
                    ? '#FEF3C7'
                    : '#E0F2FE',
                color:
                  booking.status === 'COMPLETED'
                    ? '#166534'
                    : booking.status === 'PENDING_COLLECTION'
                    ? '#B45309'
                    : '#0369A1',
                border:
                  booking.status === 'COMPLETED'
                    ? '1px solid #BBF7D0'
                    : booking.status === 'PENDING_COLLECTION'
                    ? '1px solid #FDE68A'
                    : '1px solid #BAE6FD',
              }}
            >
              {booking.status}
            </span>
          </div>
        </div>

        {/* Card Content Grid */}
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {/* Column 1: Customer Details */}
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.06em', margin: '0 0 12px 0' }}>
              Customer Details
            </h3>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
                {booking.customer_name || 'Valued Customer'}
              </div>
              <div style={{ fontSize: '13px', color: '#1E56A0', marginBottom: '8px', fontWeight: '600' }}>
                {booking.customer_phone || 'Registered Mobile'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Pickup Window: <span style={{ color: isExpired ? '#DC2626' : '#0F2C59', fontWeight: '700' }}>
                  {isExpired ? 'EXPIRED' : expiresAt.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Financial & Payment Status */}
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.06em', margin: '0 0 12px 0' }}>
              Financial & Payment State
            </h3>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>Order Gross Total:</span>
                <span style={{ fontWeight: '700', color: '#0F2C59' }}>₹{booking.total_amount}</span>
              </div>
              {booking.sub_credit_used > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748B' }}>Subscription Credit:</span>
                  <span style={{ fontWeight: '700', color: '#15803D' }}>-₹{booking.sub_credit_used}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>Online Paid (Razorpay):</span>
                <span style={{ fontWeight: '700', color: '#1E56A0' }}>₹{booking.razorpay_paid}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  fontWeight: '800',
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '8px',
                  marginTop: '4px',
                }}
              >
                <span style={{ color: '#0F2C59' }}>Counter Balance Due:</span>
                <span style={{ color: '#15803D' }}>₹0 (Fully Paid)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Reserved Catch Line Items */}
        <div style={{ padding: '0 24px 24px 24px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.06em', margin: '0 0 12px 0' }}>
            Reserved Catch Items ({items.length})
          </h3>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', color: '#0F2C59', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '800' }}>Fish Variety</th>
                  <th style={{ padding: '12px 16px', fontWeight: '800' }}>Reserved Weight</th>
                  <th style={{ padding: '12px 16px', fontWeight: '800' }}>Unit Price</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0F2C59' }}>
                      {item.fish_name}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#1E56A0', fontWeight: '800' }}>
                      {item.quantity_kg} kg
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748B' }}>
                      ₹{item.unit_price}/kg
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#0F2C59' }}>
                      ₹{item.subtotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: Preparation Checklist (WP-07) */}
        {!isTerminal && (
          <div style={{ padding: '24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F2C59', margin: '0 0 12px 0' }}>
              Order Preparation & Physical Verification Checklist
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#425B73', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prepChecklist.inspected}
                  onChange={(e) => setPrepChecklist({ ...prepChecklist, inspected: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                1. Fresh catch inspected from cold storage and weighed to exact reserved quantities.
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#425B73', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prepChecklist.cutAndCleaned}
                  onChange={(e) => setPrepChecklist({ ...prepChecklist, cutAndCleaned: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                2. Descaling, cutting, and dressing performed per customer preference.
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#425B73', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prepChecklist.packed}
                  onChange={(e) => setPrepChecklist({ ...prepChecklist, packed: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                3. Packed securely in hygienic leakproof container for customer pickup.
              </label>
            </div>

            {booking.status === 'CONFIRMED' && (
              <button
                onClick={handleMarkPreparing}
                disabled={preparing}
                style={{
                  background: '#1E56A0',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '11px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: preparing ? 'not-allowed' : 'pointer',
                  opacity: preparing ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
                }}
              >
                {preparing ? 'Updating Status...' : 'Mark as In-Preparation (PENDING_COLLECTION) →'}
              </button>
            )}
          </div>
        )}

        {/* Section: Handover Confirmation & Completion (WP-09 / WP-10) */}
        {!isTerminal && (
          <div style={{ padding: '24px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F2C59', margin: '0 0 12px 0' }}>
              Final Order Handover & Fulfillment
            </h3>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '16px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={handoverConfirmed}
                onChange={(e) => setHandoverConfirmed(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: '#0F2C59', lineHeight: 1.4 }}>
                <strong>Confirm Physical Handover:</strong> I verify that the packaged fresh fish has been physically handed over to the customer and the customer&apos;s digital ticket is being completed.
              </span>
            </label>

            <button
              onClick={handleCompleteOrder}
              disabled={completing || !handoverConfirmed}
              style={{
                width: '100%',
                padding: '16px',
                background: '#15803D',
                border: 'none',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: '800',
                cursor: completing || !handoverConfirmed ? 'not-allowed' : 'pointer',
                opacity: completing || !handoverConfirmed ? 0.4 : 1,
                boxShadow: '0 4px 12px rgba(21, 128, 61, 0.25)',
              }}
            >
              {completing
                ? 'Consuming Reserved Inventory & Finalizing Booking...'
                : '✓ Complete Booking & Finalize Handover'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
