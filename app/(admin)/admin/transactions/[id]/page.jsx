'use client';

/**
 * ADMIN-13 — Transaction Investigation & Detail View
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 108–117)
 * - PondFish Core Business Engines Specification v1 (Sections 18, 21)
 * - Master PRD v2 (Section 18)
 */

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';

const STATUS_CONFIG = {
  COMPLETED: { label: 'Successful', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: '#059669' },
  PENDING: { label: 'Pending', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '#D97706' },
  FAILED: { label: 'Failed', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: '#DC2626' },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '#475569' },
  REFUNDED: { label: 'Refunded / Restored', bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: '#7E22CE' },
};

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return `₹${num.toFixed(2)}`;
}

function formatDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
}

export default function TransactionDetailPage({ params }) {
  const resolvedParams = use(params);
  const transactionId = resolvedParams?.id;

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Bill image zoom modal
  const [showImageModal, setShowImageModal] = useState(false);

  // Refund / Restitution Modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('Quality discrepancy');
  const [refundNotes, setRefundNotes] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState(null);

  const fetchTransactionDetail = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/v1/admin/transactions/${transactionId}`);
      const data = await res.json();

      if (data.success && data.transaction) {
        setTransaction(data.transaction);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load transaction details.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching transaction details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      fetchTransactionDetail();
    }
  }, [transactionId]);

  const handleExecuteRefund = async (e) => {
    e.preventDefault();
    if (!transactionId) return;

    try {
      setRefunding(true);
      setRefundError(null);

      const res = await fetch(`/api/v1/admin/transactions/${transactionId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: refundReason,
          notes: refundNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to process refund.');
      }

      setSuccessMsg(data.message || 'Transaction successfully refunded and restored.');
      setShowRefundModal(false);
      setTransaction(data.transaction);
      await fetchTransactionDetail();
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔄</div>
        <div style={{ fontSize: '16px' }}>Loading transaction investigation records...</div>
      </div>
    );
  }

  if (errorMsg || !transaction) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: '#EF4444', marginBottom: '8px' }}>Transaction Not Found</h2>
        <p style={{ color: '#94A3B8', marginBottom: '24px' }}>
          {errorMsg || `Could not find transaction record for ID ${transactionId}.`}
        </p>
        <Link
          href="/admin/transactions"
          style={{
            display: 'inline-block',
            background: '#0284C7',
            color: '#FFFFFF',
            padding: '10px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >
          ← Return to Transactions List
        </Link>
      </div>
    );
  }

  const statusMeta = STATUS_CONFIG[transaction.status] || {
    label: transaction.status,
    bg: '#334155',
    text: '#F8FAFC',
    border: '#475569',
  };

  const isEligibleForRefund = transaction.status === 'COMPLETED';

  return (
    <div style={{ padding: '32px', color: '#F8FAFC', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Navigation Breadcrumb & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            id="btn-back-transactions"
            href="/admin/transactions"
            style={{
              color: '#38BDF8',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#1E293B',
              border: '1px solid #334155',
              padding: '6px 12px',
              borderRadius: '6px',
            }}
          >
            ← All Transactions
          </Link>
          <span style={{ color: '#64748B' }}>/</span>
          <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#F8FAFC' }}>
            {transaction.transactionNumber}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isEligibleForRefund && (
            <button
              id="btn-open-refund-modal"
              type="button"
              onClick={() => {
                setRefundError(null);
                setShowRefundModal(true);
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                border: '1px solid #EF4444',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>↩️</span> Issue Refund / Restitution
            </button>
          )}

          <span
            style={{
              background: statusMeta.bg,
              color: statusMeta.text,
              border: `1px solid ${statusMeta.border}`,
              padding: '6px 14px',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: '700',
            }}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#6EE7B7', padding: '14px 18px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px' }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* SECTION 1: CUSTOMER (Section 109) */}
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>👤</span>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
              Customer Details
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Full Name</div>
              <div style={{ fontWeight: '600', color: '#F8FAFC' }}>{transaction.customer?.name || 'Walk-in Customer'}</div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Mobile Phone</div>
              <div style={{ fontFamily: 'monospace', fontWeight: '600', color: '#F8FAFC' }}>
                {transaction.customer?.mobile_number || '—'}
              </div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Customer ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8' }}>
                {transaction.customerId}
              </div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Residential Area</div>
              <div style={{ color: '#E2E8F0' }}>{transaction.customer?.area || 'Store Counter'}</div>
            </div>
          </div>
        </div>

        {/* SECTION 2: ATTRIBUTION & CHANNEL (Section 115) */}
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>👷</span>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
              Attribution & Processing Staff
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Processing Worker</div>
              <div style={{ fontWeight: '600', color: '#F8FAFC' }}>
                {transaction.worker?.name || (transaction.booking ? 'Mobile App Booking' : 'Store POS Self-Checkout')}
              </div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Worker Mobile</div>
              <div style={{ fontFamily: 'monospace', color: '#F8FAFC' }}>
                {transaction.worker?.mobile_number || '—'}
              </div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Finalized At</div>
              <div style={{ color: '#E2E8F0' }}>{formatDate(transaction.createdAt)}</div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Booking Code</div>
              <div style={{ fontFamily: 'monospace', color: '#38BDF8' }}>
                {transaction.booking?.booking_code ? `#${transaction.booking.booking_code}` : 'Counter Purchase'}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: PHYSICAL BILL (Section 110) */}
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>🧾</span>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
              Physical Bill & Slip Details
            </h3>
          </div>

          {transaction.bill ? (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {transaction.bill.image_url ? (
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={transaction.bill.image_url}
                    alt="Physical Bill Slip"
                    style={{
                      width: '100px',
                      height: '130px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      cursor: 'pointer',
                    }}
                    onClick={() => setShowImageModal(true)}
                  />
                  <div style={{ fontSize: '11px', color: '#38BDF8', textAlign: 'center', marginTop: '4px', cursor: 'pointer' }} onClick={() => setShowImageModal(true)}>
                    🔍 Zoom Slip
                  </div>
                </div>
              ) : (
                <div style={{ width: '100px', height: '130px', background: '#0F172A', border: '1px dashed #334155', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '11px', textAlign: 'center', padding: '8px' }}>
                  No Image
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', flex: 1 }}>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>Authoritative Bill ID</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '15px', color: '#F8FAFC' }}>
                    {transaction.bill.manual_bill_id || transaction.bill.bill_number}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>Bill Status</div>
                  <div>
                    <span style={{ background: '#0F172A', border: '1px solid #475569', color: '#CBD5E1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                      {transaction.bill.status}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>Captured At</div>
                  <div style={{ color: '#CBD5E1', fontSize: '12px' }}>{formatDate(transaction.bill.created_at)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No physical bill record linked. This transaction originated from an online booking checkout.
            </div>
          )}
        </div>

        {/* SECTION 4: PAYMENT DETAILS (Section 114) */}
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>🔒</span>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
              Payment & Security Boundary
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Payment Method</div>
              <div style={{ fontWeight: '600', color: '#F8FAFC' }}>{transaction.paymentMethod}</div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Gateway Verification</div>
              <div>
                <span style={{ color: '#10B981', fontWeight: '600', fontSize: '12px' }}>
                  ✓ Server-Side Verified
                </span>
              </div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Razorpay Payment ID</div>
              <div style={{ fontFamily: 'monospace', color: '#E2E8F0', fontSize: '12px' }}>
                {transaction.payments && transaction.payments[0]?.paymentId ? transaction.payments[0].paymentId : '— (Cash/Sub)'}
              </div>
            </div>

            <div>
              <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Razorpay Order ID</div>
              <div style={{ fontFamily: 'monospace', color: '#E2E8F0', fontSize: '12px' }}>
                {transaction.payments && transaction.payments[0]?.orderId ? transaction.payments[0].orderId : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: AI EXTRACTION COMPARISON (Section 111) */}
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
              AI Extracted vs. Confirmed Values Comparison (Section 111)
            </h3>
          </div>
          {transaction.bill?.ai_confidence_score != null && (
            <span style={{ background: '#0F172A', border: '1px solid #0284C7', color: '#38BDF8', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
              AI Confidence: {(transaction.bill.ai_confidence_score * 100).toFixed(1)}%
            </span>
          )}
        </div>

        {transaction.aiLogs && transaction.aiLogs.length > 0 ? (
          <div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '12px' }}>
              AI extraction serves as a physical transaction intake input. Authoritative confirmed values govern inventory and financial deduction.
            </div>
            <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: '#E2E8F0', overflowX: 'auto', maxHeight: '200px' }}>
              <pre style={{ margin: 0 }}>
                {JSON.stringify(transaction.aiLogs[0]?.parsedData || transaction.aiLogs[0]?.rawResponse, null, 2)}
              </pre>
            </div>
          </div>
        ) : transaction.bill?.extracted_text ? (
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '16px', fontSize: '13px' }}>
            <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>OCR Extracted Raw Text</div>
            <div style={{ color: '#E2E8F0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {transaction.bill.extracted_text}
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
            No optical AI extraction logs recorded for this transaction. Line items were confirmed directly via POS finalization.
          </div>
        )}
      </div>

      {/* SECTION 6: FISH LINE ITEMS (Section 112) */}
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🐟</span>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
            Fish Line Items Breakdown (Section 112)
          </h3>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Fish Variety</th>
              <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Quantity (kg)</th>
              <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Unit Price (₹/kg)</th>
              <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Line Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(transaction.items || []).map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: '14px 16px', fontWeight: '600', color: '#F8FAFC' }}>
                  {item.fishName}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600', color: '#F8FAFC' }}>
                  {item.quantityKg} kg
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#CBD5E1' }}>
                  {formatCurrency(item.unitPrice)}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#38BDF8' }}>
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECTION 7: FINANCIAL CALCULATION BREAKDOWN (Section 113) */}
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <span style={{ fontSize: '20px' }}>🧮</span>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
            Authoritative Financial Calculation Breakdown (Section 113)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', fontSize: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: '8px' }}>
            <span style={{ color: '#94A3B8' }}>Total Bill Amount:</span>
            <span style={{ fontWeight: '700', color: '#F8FAFC' }}>{formatCurrency(transaction.totalBillAmount)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: '8px' }}>
            <span style={{ color: '#94A3B8' }}>Subscription-Covered Qty:</span>
            <span style={{ fontWeight: '600', color: '#C084FC' }}>{transaction.subQtyCoveredKg || 0} kg</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: '8px' }}>
            <span style={{ color: '#94A3B8' }}>Subscription Value Used:</span>
            <span style={{ fontWeight: '700', color: '#C084FC' }}>-{formatCurrency(transaction.subCreditUsed)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: '8px' }}>
            <span style={{ color: '#94A3B8' }}>Extra Amount Payable:</span>
            <span style={{ fontWeight: '600', color: '#F8FAFC' }}>{formatCurrency(transaction.extraAmountPayable)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: '8px' }}>
            <span style={{ color: '#94A3B8' }}>Razorpay Fee (2%):</span>
            <span style={{ color: '#CBD5E1' }}>{formatCurrency(transaction.razorpayGatewayFee)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: '8px' }}>
            <span style={{ color: '#94A3B8' }}>GST on Fee (18%):</span>
            <span style={{ color: '#CBD5E1' }}>{formatCurrency(transaction.gstOnFee)}</span>
          </div>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>Final Settled Amount:</span>
          <span style={{ fontSize: '24px', fontWeight: '800', color: '#4ADE80' }}>{formatCurrency(transaction.finalPaidAmount)}</span>
        </div>
      </div>

      {/* SECTION 8: AUDIT TRAIL TIMELINE (Section 116) */}
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <span style={{ fontSize: '20px' }}>📋</span>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#38BDF8' }}>
            Immutable Audit Trail & Lifecycle Events (Section 116)
          </h3>
        </div>

        {transaction.auditLogs && transaction.auditLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transaction.auditLogs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#0284C7', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      Actor: <strong>{log.actorType}</strong> ({log.actorId})
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '6px' }}>
                    {typeof log.payload === 'object' ? JSON.stringify(log.payload) : log.payload}
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap' }}>
                  {formatDate(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            No secondary administrative adjustments recorded yet. Transaction remains in initial authoritative state.
          </div>
        )}
      </div>

      {/* Bill Image Viewer Modal */}
      {showImageModal && transaction.bill?.image_url && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setShowImageModal(false)}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={transaction.bill.image_url}
              alt="Full Bill Slip"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
            />
            <button
              onClick={() => setShowImageModal(false)}
              style={{
                position: 'absolute',
                top: '-16px',
                right: '-16px',
                background: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Refund / Restitution Modal */}
      {showRefundModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div style={{ background: '#1E293B', border: '1px solid #475569', borderRadius: '14px', maxWidth: '520px', width: '100%', padding: '28px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#EF4444' }}>
              Confirm Transaction Refund & Restitution
            </h3>
            <p style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '20px', lineHeight: '1.5' }}>
              This administrative action will mark transaction <strong>{transaction.transactionNumber}</strong> as <strong>REFUNDED</strong>.
              All fish cuts will be atomically returned to active counter inventory, and any debited subscription benefits will be restored to the customer wallet.
            </p>

            {refundError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                ⚠️ {refundError}
              </div>
            )}

            <form onSubmit={handleExecuteRefund}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                  Operational Reason:
                </label>
                <select
                  id="select-refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="Quality discrepancy">Quality discrepancy</option>
                  <option value="Customer return">Customer return</option>
                  <option value="Billed incorrect fish">Billed incorrect fish</option>
                  <option value="Billing error">Billing error</option>
                  <option value="Operational issue">Operational issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {refundReason === 'Other' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Explanatory Notes (Required for 'Other'):
                  </label>
                  <textarea
                    id="input-refund-notes"
                    rows={3}
                    placeholder="Enter detailed reason for administrative refund..."
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  disabled={refunding}
                  onClick={() => setShowRefundModal(false)}
                  style={{
                    background: 'transparent',
                    color: '#94A3B8',
                    border: '1px solid #475569',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: refunding ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  id="btn-confirm-refund"
                  type="submit"
                  disabled={refunding}
                  style={{
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: refunding ? 'not-allowed' : 'pointer',
                  }}
                >
                  {refunding ? 'Processing Refund...' : 'Confirm Refund & Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
