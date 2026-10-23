'use client';

/**
 * Screen: WP-09 — Worker Counter Subscription & Payment Checkout
 * Traceability: PondFish Worker Portal Spec (WP-09) & Master PRD v2 (Section 6, 7, 9, 10, 11)
 * Computes authoritative subscription deduction, displays cash collection interface for workers,
 * and finalizes in-store sales atomically via pos-finalization engine.
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

function BillCheckoutContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const billId = params?.id;
  const customerId = searchParams.get('customerId') || '';
  const customerName = searchParams.get('customerName') || 'Counter Customer';

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [preview, setPreview] = useState(null);
  const paymentMethod = 'CASH'; // Counter transactions accept Cash or Subscription coverage
  const [cashReceived, setCashReceived] = useState('');
  const [committing, setCommitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState(null);

  const fetchCheckoutData = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch bill details
      const billRes = await fetch(`/api/v1/worker/bills/${billId}`, {
        credentials: 'include',
      });
      const billJson = await billRes.json();
      if (!billRes.ok || !billJson.success) {
        if (billRes.status === 401 || billRes.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          router.replace('/worker/login');
          return;
        }
        setError(billJson.error?.message || 'Unable to load bill.');
        setLoading(false);
        return;
      }

      setBill(billJson.data);

      // 2. Fetch authoritative subscription & payable preview
      const previewRes = await fetch(`/api/v1/worker/bills/${billId}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ items: billJson.data.items || [] }),
      });
      const prevJson = await previewRes.json();
      if (!previewRes.ok || !prevJson.success) {
        setError(prevJson.error?.message || 'Unable to calculate subscription breakdown.');
        setLoading(false);
        return;
      }

      setPreview(prevJson.data);
      const payable = prevJson.data.finalPayable || 0;
      setCashReceived(payable > 0 ? String(Math.ceil(payable)) : '0');
    } catch {
      setError('Network communication failed. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [billId, router]);

  useEffect(() => {
    fetchCheckoutData();
  }, [fetchCheckoutData]);

  const handleFinalizeSale = async () => {
    setCommitting(true);
    setError(null);
    setShowConfirmModal(false);

    try {
      const finalPayable = preview?.finalPayable || 0;
      const targetMethod = finalPayable === 0 ? 'SUBSCRIPTION_ONLY' : paymentMethod;

      const payload = {
        billId,
        customerId: customerId || bill?.customerId,
        paymentMethod: targetMethod,
        items: preview?.items || bill?.items || [],
      };

      const res = await fetch('/api/v1/worker/transactions/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Transaction could not be finalized. Please retry.');
        setCommitting(false);
        return;
      }

      const txId = json.data?.id;
      router.push(`/worker/transactions/${txId}`);
    } catch {
      setError('Transaction finalization failed. Please check connection and retry.');
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center', color: '#64748B' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#E0F2FE', color: '#1E56A0', marginBottom: '16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>Calculating Subscription & Fees...</h2>
        <p style={{ fontSize: '13px' }}>Evaluating active weekly limits and monetary credit balances</p>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div style={{ maxWidth: '680px', margin: '40px auto', background: '#FFFFFF', border: '1px solid #FEE2E2', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', marginBottom: '16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#DC2626', marginBottom: '8px' }}>
          Checkout Error
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>
          {error}
        </p>
        <Link
          href={`/worker/bills/${billId}/review?customerId=${customerId}`}
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
          Return to Bill Review
        </Link>
      </div>
    );
  }

  const subCoverage = preview?.subscriptionCoverage;
  const grossTotal = preview?.grossTotal || 0;
  const subCreditUsed = subCoverage?.subCreditUsed || 0;
  const coveredQty = subCoverage?.coveredQuantityKg || 0;
  const finalPayable = preview?.finalPayable || 0;
  const numCashReceived = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, numCashReceived - finalPayable);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <Link
          href={`/worker/bills/${billId}/review?customerId=${customerId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '10px',
            color: '#0F2C59',
            textDecoration: 'none',
            boxShadow: '0 2px 6px rgba(15, 44, 89, 0.04)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F2C59' }}>
            Subscription & Payment Checkout
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Bill {bill?.billNumber} • Customer: {bill?.customerName || customerName}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '16px', color: '#DC2626', marginBottom: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div><strong>Transaction Alert:</strong> {error}</div>
        </div>
      )}

      {/* Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Left Column: Financial Calculation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Itemized Bill Box */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              Scale Slip Line Items
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(preview?.items || []).map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#0F2C59', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div>
                    <span style={{ fontWeight: '700' }}>{it.fishName}</span>
                    <span style={{ color: '#64748B', fontSize: '12px', marginLeft: '6px' }}>({it.quantityKg} kg @ ₹{it.unitPrice})</span>
                  </div>
                  <span style={{ fontWeight: '800' }}>₹{it.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#0F2C59', paddingTop: '10px' }}>
              <span>Gross Scale Total</span>
              <span>₹{grossTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Subscription Benefit Box */}
          <div style={{ background: '#FFFFFF', border: subCoverage?.hasActiveSubscription ? '1px solid #BBF7D0' : '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: subCoverage?.hasActiveSubscription ? '#166534' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Subscription Coverage
              </div>
              {subCoverage?.hasActiveSubscription ? (
                <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                  ACTIVE PLAN
                </span>
              ) : (
                <span style={{ background: '#F1F5F9', color: '#64748B', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                  NO ACTIVE PLAN
                </span>
              )}
            </div>

            {subCoverage?.hasActiveSubscription ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Covered Weight</span>
                  <span style={{ color: '#0F2C59', fontWeight: '700' }}>{coveredQty.toFixed(2)} kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Weekly Quota Remaining</span>
                  <span style={{ color: '#0F2C59', fontWeight: '700' }}>{subCoverage?.weeklyRemainingKg?.toFixed(2) || '0.00'} kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803D', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontWeight: '800' }}>
                  <span>Subscription Credit Applied</span>
                  <span>- ₹{subCreditUsed.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                This customer does not have an active subscription. Total amount is payable at counter.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Counter Payment Collection */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Amount Due
            </div>

            <div style={{ fontSize: '36px', fontWeight: '900', color: finalPayable === 0 ? '#15803D' : '#1E56A0', marginBottom: '16px' }}>
              {finalPayable === 0 ? '₹0.00 (Fully Covered)' : `₹${finalPayable.toFixed(2)}`}
            </div>

            {finalPayable === 0 ? (
              <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '16px', color: '#166534', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>The customer&apos;s subscription credit completely covers this scale bill. No additional cash collection is required.</span>
              </div>
            ) : (
              <div>
                {/* Payment Method Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', background: '#F0F5FA', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F2C59' }}>In-Store Cash Collection</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>Counter Assisted</span>
                </div>

                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', lineHeight: '1.4' }}>
                  Online UPI/Razorpay payments are available on customer self-service app. Counter checkout processes physical Cash payments.
                </div>

                {/* Cash Calculator Box */}
                {paymentMethod === 'CASH' && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Cash Received from Customer (₹)
                      </label>
                      <input
                        id="worker-cash-received-input"
                        type="number"
                        min={finalPayable}
                        step="1"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          color: '#0F2C59',
                          fontSize: '18px',
                          fontWeight: '800',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                      <span style={{ color: '#64748B', fontWeight: '600' }}>Change Due to Customer:</span>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#15803D' }}>
                        ₹{changeDue.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px' }}>
                      Worker cash attribution is permanently logged to your staff record.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <button
              id="btn-confirm-counter-sale"
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={committing || (finalPayable > 0 && numCashReceived < finalPayable)}
              style={{
                width: '100%',
                background: committing
                  ? '#94A3B8'
                  : 'linear-gradient(135deg, #15803D, #166534)',
                border: 'none',
                borderRadius: '10px',
                padding: '16px',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: '800',
                cursor: committing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(22, 101, 52, 0.25)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{committing ? 'Processing Finalization...' : 'Complete Sale & Issue Receipt'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 44, 89, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '32px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(15, 44, 89, 0.15)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#E0F2FE', color: '#1E56A0', marginBottom: '16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F2C59', marginBottom: '8px' }}>
              Confirm Counter Sale Finalization
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', lineHeight: '1.5' }}>
              This action will deduct physical inventory from the store counter, update the customer&apos;s subscription quota, and broadcast this transaction to the Shop TV.
            </p>

            <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '13px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748B' }}>Bill ID:</span>
                <span style={{ color: '#0F2C59', fontWeight: '700' }}>{bill?.billNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748B' }}>Method:</span>
                <span style={{ color: '#1E56A0', fontWeight: '700' }}>{finalPayable === 0 ? 'SUBSCRIPTION' : paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B' }}>Final Paid Amount:</span>
                <span style={{ color: '#15803D' }}>₹{finalPayable.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={committing}
                style={{
                  flex: 1,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#425B73',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                id="btn-confirm-modal-submit"
                type="button"
                onClick={handleFinalizeSale}
                disabled={committing}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #15803D, #166534)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(22, 101, 52, 0.25)',
                }}
              >
                {committing ? 'Committing...' : 'Yes, Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkerBillCheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', color: '#94A3B8', textAlign: 'center' }}>Loading checkout preview...</div>}>
      <BillCheckoutContent />
    </Suspense>
  );
}
