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

    try {
      const res = await fetch(`/api/v1/worker/transactions/${transactionId}`, {
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('pondfish_worker_info');
        router.replace('/worker/login');
        return;
      }

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
      <div style={{ maxWidth: '720px', margin: '60px auto', textAlign: 'center', color: '#64748B' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#E0F2FE', color: '#1E56A0', marginBottom: '16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59' }}>Loading Receipt...</h2>
      </div>
    );
  }

  if (error && !tx) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', background: '#FFFFFF', border: '1px solid #FEE2E2', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', marginBottom: '16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#DC2626', marginBottom: '8px' }}>
          Transaction Not Found
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>
          {error}
        </p>
        <Link
          href="/worker"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #1E56A0, #0F2C59)',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: '700',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(30, 86, 160, 0.2)',
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
          background: '#DCFCE7',
          border: '1px solid #BBF7D0',
          borderRadius: '16px',
          padding: '28px',
          textAlign: 'center',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(22, 101, 52, 0.06)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#FFFFFF', color: '#166534', marginBottom: '12px', boxShadow: '0 2px 8px rgba(22, 101, 52, 0.1)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#166534', margin: '0 0 6px 0' }}>
          Counter Sale Completed!
        </h1>
        <p style={{ fontSize: '14px', color: '#15803D', margin: 0 }}>
          Physical inventory deducted & transaction broadcasted to Shop TV in real-time
        </p>
      </div>

      {/* Authoritative Receipt Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
        }}
      >
        {/* Receipt Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transaction Receipt
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginTop: '2px' }}>
              {tx?.transactionNumber}
            </div>
            <div style={{ fontSize: '12px', color: '#1E56A0', marginTop: '2px', fontWeight: '700' }}>
              Scale Bill: {tx?.billNumber}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                background: '#DCFCE7',
                color: '#166534',
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#F8FAFC', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', border: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ color: '#64748B', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', marginBottom: '2px', letterSpacing: '0.05em' }}>
              Customer
            </div>
            <div style={{ color: '#0F2C59', fontWeight: '700' }}>
              {tx?.customerName}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748B', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', marginBottom: '2px', letterSpacing: '0.05em' }}>
              Served By (Worker)
            </div>
            <div style={{ color: '#1E56A0', fontWeight: '700' }}>
              {workerName}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
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
                  borderBottom: '1px solid #F1F5F9',
                  fontSize: '13px',
                  color: '#0F2C59',
                }}
              >
                <div>
                  <span style={{ fontWeight: '700' }}>{it.fishName}</span>
                  <span style={{ color: '#64748B', fontSize: '12px', marginLeft: '6px' }}>({it.quantityKg} kg @ ₹{it.unitPrice})</span>
                </div>
                <span style={{ fontWeight: '800' }}>₹{it.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Breakdown */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
            <span>Total Scale Bill Amount:</span>
            <span style={{ color: '#0F2C59', fontWeight: '700' }}>₹{totalAmount.toFixed(2)}</span>
          </div>

          {subCreditUsed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803D' }}>
              <span>Subscription Credit Applied:</span>
              <span style={{ fontWeight: '800' }}>- ₹{subCreditUsed.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', color: '#0F2C59', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
            <span>Final Paid ({tx?.paymentMethod}):</span>
            <span style={{ color: '#15803D' }}>₹{finalPaid.toFixed(2)}</span>
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
            background: 'linear-gradient(135deg, #1E56A0, #0F2C59)',
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
            boxShadow: '0 4px 14px rgba(30, 86, 160, 0.25)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span>New Counter Sale</span>
        </Link>

        <Link
          href="/worker"
          style={{
            textDecoration: 'none',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#425B73',
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
