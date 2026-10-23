'use client';

/**
 * Screen: WP-07 — Worker Physical Bill Slip Capture
 * Traceability: PondFish Worker Portal Spec (WP-07) & Master PRD v2 (Section 7, 8)
 * Enables counter staff on tablets to capture paper bill slips produced by the SI-801 weighing scale,
 * preview the image, and trigger server-side Tesseract.js AI OCR processing.
 */

import React, { useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function BillCaptureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const customerId = searchParams.get('customerId') || '';
  const customerName = searchParams.get('customerName') || 'Counter Customer';
  const phone = searchParams.get('phone') || '';
  const subActive = searchParams.get('subActive') === '1';
  const credit = parseFloat(searchParams.get('credit') || '0');
  const plan = searchParams.get('plan') || '';

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!customerId) {
    return (
      <div style={{ maxWidth: '680px', margin: '40px auto', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '12px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F2C59', marginBottom: '8px' }}>
          No Customer Selected
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>
          Please select a customer from the customer directory before capturing a physical bill.
        </p>
        <Link
          href="/worker/customers"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1E56A0',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: '700',
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
          }}
        >
          <span>Go to Customer Search</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAndScan = async () => {
    if (!selectedFile && !imagePreview) {
      setError('Please take a photo or select an image file first.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('customerId', customerId);
      if (selectedFile) {
        formData.append('bill_image', selectedFile);
      } else if (imagePreview) {
        formData.append('image_base64', imagePreview);
      }

      const res = await fetch('/api/v1/worker/bills/scan', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          router.replace('/worker/login');
          return;
        }
        setError(json.error?.message || 'Bill OCR extraction failed. Please try again or re-scan.');
        setProcessing(false);
        return;
      }

      const billId = json.data?.billId || json.data?.scanId;
      const reviewQuery = new URLSearchParams({
        customerId,
        customerName,
        phone,
      });

      router.push(`/worker/bills/${billId}/review?${reviewQuery.toString()}`);
    } catch {
      setError('Failed to transmit bill image. Check tablet network connection and try again.');
      setProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <Link
          href="/worker/customers"
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
            fontSize: '16px',
            fontWeight: '800',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
          }}
        >
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 4px 0', color: '#0F2C59', letterSpacing: '-0.02em' }}>
            Capture Paper Bill Slip (WP-07)
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
            Photograph the SI-801 weighing scale ticket to extract weights, prices, and bill number
          </p>
        </div>
      </div>

      {/* Selected Customer Banner */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: subActive ? '#DCFCE7' : '#E0F2FE',
              color: subActive ? '#166534' : '#0369A1',
              border: subActive ? '1px solid #BBF7D0' : '1px solid #BAE6FD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '800',
            }}
          >
            {customerName ? customerName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59' }}>
              {customerName}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Phone: {phone} {subActive ? `• Active Plan: ${plan}` : '• Standard Walk-in'}
            </div>
          </div>
        </div>

        <div>
          {subActive ? (
            <span
              style={{
                background: '#DCFCE7',
                color: '#166534',
                border: '1px solid #BBF7D0',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '800',
              }}
            >
              Credit: ₹{credit.toFixed(2)}
            </span>
          ) : (
            <span
              style={{
                background: '#F1F5F9',
                color: '#64748B',
                border: '1px solid #CBD5E1',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              Non-Subscriber
            </span>
          )}
        </div>
      </div>

      {/* Capture Area */}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {!imagePreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #CBD5E1',
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#F8FAFC',
              transition: 'border 0.2s',
            }}
          >
            <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '14px', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginBottom: '8px' }}>
              Tap to Open Camera or Upload Bill Photo
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '380px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
              Ensure the SI-801 scale slip is clearly lit and flattened so the Bill Number, weights (kg), and prices are legible.
            </p>
            <button
              type="button"
              style={{
                background: '#1E56A0',
                border: 'none',
                color: '#FFFFFF',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
              }}
            >
              Take Photo / Choose File
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F2C59' }}>
                Bill Image Preview
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setImagePreview(null);
                }}
                disabled={processing}
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ✕ Clear & Re-take
              </button>
            </div>

            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                maxHeight: '380px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Scale Bill Preview"
                style={{
                  maxHeight: '340px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '16px',
            color: '#DC2626',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          <strong>Scan Alert:</strong> {error}
        </div>
      )}

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          href="/worker/customers"
          style={{
            color: '#64748B',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Cancel & Return
        </Link>

        <button
          id="btn-process-ocr-bill"
          type="button"
          onClick={handleUploadAndScan}
          disabled={processing || (!selectedFile && !imagePreview)}
          style={{
            background: processing
              ? '#CBD5E1'
              : selectedFile || imagePreview
              ? '#15803D'
              : '#E2E8F0',
            color: selectedFile || imagePreview ? '#FFFFFF' : '#94A3B8',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '800',
            cursor: processing || (!selectedFile && !imagePreview) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: selectedFile || imagePreview ? '0 4px 12px rgba(21, 128, 61, 0.25)' : 'none',
          }}
        >
          {processing ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Running Tesseract AI OCR...</span>
            </>
          ) : (
            <>
              <span>Extract Bill Details</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function WorkerBillCapturePage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', color: '#94A3B8', textAlign: 'center' }}>Loading counter camera...</div>}>
      <BillCaptureContent />
    </Suspense>
  );
}
