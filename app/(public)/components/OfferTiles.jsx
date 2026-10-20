'use client';

/**
 * OfferTiles Component — Featured Daily Offers & Promotions
 * Traceability: PondFish Public UI Specification
 * Binds strictly to authoritative backend discounts (/api/v1/public/discounts).
 * Zero fake stock quantities, artificial freshness claims, or hardcoded sample prices.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, ArrowRight, Check, FishIcon } from './Icons';

export default function OfferTiles() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadOffers() {
      try {
        const res = await fetch('/api/v1/public/discounts');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && Array.isArray(json.data)) {
            setOffers(json.data);
          }
        }
      } catch {
        // Non-blocking: fail quietly on network issues
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadOffers();
    return () => {
      isMounted = false;
    };
  }, []);

  // If no active discounts exist from backend, omit the section to avoid fabricating fake deals
  if (!loading && offers.length === 0) {
    return null;
  }

  if (loading) {
    return null;
  }

  return (
    <section id="featured-offers" style={{ padding: '60px 0', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div className="pf-section-head">
          <div>
            <p className="pf-eyebrow">TODAY&apos;S VERIFIED OFFERS</p>
            <h2 className="pf-section-title">Fresh catch, verified savings.</h2>
          </div>

          <div className="pf-carousel-nav">
            <span className="pf-carousel-badge">
              {offers.length} {offers.length === 1 ? 'Promotion Active' : 'Promotions Active'}
            </span>
          </div>
        </div>

        <div className="pf-offers-grid">
          {offers.map((offer) => {
            const discountValue = offer.discount_percent
              ? `${offer.discount_percent}% OFF`
              : offer.flat_discount_amount
              ? `₹${offer.flat_discount_amount} OFF`
              : 'SPECIAL DEAL';

            const codeText = offer.discount_code || offer.code;

            return (
              <article key={offer.id} className="pf-offer-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    {codeText ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#f8fafc',
                          border: '1px dashed #1e56a0',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          color: '#1e56a0',
                          fontSize: '12px',
                          fontWeight: '800',
                          fontFamily: 'monospace',
                        }}
                      >
                        <Tag size={12} color="#1e56a0" />
                        <span>{codeText}</span>
                      </span>
                    ) : <span />}

                    <span
                      style={{
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: '800',
                        color: '#047857',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={10} color="#047857" />
                      <span>ACTIVE</span>
                    </span>
                  </div>

                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#1e56a0', marginBottom: '6px' }}>
                    {discountValue}
                  </div>

                  <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                    {offer.description || (offer.fish_name ? `Special promotion on ${offer.fish_name}.` : 'Applied on eligible counter & app reservations.')}
                  </p>
                </div>

                <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                    {offer.fish_name || 'All Store Varieties'}
                  </span>
                  <Link
                    href={offer.fish_id ? `/fish/${offer.fish_id}` : '/fish'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#1e56a0',
                      fontSize: '12px',
                      fontWeight: '800',
                      textDecoration: 'none',
                    }}
                  >
                    <span>View Catch</span>
                    <ArrowRight size={12} color="#1e56a0" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
