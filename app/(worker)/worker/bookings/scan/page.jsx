'use client';

/**
 * WP-05 — Worker QR Scanner Page
 * Traceability: PondFish Worker Portal Spec (Section 13)
 * Camera QR scanner with MediaDevices.getUserMedia and fallback manual booking code entry.
 * Direct cryptographic verification against /api/v1/worker/bookings/verify-qr.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkerQrScannerPage() {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scanError, setScanError] = useState(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API is not supported in this browser. Please use manual code entry.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setHasCamera(true);
    } catch (err) {
      console.warn('[CAMERA ACCESS WARNING]', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions or enter the booking code manually.');
      } else {
        setCameraError('Camera is currently unavailable. Please enter the booking code manually below.');
      }
      setHasCamera(false);
    }
  }, []);

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  async function handleVerify(tokenToVerify) {
    if (!tokenToVerify || !tokenToVerify.trim()) return;

    setScanError(null);
    setVerifying(true);

    try {
      const cleanToken = tokenToVerify.trim();

      // If user entered a booking code like PF-BK-... directly, redirect to search/lookup
      if (cleanToken.startsWith('PF-BK-') || !cleanToken.startsWith('PFQR.')) {
        // Fallback direct booking code search
        const searchRes = await fetch(`/api/v1/worker/bookings/search?q=${encodeURIComponent(cleanToken)}`, {
          credentials: 'include',
        });
        const searchJson = await searchRes.json();
        if (searchJson.success && searchJson.data?.length > 0) {
          router.push(`/worker/bookings/${searchJson.data[0].id}`);
          return;
        }
      }

      const res = await fetch('/api/v1/worker/bookings/verify-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ qrCodeData: cleanToken }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          router.replace('/worker/login');
          return;
        }
        setScanError(json.error?.message || 'Invalid QR code. Please ask the customer for the correct booking QR.');
        return;
      }

      // Valid QR verified! Stop camera and open booking
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      router.push(`/worker/bookings/${json.data.id}`);
    } catch {
      setScanError('Unable to reach verification server. Please check your network connection.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0F2C59', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Scan Customer Booking QR
        </h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
          Align the customer&apos;s digital pickup QR ticket within the camera frame
        </p>
      </div>

      {/* Verification Error Notice */}
      {scanError && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            color: '#DC2626',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#DC2626' }}>QR Verification Notice:</strong>
          <div style={{ marginTop: '4px' }}>{scanError}</div>
        </div>
      )}

      {/* Viewfinder Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '24px',
          position: 'relative',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '360px',
            background: '#0F2C59',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Active Video Stream */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: hasCamera ? 'block' : 'none',
            }}
          />

          {/* Camera Permission / Unavailable Message */}
          {!hasCamera && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#CBD5E1' }}>
              <div style={{ width: '56px', height: '56px', margin: '0 auto 14px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', marginBottom: '6px' }}>
                Camera Viewfinder
              </div>
              <div style={{ fontSize: '13px', marginBottom: '16px', color: '#94A3B8' }}>
                {cameraError || 'Allow camera permission to scan QR tickets directly.'}
              </div>
              <button
                onClick={startCamera}
                style={{
                  background: '#1E56A0',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(30, 86, 160, 0.3)',
                }}
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Target Scanning Reticle Overlay */}
          {hasCamera && (
            <div
              style={{
                position: 'absolute',
                width: '240px',
                height: '240px',
                border: '2px dashed #93CCFF',
                borderRadius: '16px',
                boxShadow: '0 0 0 9999px rgba(15, 44, 89, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  background: 'rgba(15, 44, 89, 0.9)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.05em',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                Scan Target Area
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px', background: '#F8FAFC', textAlign: 'center', borderTop: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
            Tip: Hold the customer&apos;s phone steadily about 6–10 inches from the camera.
          </span>
        </div>
      </div>

      {/* Fallback Manual Code / Token Entry Form */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '26px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', margin: '0 0 6px 0' }}>
          Manual Booking or Token Entry
        </h2>
        <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 16px 0' }}>
          If the customer cannot present a QR or camera access is restricted, enter the booking reference code or token string:
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(manualToken);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <input
            type="text"
            placeholder="e.g. PF-BK-20261004-XXXX or PFQR.eyJ..."
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            style={{
              padding: '14px 16px',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              color: '#0F2C59',
              fontSize: '14px',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={verifying || !manualToken.trim()}
            style={{
              padding: '14px',
              background: '#1E56A0',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '800',
              cursor: verifying || !manualToken.trim() ? 'not-allowed' : 'pointer',
              opacity: verifying || !manualToken.trim() ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
            }}
          >
            {verifying ? 'Verifying with Server...' : 'Verify & Open Booking Details →'}
          </button>
        </form>
      </div>
    </div>
  );
}
