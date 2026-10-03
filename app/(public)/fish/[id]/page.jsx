'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

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

  const fallbackImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="%230F172A"><rect width="600" height="400" fill="%231E293B"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="64" fill="%2338BDF8">🐟</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-size="18" font-family="sans-serif" font-weight="600" fill="%2394A3B8">PondFish Fresh Catch</text></svg>';

  const displayImage = imageError || !fish?.imageUrl ? fallbackImage : fish.imageUrl;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
      {/* Back Link */}
      <Link
        href="/fish"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#38BDF8',
          fontWeight: '600',
          marginBottom: '32px'
        }}
      >
        <span>&larr;</span> Back to Fish Catalogue
      </Link>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94A3B8' }}>
          Loading fish details...
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDetails} />
      ) : !fish ? (
        <EmptyState
          title="Fish Not Found"
          message="The requested fish variety does not exist or has been delisted from the active catalogue."
          actionLabel="Return to Catalogue"
          onAction={() => window.location.href = '/fish'}
        />
      ) : (
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0'
        }}>
          {/* Left: Image Container */}
          <div style={{ background: '#1E293B', position: 'relative', minHeight: '340px' }}>
            <img
              src={displayImage}
              alt={fish.name}
              onError={() => setImageError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Freshness Badge */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: '700',
              background: fish.freshness?.bg || '#DCFCE7',
              color: fish.freshness?.color || '#16A34A',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: fish.freshness?.color || '#16A34A' }}></span>
              <span>{fish.freshness?.label}</span>
            </div>
          </div>

          {/* Right: Details & Action */}
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column' }}>
            {fish.categoryName && (
              <span style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#38BDF8',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '8px'
              }}>
                {fish.categoryName}
              </span>
            )}

            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#F8FAFC', marginBottom: '16px', lineHeight: '1.2' }}>
              {fish.name}
            </h1>

            {fish.description && (
              <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: '1.7', marginBottom: '24px' }}>
                {fish.description}
              </p>
            )}

            {/* Pricing Box */}
            <div style={{
              background: '#0B1120',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>Current Price</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#F8FAFC' }}>
                    ₹{fish.pricing?.effectivePrice ?? fish.unitPrice}
                  </span>
                  <span style={{ fontSize: '14px', color: '#94A3B8' }}>/ kg</span>
                </div>
              </div>

              {fish.pricing?.hasDiscount && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', color: '#64748B', textDecoration: 'line-through' }}>
                    ₹{fish.pricing.basePrice}
                  </span>
                  <div style={{ fontSize: '12px', color: '#FACC15', fontWeight: '800' }}>
                    PROMO: {fish.pricing.discount?.code}
                  </div>
                </div>
              )}
            </div>

            {/* Status Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: fish.physicalAvailable ? '#22C55E' : '#EF4444' }}>
                  {fish.physicalAvailable ? '●' : '○'}
                </span>
                <span style={{ color: '#F8FAFC' }}>{fish.availabilityStatus}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: fish.onlineBookable ? '#38BDF8' : '#64748B' }}>
                  {fish.onlineBookable ? '●' : '○'}
                </span>
                <span style={{ color: '#F8FAFC' }}>{fish.bookingStatus}</span>
              </div>
            </div>

            {/* Online Reservation Note */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '13px',
              color: '#94A3B8',
              lineHeight: '1.5',
              marginTop: 'auto'
            }}>
              <strong style={{ color: '#38BDF8' }}>Online Reservation:</strong>{' '}
              {fish.onlineBookable
                ? 'Eligible fish can be booked in advance via our Customer Mobile App. Bookings hold stock for up to 48 hours for store pickup.'
                : 'This variety is exclusively available for walk-in selection at our Bangalore store counter.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
