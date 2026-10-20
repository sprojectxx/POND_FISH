'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FishIcon } from './Icons';

export default function FishCard({ fish }) {
  const [imageError, setImageError] = useState(false);

  const displayImage = !imageError && (fish.imageUrl || fish.image_url);
  const effectivePrice = fish.pricing?.effectivePrice ?? fish.unitPrice ?? fish.price ?? 0;
  const basePrice = fish.pricing?.basePrice ?? fish.unitPrice ?? fish.price ?? 0;
  const hasDiscount = fish.pricing?.hasDiscount && basePrice > effectivePrice;

  return (
    <article
      className="pf-fish-card"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Image Wrap */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '190px',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt={fish.name}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: '12px',
              transition: 'transform 0.3s ease',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#94a3b8',
            }}
          >
            <FishIcon size={44} color="#94a3b8" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {fish.categoryName || fish.category_name || 'Fresh Catch'}
            </span>
          </div>
        )}

        {/* Freshness Badge (Top Left) */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '10px',
            fontWeight: '800',
            letterSpacing: '0.04em',
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          <span>{fish.freshness?.label || (fish.freshness_state === 'GREEN' ? '0–24H FRESH' : 'HARVESTED TODAY')}</span>
        </div>

        {/* Category Pill (Top Right) */}
        {(fish.categoryName || fish.category_name) && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: '700',
              background: 'rgba(255, 255, 255, 0.92)',
              color: '#1e56a0',
              border: '1px solid #bfdbfe',
              backdropFilter: 'blur(4px)',
            }}
          >
            {fish.categoryName || fish.category_name}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f2c59', margin: '0 0 2px 0', lineHeight: '1.3' }}>
          {fish.name}
        </h3>

        {(fish.telugu_name || fish.teluguName) && (
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '8px' }}>
            {fish.telugu_name || fish.teluguName}
          </div>
        )}

        {fish.description && (
          <p
            style={{
              fontSize: '13px',
              color: '#425b73',
              lineHeight: '1.5',
              margin: '0 0 12px 0',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {fish.description}
          </p>
        )}

        {/* Availability Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px', marginTop: 'auto' }}>
          {fish.availabilityStatus && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px',
                background: fish.physicalAvailable !== false ? '#ecfdf5' : '#fef2f2',
                color: fish.physicalAvailable !== false ? '#047857' : '#b91c1c',
                border: `1px solid ${fish.physicalAvailable !== false ? '#a7f3d0' : '#fecaca'}`,
              }}
            >
              {fish.availabilityStatus}
            </span>
          )}

          {fish.bookingStatus && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px',
                background: fish.onlineBookable ? '#e0f2fe' : '#f1f5f9',
                color: fish.onlineBookable ? '#0369a1' : '#64748b',
                border: `1px solid ${fish.onlineBookable ? '#bae6fd' : '#e2e8f0'}`,
              }}
            >
              {fish.bookingStatus}
            </span>
          )}

          {(fish.stock_kg || fish.stockKg) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#f8fafc',
                color: '#64748b',
                border: '1px solid #e2e8f0',
              }}
            >
              {fish.stock_kg || fish.stockKg} kg left
            </span>
          )}
        </div>

        {/* Pricing & CTA Row */}
        <div
          style={{
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#1e56a0' }}>
                ₹{effectivePrice}
              </span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>/ kg</span>
            </div>

            {hasDiscount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>
                  ₹{basePrice}
                </span>
                <span style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                  {fish.pricing?.discount?.percent ? `${fish.pricing.discount.percent}% OFF` : 'DEAL'}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              href={`/fish/${fish.id}`}
              style={{
                padding: '7px 12px',
                background: '#f8fafc',
                color: '#1e56a0',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid #cbd5e1',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Details
            </Link>
            {fish.onlineBookable && (
              <Link
                href={`/booking?fish_id=${fish.id}`}
                style={{
                  padding: '7px 14px',
                  background: '#1e56a0',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(30, 86, 160, 0.2)',
                  transition: 'background 0.15s ease',
                }}
              >
                Book
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
