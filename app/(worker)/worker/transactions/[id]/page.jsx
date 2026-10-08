'use client';

/**
 * Screen: WP-10 — Counter Transaction Result & Digital Receipt
 * Traceability: PondFish Worker Portal Spec (WP-10) & Master PRD v2 (Section 7, 11)
 * Displays finalized in-store counter purchase confirmation, line items summary,
 * subscription credit deduction, cash paid amount, and staff attribution.
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

function TransactionResultContent() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params?.id;

  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState(null);
  const [error, setError] = useState(null);

  const fetchTransaction = useCallback(async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const res = await fetch(`/api/v1/worker/transactions/${transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to retrieve transaction details.');
        setLoading(false);
        return;
      }

      setTx(json.data);
    } catch {
      setError('Network communication failed. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [transactionId, router]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '60px auto', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC' }}>Loading Receipt...</h2>
      </div>
    );
  }

  if (error && !tx) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', background: '#0F172A', border: '1px solid #EF4444', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '42px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#EF4444', marginBottom: '8px' }}>
          Transaction Not Found
        </h2>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px' }}>
          {error}
        </p>
        <Link
          href="/worker"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#0284C7',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: '700',
            textDecoration: 'none',
          }}
        >
          Return to Counter Dashboard
        </Link>
      </div>
    );
  }

  const items = tx?.items || [];
  const totalAmount = tx?.totalBillAmount || 0;
  const subCreditUsed = tx?.subCreditUsed || 0;
  const finalPaid = tx?.finalPaidAmount || 0;
  const workerName = tx?.workerAttribution?.workerName || 'Store Counter Staff';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Success Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(21, 128, 61, 0.1))',
          border: '1px solid #22C55E',
          borderRadius: '16px',
          padding: '28px',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#22C55E', margin: '0 0 6px 0' }}>
          Counter Sale Completed!
        </h1>
        <p style={{ fontSize: '14px', color: '#F8FAFC', margin: 0 }}>
          Physical inventory deducted & transaction broadcasted to Shop TV in real-time
        </p>
      </div>

      {/* Authoritative Receipt Card */}
      <div
        style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
        }}
      >
        {/* Receipt Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1E293B', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
              Transaction Receipt
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginTop: '2px' }}>
              {tx?.transactionNumber}
            </div>
            <div style={{ fontSize: '12px', color: '#38BDF8', marginTop: '2px', fontWeight: '700' }}>
              Scale Bill: {tx?.billNumber}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22C55E',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800',
                textTransform: 'uppercase',
              }}
            >
              ✓ {tx?.status || 'COMPLETED'}
            </span>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
              {new Date(tx?.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} • {new Date(tx?.createdAt).toLocaleDateString('en-IN')}
            </div>
          </div>
        </div>

        {/* Customer & Staff Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#0B1120', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
          <div>
            <div style={{ color: '#64748B', fontWeight: '700', textTransform: 'uppercase', fontSize: '11px', marginBottom: '2px' }}>
              Customer
            </div>
            <div style={{ color: '#F8FAFC', fontWeight: '700' }}>
              {tx?.customerName}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748B', fontWeight: '700', textTransform: 'uppercase', fontSize: '11px', marginBottom: '2px' }}>
              Served By (Worker)
            </div>
            <div style={{ color: '#38BDF8', fontWeight: '700' }}>
              {workerName}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>
            Purchased Catch
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #1E293B',
                  fontSize: '13px',
                  color: '#F8FAFC',
                }}
              >
                <div>
                  <span style={{ fontWeight: '600' }}>{it.fishName}</span>
                  <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: '6px' }}>({it.quantityKg} kg @ ₹{it.unitPrice})</span>
                </div>
                <span style={{ fontWeight: '700' }}>₹{it.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Breakdown */}
        <div style={{ borderTop: '1px solid #1E293B', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
            <span>Total Scale Bill Amount:</span>
            <span style={{ color: '#F8FAFC', fontWeight: '700' }}>₹{totalAmount.toFixed(2)}</span>
          </div>

          {subCreditUsed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22C55E' }}>
              <span>Subscription Credit Applied:</span>
              <span style={{ fontWeight: '700' }}>- ₹{subCreditUsed.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', color: '#F8FAFC', paddingTop: '8px', borderTop: '1px solid #1E293B' }}>
            <span>Final Paid ({tx?.paymentMethod}):</span>
            <span style={{ color: '#22C55E' }}>₹{finalPaid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <Link
          id="btn-new-counter-sale"
          href="/worker/customers"
          style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #0284C7, #0369A1)',
            color: '#FFFFFF',
            padding: '16px',
            borderRadius: '10px',
            fontWeight: '800',
            textAlign: 'center',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          }}
        >
          <span>🛒 New Counter Sale</span>
        </Link>

        <Link
          href="/worker"
          style={{
            textDecoration: 'none',
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#F8FAFC',
            padding: '16px',
            borderRadius: '10px',
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

export default function WorkerTransactionResultPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', color: '#94A3B8', textAlign: 'center' }}>Loading transaction receipt...</div>}>
      <TransactionResultContent />
    </Suspense>
  );
}
