'use client';

/**
 * Screen: WP-08 — AI Bill Review & Line Items Verification
 * Traceability: PondFish Worker Portal Spec (WP-08) & Master PRD v2 (Section 8.2, 8.3)
 * Allows tablet counter workers to inspect Tesseract.js OCR extraction, verify fish cuts,
 * weights, unit prices, manually correct or enter Bill Number, or trigger re-scan before checkout.
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

function BillReviewContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const billId = params?.id;
  const customerId = searchParams.get('customerId') || '';

  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState(null);
  const [billNumber, setBillNumber] = useState('');
  const [savingBillNumber, setSavingBillNumber] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  const fetchBillDetails = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const res = await fetch(`/api/v1/worker/bills/${billId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          router.replace('/worker/login');
          return;
        }
        setError(json.error?.message || 'Failed to load bill extraction details.');
        return;
      }

      setBillData(json.data);
      setBillNumber(json.data.billNumber || '');
    } catch {
      setError('Network communication failed. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [billId, router]);

  useEffect(() => {
    fetchBillDetails();
  }, [fetchBillDetails]);

  const handleUpdateBillNumber = async (e) => {
    e?.preventDefault();
    if (!billNumber || !billNumber.trim()) {
      setError('Please enter a valid Bill Number from the printed scale ticket.');
      return;
    }

    setSavingBillNumber(true);
    setError(null);
    setSaveSuccess(false);

    const token = localStorage.getItem('pondfish_worker_token');
    try {
      const res = await fetch(`/api/v1/worker/bills/${billId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ billNumber: billNumber.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to update Bill Number.');
        return;
      }

      setSaveSuccess(true);
      setBillData((prev) => (prev ? { ...prev, billNumber: json.data.billNumber } : prev));
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Failed to update Bill Number. Please retry.');
    } finally {
      setSavingBillNumber(false);
    }
  };

  const handleProceedToCheckout = () => {
    const activeBillNum = billNumber || billData?.billNumber;
    if (!activeBillNum || !activeBillNum.trim()) {
      setError('A valid Bill ID is required before proceeding to checkout. Please enter the Bill ID from the paper slip.');
      return;
    }

    const query = new URLSearchParams({
      customerId: customerId || billData?.customerId || '',
      customerName: billData?.customerName || '',
    });

    router.push(`/worker/bills/${billId}/checkout?${query.toString()}`);
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
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>Loading Bill Extraction...</h2>
        <p style={{ fontSize: '13px' }}>Matching scanned weights and prices against fish catalogue</p>
      </div>
    );
  }

  if (error && !billData) {
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
          Unable to Load Bill
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>
          {error}
        </p>
        <Link
          href="/worker/customers"
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
          Return to Customer Directory
        </Link>
      </div>
    );
  }

  const confidencePercent = Math.round((billData?.aiConfidenceScore || 0) * 100);
  const isConfidenceGood = confidencePercent >= 70;
  const items = billData?.items || [];
  const totalAmount = billData?.total || items.reduce((acc, it) => acc + (it.subtotal || 0), 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <Link
          href={`/worker/bills/capture?customerId=${customerId || billData?.customerId || ''}`}
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
            AI Bill Extraction Review
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Inspect extracted items, verify scale weight readings, and confirm Bill Number
          </p>
        </div>
      </div>

      {/* Customer & Status Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Customer Assigned
          </div>
          <div style={{ fontSize: '17px', fontWeight: '800', color: '#0F2C59', marginTop: '2px' }}>
            {billData?.customerName || 'Walk-in Customer'}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>{billData?.customerPhone || 'Counter'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', textAlign: 'right', letterSpacing: '0.05em' }}>
              OCR Confidence
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: isConfidenceGood ? '#DCFCE7' : '#FEF3C7',
                color: isConfidenceGood ? '#166534' : '#B45309',
                fontSize: '12px',
                fontWeight: '800',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                {isConfidenceGood ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </>
                )}
              </svg>
              <span>{confidencePercent}% {isConfidenceGood ? 'High Accuracy' : 'Review Advised'}</span>
            </div>
          </div>
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
          <div><strong>Alert:</strong> {error}</div>
        </div>
      )}

      {saveSuccess && (
        <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '14px', color: '#166534', marginBottom: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Bill Number updated successfully!</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Bill Identification & Manual Fallback */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', marginBottom: '16px' }}>
            Scale Bill Identification
          </div>

          <form onSubmit={handleUpdateBillNumber}>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
              Bill Number (From Scale Slip)
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                id="worker-bill-number-input"
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="e.g. BILL-10492"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  border: !billNumber ? '1px solid #F59E0B' : '1px solid #CBD5E1',
                  borderRadius: '10px',
                  color: '#0F2C59',
                  fontSize: '15px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={savingBillNumber}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #1E56A0',
                  color: '#1E56A0',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {savingBillNumber ? 'Saving...' : 'Save ID'}
              </button>
            </div>
          </form>

          {!billNumber && (
            <div style={{ fontSize: '12px', color: '#B45309', background: '#FEF3C7', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Bill ID was not read automatically. Please enter the Bill Number printed on the paper slip before continuing.</span>
            </div>
          )}

          {billData?.imageUrl && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                Captured Slip Image
              </div>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', textAlign: 'center', maxHeight: '180px', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={billData.imageUrl}
                  alt="Scanned Bill"
                  style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Extracted Items Summary */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59' }}>
              Extracted Line Items ({items.length})
            </div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#15803D' }}>
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>

          {items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F2C59' }}>
                      {it.fishName || 'Fresh Fish'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      {it.quantityKg || 1} kg • ₹{it.unitPrice || 0}/kg
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59' }}>
                    ₹{((it.quantityKg || 1) * (it.unitPrice || 0)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No specific fish items were isolated by OCR. The server will resolve catalog fish at checkout or you may re-scan.
            </div>
          )}

          {billData?.warnings?.length > 0 && (
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#B45309', background: '#FEF3C7', padding: '10px 14px', borderRadius: '8px' }}>
              {billData.warnings.join(' • ')}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <Link
          href={`/worker/bills/capture?customerId=${customerId || billData?.customerId || ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#0F2C59',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>Re-Scan Bill</span>
        </Link>

        <button
          id="btn-proceed-to-checkout"
          type="button"
          onClick={handleProceedToCheckout}
          style={{
            background: 'linear-gradient(135deg, #1E56A0, #0F2C59)',
            border: 'none',
            color: '#FFFFFF',
            padding: '14px 28px',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 14px rgba(30, 86, 160, 0.25)',
          }}
        >
          <span>Continue to Subscription & Payment</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function WorkerBillReviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', color: '#94A3B8', textAlign: 'center' }}>Loading bill details...</div>}>
      <BillReviewContent />
    </Suspense>
  );
}
