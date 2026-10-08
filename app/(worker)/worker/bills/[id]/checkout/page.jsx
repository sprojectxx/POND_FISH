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
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'RAZORPAY'
  const [cashReceived, setCashReceived] = useState('');
  const [committing, setCommitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState(null);

  const fetchCheckoutData = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      // 1. Fetch bill details
      const billRes = await fetch(`/api/v1/worker/bills/${billId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const billJson = await billRes.json();
      if (!billRes.ok || !billJson.success) {
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
          Authorization: `Bearer ${token}`,
        },
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

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

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
          Authorization: `Bearer ${token}`,
        },
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
      <div style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC' }}>Calculating Subscription & Fees...</h2>
        <p style={{ fontSize: '13px' }}>Evaluating active weekly limits and monetary credit balances</p>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div style={{ maxWidth: '680px', margin: '40px auto', background: '#0F172A', border: '1px solid #EF4444', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '42px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#EF4444', marginBottom: '8px' }}>
          Checkout Error
        </h2>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px' }}>
          {error}
        </p>
        <Link
          href={`/worker/bills/${billId}/review?customerId=${customerId}`}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link
          href={`/worker/bills/${billId}/review?customerId=${customerId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#F8FAFC',
            textDecoration: 'none',
          }}
        >
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#F8FAFC' }}>
            Subscription & Payment Checkout (WP-09)
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Bill {bill?.billNumber} • Customer: {bill?.customerName || customerName}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '12px', padding: '16px', color: '#EF4444', marginBottom: '24px', fontSize: '14px' }}>
          <strong>Transaction Alert:</strong> {error}
        </div>
      )}

      {/* Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Left Column: Financial Calculation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Itemized Bill Box */}
          <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '14px' }}>
              Scale Slip Line Items
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(preview?.items || []).map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#F8FAFC', padding: '6px 0', borderBottom: '1px solid #1E293B' }}>
                  <div>
                    <span style={{ fontWeight: '600' }}>{it.fishName}</span>
                    <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: '6px' }}>({it.quantityKg} kg @ ₹{it.unitPrice})</span>
                  </div>
                  <span style={{ fontWeight: '700' }}>₹{it.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#F8FAFC', paddingTop: '8px' }}>
              <span>Gross Scale Total</span>
              <span>₹{grossTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Subscription Benefit Box */}
          <div style={{ background: '#0F172A', border: subCoverage?.hasActiveSubscription ? '1px solid #15803D' : '1px solid #1E293B', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: subCoverage?.hasActiveSubscription ? '#22C55E' : '#94A3B8', textTransform: 'uppercase' }}>
                Subscription Coverage
              </div>
              {subCoverage?.hasActiveSubscription ? (
                <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                  ACTIVE PLAN
                </span>
              ) : (
                <span style={{ background: '#1E293B', color: '#94A3B8', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                  NO ACTIVE PLAN
                </span>
              )}
            </div>

            {subCoverage?.hasActiveSubscription ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Covered Weight</span>
                  <span style={{ color: '#F8FAFC', fontWeight: '700' }}>{coveredQty.toFixed(2)} kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Weekly Quota Remaining</span>
                  <span style={{ color: '#F8FAFC', fontWeight: '700' }}>{subCoverage?.weeklyRemainingKg?.toFixed(2) || '0.00'} kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22C55E', paddingTop: '8px', borderTop: '1px solid #1E293B', fontWeight: '800' }}>
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
        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Amount Due
            </div>

            <div style={{ fontSize: '36px', fontWeight: '900', color: finalPayable === 0 ? '#22C55E' : '#38BDF8', marginBottom: '16px' }}>
              {finalPayable === 0 ? '₹0.00 (Fully Covered)' : `₹${finalPayable.toFixed(2)}`}
            </div>

            {finalPayable === 0 ? (
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22C55E', borderRadius: '10px', padding: '16px', color: '#22C55E', fontSize: '13px', marginBottom: '20px' }}>
                ✓ The customer&apos;s subscription credit completely covers this scale bill. No additional cash collection is required.
              </div>
            ) : (
              <div>
                {/* Payment Method Selector */}
                <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Select Counter Collection Method
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    style={{
                      background: paymentMethod === 'CASH' ? 'rgba(56, 189, 248, 0.15)' : '#0B1120',
                      border: paymentMethod === 'CASH' ? '2px solid #38BDF8' : '1px solid #334155',
                      borderRadius: '8px',
                      padding: '12px',
                      color: paymentMethod === 'CASH' ? '#38BDF8' : '#94A3B8',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>💵</span>
                    <span>Cash Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('RAZORPAY')}
                    style={{
                      background: paymentMethod === 'RAZORPAY' ? 'rgba(56, 189, 248, 0.15)' : '#0B1120',
                      border: paymentMethod === 'RAZORPAY' ? '2px solid #38BDF8' : '1px solid #334155',
                      borderRadius: '8px',
                      padding: '12px',
                      color: paymentMethod === 'RAZORPAY' ? '#38BDF8' : '#94A3B8',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>📱</span>
                    <span>Online / Razorpay</span>
                  </button>
                </div>

                {/* Cash Calculator Box */}
                {paymentMethod === 'CASH' && (
                  <div style={{ background: '#0B1120', border: '1px solid #334155', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
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
                          background: '#0F172A',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '18px',
                          fontWeight: '800',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', paddingTop: '8px', borderTop: '1px solid #1E293B' }}>
                      <span style={{ color: '#94A3B8' }}>Change Due to Customer:</span>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#FACC15' }}>
                        ₹{changeDue.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
                      ℹ️ Note: Worker cash attribution is permanently logged to your staff record.
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
              disabled={committing || (paymentMethod === 'CASH' && finalPayable > 0 && numCashReceived < finalPayable)}
              style={{
                width: '100%',
                background: committing
                  ? '#475569'
                  : 'linear-gradient(135deg, #16A34A, #15803D)',
                border: 'none',
                borderRadius: '10px',
                padding: '16px',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: '800',
                cursor: committing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
            >
              {committing ? 'Processing Finalization...' : '✓ Complete Sale & Issue Receipt'}
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
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🛒</div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
              Confirm Counter Sale Finalization
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px', lineHeight: '1.5' }}>
              This action will deduct physical inventory from the store counter, update the customer&apos;s subscription quota, and broadcast this transaction to the Shop TV.
            </p>

            <div style={{ background: '#0B1120', borderRadius: '10px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94A3B8' }}>Bill ID:</span>
                <span style={{ color: '#F8FAFC', fontWeight: '700' }}>{bill?.billNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94A3B8' }}>Method:</span>
                <span style={{ color: '#38BDF8', fontWeight: '700' }}>{finalPayable === 0 ? 'SUBSCRIPTION' : paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800' }}>
                <span style={{ color: '#94A3B8' }}>Final Paid Amount:</span>
                <span style={{ color: '#22C55E' }}>₹{finalPayable.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={committing}
                style={{
                  flex: 1,
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#F8FAFC',
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
                  background: 'linear-gradient(135deg, #16A34A, #15803D)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
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
