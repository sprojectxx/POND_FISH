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
      <div style={{ maxWidth: '680px', margin: '40px auto', background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
          No Customer Selected
        </h2>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px' }}>
          Please select a customer from the customer directory before capturing a physical bill.
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

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

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
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link
          href="/worker/customers"
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
            Capture Paper Bill Slip (WP-07)
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Photograph the SI-801 weighing scale ticket to extract weights, prices, and bill number
          </p>
        </div>
      </div>

      {/* Selected Customer Banner */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: subActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: subActive ? '#22C55E' : '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '800',
            }}
          >
            👤
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#F8FAFC' }}>
              {customerName}
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>
              📱 {phone} {subActive ? `• Active Plan: ${plan}` : '• Standard Walk-in'}
            </div>
          </div>
        </div>

        <div>
          {subActive ? (
            <span
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22C55E',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '800',
              }}
            >
              Credit: ₹{credit.toFixed(2)}
            </span>
          ) : (
            <span
              style={{
                background: '#1E293B',
                color: '#94A3B8',
                padding: '6px 12px',
                borderRadius: '8px',
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
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
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
              border: '2px dashed #334155',
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#0B1120',
              transition: 'border 0.2s',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
              Tap to Open Camera or Upload Bill Photo
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '380px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
              Ensure the SI-801 scale slip is clearly lit and flattened so the Bill Number, weights (kg), and prices are legible.
            </p>
            <button
              type="button"
              style={{
                background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                border: 'none',
                color: '#FFFFFF',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Take Photo / Choose File
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>
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
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#EF4444',
                  padding: '6px 12px',
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
                background: '#0B1120',
                border: '1px solid #334155',
                borderRadius: '10px',
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
                  borderRadius: '6px',
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
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #EF4444',
            borderRadius: '12px',
            padding: '16px',
            color: '#EF4444',
            marginBottom: '24px',
            fontSize: '14px',
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
            color: '#94A3B8',
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
              ? '#475569'
              : selectedFile || imagePreview
              ? 'linear-gradient(135deg, #16A34A, #15803D)'
              : '#334155',
            color: '#FFFFFF',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '800',
            cursor: processing || (!selectedFile && !imagePreview) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          }}
        >
          {processing ? (
            <>
              <span>⏳</span>
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
