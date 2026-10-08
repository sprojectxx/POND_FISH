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
      <div style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC' }}>Loading Bill Extraction...</h2>
        <p style={{ fontSize: '13px' }}>Matching scanned weights and prices against fish catalogue</p>
      </div>
    );
  }

  if (error && !billData) {
    return (
      <div style={{ maxWidth: '680px', margin: '40px auto', background: '#0F172A', border: '1px solid #EF4444', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '42px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#EF4444', marginBottom: '8px' }}>
          Unable to Load Bill
        </h2>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px' }}>
          {error}
        </p>
        <Link
          href="/worker/customers"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link
          href={`/worker/bills/capture?customerId=${customerId || billData?.customerId || ''}`}
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
            AI Bill Extraction Review (WP-08)
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Inspect extracted items, verify scale weight readings, and confirm Bill Number
          </p>
        </div>
      </div>

      {/* Customer & Status Bar */}
      <div
        style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
            Customer Assigned
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>
            {billData?.customerName || 'Walk-in Customer'}
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>
            📱 {billData?.customerPhone || 'Counter'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>
              OCR Confidence
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: '800',
                color: isConfidenceGood ? '#22C55E' : '#FACC15',
                textAlign: 'right',
              }}
            >
              {confidencePercent}% {isConfidenceGood ? '✓ High' : '⚠ Review Advised'}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '12px', padding: '16px', color: '#EF4444', marginBottom: '24px', fontSize: '14px' }}>
          <strong>Alert:</strong> {error}
        </div>
      )}

      {saveSuccess && (
        <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22C55E', borderRadius: '12px', padding: '14px', color: '#22C55E', marginBottom: '24px', fontSize: '14px' }}>
          ✓ Bill Number updated successfully!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Bill Identification & Manual Fallback */}
        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC', marginBottom: '16px' }}>
            Scale Bill Identification
          </div>

          <form onSubmit={handleUpdateBillNumber}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
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
                  background: '#0B1120',
                  border: !billNumber ? '1px solid #FACC15' : '1px solid #334155',
                  borderRadius: '8px',
                  color: '#F8FAFC',
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
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#38BDF8',
                  padding: '12px 18px',
                  borderRadius: '8px',
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
            <div style={{ fontSize: '12px', color: '#FACC15', background: 'rgba(250, 204, 21, 0.1)', padding: '10px 12px', borderRadius: '6px' }}>
              ⚠️ Bill ID was not read automatically. Please enter the Bill Number printed on the paper slip before continuing.
            </div>
          )}

          {billData?.imageUrl && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
                Captured Slip Image
              </div>
              <div style={{ background: '#0B1120', border: '1px solid #1E293B', borderRadius: '8px', padding: '8px', textAlign: 'center', maxHeight: '180px', overflow: 'hidden' }}>
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
        <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>
              Extracted Line Items ({items.length})
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#22C55E' }}>
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>

          {items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#0B1120',
                    border: '1px solid #1E293B',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>
                      {it.fishName || 'Fresh Fish'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {it.quantityKg || 1} kg • ₹{it.unitPrice || 0}/kg
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#F8FAFC' }}>
                    ₹{((it.quantityKg || 1) * (it.unitPrice || 0)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#0B1120', border: '1px dashed #334155', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No specific fish items were isolated by OCR. The server will resolve catalog fish at checkout or you may re-scan.
            </div>
          )}

          {billData?.warnings?.length > 0 && (
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#FACC15', background: 'rgba(250, 204, 21, 0.1)', padding: '10px 12px', borderRadius: '6px' }}>
              {billData.warnings.join(' • ')}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <Link
          href={`/worker/bills/capture?customerId=${customerId || billData?.customerId || ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#F8FAFC',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
          }}
        >
          <span>📷 Re-Scan Bill</span>
        </Link>

        <button
          id="btn-proceed-to-checkout"
          type="button"
          onClick={handleProceedToCheckout}
          style={{
            background: 'linear-gradient(135deg, #0284C7, #0369A1)',
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
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          }}
        >
          <span>Continue to Subscription & Payment</span>
          <span>→</span>
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
