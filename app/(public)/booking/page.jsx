'use client';

/**
 * Public Customer Reservation & Booking Guide Page
 * Traceability: PondFish Customer Reservation Spec (CP-05, Section 14)
 * Consumes fishId / fish_id query parameters and links to authoritative catalogue API.
 * Accurately communicates that online customer bookings with custom cut specs and
 * atomic QR collection passes are completed via the PondFish Customer App or Bangalore store counter.
 */

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Phone, ShieldCheck, FishIcon, QrCode } from '../components/Icons';

function BookingContent() {
  const searchParams = useSearchParams();
  const fishId = searchParams?.get('fishId') || searchParams?.get('fish_id');

  const [selectedFish, setSelectedFish] = useState(null);
  const [loadingFish, setLoadingFish] = useState(Boolean(fishId));

  useEffect(() => {
    if (!fishId) return;
    let isMounted = true;
    setLoadingFish(true);

    fetch(`/api/v1/public/fish/${fishId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json?.data) {
          setSelectedFish(json.data);
        }
      })
      .catch((err) => {
        console.warn('[BOOKING PAGE] Could not load fish details:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoadingFish(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fishId]);

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '48px 24px 64px', width: '100%' }}>
      {/* 1. Badge & Headline */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#e0f2fe',
            border: '1px solid #bfdbfe',
            padding: '5px 14px',
            borderRadius: '9999px',
            color: '#1e56a0',
            fontSize: '11px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '16px',
          }}
        >
          <ShieldCheck size={14} color="#1e56a0" />
          <span>Customer Reservation System</span>
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 14px 0' }}>
          Reserve Fresh Daily Catch
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: '1.65' }}>
          Lock in your preferred whole fish or pre-cut portions directly before the morning harvest batch completes counter intake at our Bangalore store.
        </p>
      </div>

      {/* 2. Selected Fish Context Banner (if arrived from catalogue link) */}
      {loadingFish && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '14px',
            marginBottom: '40px',
          }}
        >
          Loading selected variety details from live counter inventory...
        </div>
      )}

      {!loadingFish && selectedFish && (
        <div
          style={{
            background: '#ffffff',
            border: '2px solid #38bdf8',
            borderRadius: '16px',
            padding: '24px 28px',
            marginBottom: '48px',
            boxShadow: '0 8px 24px rgba(30, 86, 160, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '12px',
                background: '#f0f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {selectedFish.imageUrl || selectedFish.image_url ? (
                <img
                  src={selectedFish.imageUrl || selectedFish.image_url}
                  alt={selectedFish.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}
                />
              ) : (
                <FishIcon size={36} color="#0284c7" />
              )}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                Selected Variety for Reservation
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f2c59', margin: '0 0 4px 0' }}>
                {selectedFish.name}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                <span>Category: {selectedFish.categoryName || selectedFish.category_name || 'Daily Fresh'}</span>
                {selectedFish.unitPrice || selectedFish.pricing?.effectivePrice ? (
                  <span style={{ marginLeft: '12px', fontWeight: '800', color: '#1e56a0' }}>
                    ₹{selectedFish.unitPrice || selectedFish.pricing?.effectivePrice} / kg
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href={`/fish/${selectedFish.id}`}
              style={{
                padding: '10px 18px',
                background: '#f1f5f9',
                color: '#1e56a0',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                textDecoration: 'none',
              }}
            >
              View Specifications
            </Link>
          </div>
        </div>
      )}

      {/* 3. How Reservation Works: Honest Operational Guidance */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '56px',
        }}
      >
        {/* Step 1 */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#1e56a0',
              fontSize: '18px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            01
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Select Bookable Varieties
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Inspect today&apos;s active morning harvest catalogue online to review available river, lake, and marine varieties.
          </p>
        </div>

        {/* Step 2 */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#1e56a0',
              fontSize: '18px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            02
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Reserve in Mobile App
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Submit your reservation with exact cut preferences (whole round, curry cuts, or steaks) via the PondFish Customer App.
          </p>
        </div>

        {/* Step 3 */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#1e56a0',
              fontSize: '18px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            03
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Express QR Pickup
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Show your instant QR Collection Pass at our Bangalore retail counter for prioritized packaging and handover.
          </p>
        </div>
      </div>

      {/* 4. Action Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '20px',
          padding: '44px 32px',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(30, 86, 160, 0.08)',
        }}
      >
        <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#0f2c59', margin: '0 0 10px 0' }}>
          Reserve with Bangalore Express Counter
        </h2>
        <p style={{ fontSize: '15px', color: '#38536e', maxWidth: '580px', margin: '0 auto 28px', lineHeight: '1.6' }}>
          Store availability is synchronized with retail weighing scales. To place an instant reservation or speak with a counter associate:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px' }}>
          <Link
            href="/fish"
            style={{
              padding: '13px 26px',
              background: '#1e56a0',
              color: '#ffffff',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '800',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(30, 86, 160, 0.25)',
            }}
          >
            <span>Browse Active Fish Catalogue</span>
            <ArrowRight size={16} color="#ffffff" />
          </Link>
          <Link
            href="/contact"
            style={{
              padding: '13px 24px',
              background: '#ffffff',
              color: '#0f2c59',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '800',
              textDecoration: 'none',
              border: '1px solid #cbd5e1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Phone size={16} color="#1e56a0" />
            <span>Call Bangalore Store Counter</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingEntryPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '64px 24px', textAlign: 'center', color: '#64748b' }}>
          Loading reservation details...
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
