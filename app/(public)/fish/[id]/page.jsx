'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { FishIcon, Check, Truck, ShieldCheck, Thermometer, Clock } from '../../components/Icons';

export default function FishDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [fish, setFish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

  async function fetchDetails() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/public/fish/${id}`);
      if (res.status === 404) {
        setFish(null);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load fish details.');
      }
      const json = await res.json();
      setFish(json.data);
    } catch (err) {
      console.error('[FISH DETAIL ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const displayImage = !imageError && (fish?.imageUrl || fish?.image_url);
  const effectivePrice = fish?.pricing?.effectivePrice ?? fish?.unitPrice ?? 0;
  const basePrice = fish?.pricing?.basePrice ?? fish?.unitPrice ?? 0;
  const hasDiscount = fish?.pricing?.hasDiscount && basePrice > effectivePrice;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 64px', width: '100%' }}>
      {/* Back Link */}
      <Link
        href="/fish"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#1e56a0',
          fontWeight: '700',
          textDecoration: 'none',
          marginBottom: '28px',
        }}
      >
        <span>&larr;</span> Back to Fish Catalogue
      </Link>

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#64748b', fontSize: '15px', fontWeight: '600' }}>
          Loading variety specifications...
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDetails} />
      ) : !fish ? (
        <EmptyState
          title="Fish Variety Not Found"
          message="The requested fish variety does not exist or has been removed from today's active counter catalogue."
          actionLabel="Return to Catalogue"
          onAction={() => { window.location.href = '/fish'; }}
        />
      ) : (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            boxShadow: '0 8px 30px rgba(15, 44, 89, 0.05)',
          }}
        >
          {/* Left: Image Container */}
          <div
            style={{
              background: '#f8fafc',
              position: 'relative',
              minHeight: '380px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              borderRight: '1px solid #f1f5f9',
            }}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt={fish.name}
                onError={() => setImageError(true)}
                style={{ width: '100%', maxHeight: '340px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                <FishIcon size={64} color="#94a3b8" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                  {fish.categoryName || 'Fresh Catch'}
                </span>
              </div>
            )}

            {/* Freshness Badge */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: '800',
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              <span>{fish.freshness?.label || '0–24H Fresh Catch'}</span>
            </div>
          </div>

          {/* Right: Details & Action */}
          <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column' }}>
            {fish.categoryName && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '900',
                  color: '#1e56a0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: '8px',
                }}
              >
                {fish.categoryName}
              </span>
            )}

            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f2c59', margin: '0 0 4px 0', lineHeight: '1.2' }}>
              {fish.name}
            </h1>

            {(fish.telugu_name || fish.teluguName) && (
              <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '16px' }}>
                {fish.telugu_name || fish.teluguName}
              </div>
            )}

            {fish.description && (
              <p style={{ fontSize: '15px', color: '#425b73', lineHeight: '1.65', margin: '0 0 24px 0' }}>
                {fish.description}
              </p>
            )}

            {/* Pricing Box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Counter Price
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '30px', fontWeight: '900', color: '#1e56a0' }}>
                    ₹{effectivePrice}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>/ kg</span>
                </div>
              </div>

              {hasDiscount && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', color: '#94a3b8', textDecoration: 'line-through' }}>
                    ₹{basePrice}
                  </span>
                  <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', marginTop: '4px' }}>
                    {fish.pricing?.discount?.percent ? `${fish.pricing.discount.percent}% OFF` : 'SPECIAL OFFER'}
                  </div>
                </div>
              )}
            </div>

            {/* Quality & Cold Chain Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Thermometer size={16} color="#0284c7" />
                <span>2°C–4°C Insulated Transit</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <ShieldCheck size={16} color="#059669" />
                <span>100% Chemical-Free</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Truck size={16} color="#0284c7" />
                <span>Harvested Direct Today</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Clock size={16} color="#059669" />
                <span>Zero Overnight Holding</span>
              </div>
            </div>

            {/* CTAs */}
            <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {fish.onlineBookable ? (
                <Link
                  href={`/booking?fish_id=${fish.id}`}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '14px 24px',
                    background: '#1e56a0',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '800',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(30, 86, 160, 0.25)',
                  }}
                >
                  Reserve Today's Catch Online
                </Link>
              ) : (
                <div
                  style={{
                    flex: 1,
                    padding: '12px 18px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: '#64748b',
                    fontWeight: '600',
                  }}
                >
                  Available for walk-in selection at Bangalore counter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
