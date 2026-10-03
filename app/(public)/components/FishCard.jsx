'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function FishCard({ fish }) {
  const [imageError, setImageError] = useState(false);

  const fallbackImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="%230F172A"><rect width="300" height="200" fill="%231E293B"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="42" fill="%2338BDF8">🐟</text><text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="13" font-family="sans-serif" font-weight="600" fill="%2394A3B8">PondFish Fresh Catch</text></svg>';

  const displayImage = imageError || !fish.imageUrl ? fallbackImage : fish.imageUrl;

  return (
    <div style={{
      background: '#0F172A',
      border: '1px solid #1E293B',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
    }}
    className="pf-fish-card"
    >
      {/* Image Area */}
      <div style={{ position: 'relative', width: '100%', height: '180px', background: '#1E293B' }}>
        <img
          src={displayImage}
          alt={fish.name}
          onError={() => setImageError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Freshness Badge (Top Left) */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: '700',
          background: fish.freshness?.bg || '#DCFCE7',
          color: fish.freshness?.color || '#16A34A',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: fish.freshness?.color || '#16A34A' }}></span>
          <span>{fish.freshness?.label || 'Fresh Catch'}</span>
        </div>

        {/* Category Pill (Top Right) */}
        {fish.categoryName && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#94A3B8',
            backdropFilter: 'blur(4px)',
            border: '1px solid #334155'
          }}>
            {fish.categoryName}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px', lineHeight: '1.3' }}>
          {fish.name}
        </h3>

        {fish.description && (
          <p style={{
            fontSize: '13px',
            color: '#94A3B8',
            marginBottom: '16px',
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {fish.description}
          </p>
        )}

        {/* Badges / Availability indicators */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {/* Store Availability */}
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '4px',
            background: fish.physicalAvailable ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: fish.physicalAvailable ? '#22C55E' : '#EF4444',
            border: `1px solid ${fish.physicalAvailable ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            {fish.availabilityStatus}
          </span>

          {/* Booking Status */}
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '4px',
            background: fish.onlineBookable ? 'rgba(2, 132, 199, 0.15)' : 'rgba(100, 116, 139, 0.15)',
            color: fish.onlineBookable ? '#38BDF8' : '#94A3B8',
            border: `1px solid ${fish.onlineBookable ? 'rgba(2, 132, 199, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
          }}>
            {fish.bookingStatus}
          </span>
        </div>

        {/* Pricing & CTA Footer */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC' }}>
                ₹{fish.pricing?.effectivePrice ?? fish.unitPrice}
              </span>
              <span style={{ fontSize: '12px', color: '#64748B' }}>/ kg</span>
            </div>

            {/* If discounted, show base price and discount tag */}
            {fish.pricing?.hasDiscount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', color: '#64748B', textDecoration: 'line-through' }}>
                  ₹{fish.pricing.basePrice}
                </span>
                <span style={{ fontSize: '10px', color: '#FACC15', fontWeight: '700' }}>
                  {fish.pricing.discount?.percent ? `${fish.pricing.discount.percent}% OFF` : `₹${fish.pricing.discount.flatAmount} OFF`}
                </span>
              </div>
            )}
          </div>

          <Link
            href={`/fish/${fish.id}`}
            style={{
              padding: '8px 14px',
              background: '#1E293B',
              color: '#38BDF8',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid #334155',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            Details &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
