'use client';

import React from 'react';
import { FishIcon } from './Icons';

const sampleOffers = [
  {
    id: 'rohu',
    name: 'Rohu (Farm Fresh Whole)',
    teluguName: 'రోహు / Rohu',
    offerPrice: 224,
    originalPrice: 260,
    discountBadge: '15% OFF',
    specialBadge: 'TOP SELLER',
    origin: 'Nellore Ponds',
    freshness: 'Harvested Today',
    stockLeft: '33 kg left',
    unit: '/ KG',
    image: 'https://urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/rohu.png'
  },
  {
    id: 'boche',
    name: 'Boche (Fresh Cut Steaks)',
    teluguName: 'బొచ్చె / Bocche',
    offerPrice: 245,
    originalPrice: 280,
    discountBadge: '12% OFF',
    specialBadge: 'BEST VALUE',
    origin: 'Bhimavaram Farms',
    freshness: '0–24h Fresh',
    stockLeft: '24 kg left',
    unit: '/ KG',
    image: 'https://urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/bochu.png'
  },
  {
    id: 'pomfret',
    name: 'White Pomfret (Tella Chanduva)',
    teluguName: 'తెల్ల చందువ / Pomfret',
    offerPrice: 1299,
    originalPrice: 1500,
    discountBadge: 'SAVE ₹201',
    specialBadge: 'PREMIUM CATCH',
    origin: 'Coastal Catch',
    freshness: 'Direct Transit',
    stockLeft: '8 kg left',
    unit: '/ KG',
    image: 'https://urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/white-pomfret.png'
  },
  {
    id: 'tilapia',
    name: 'Tilapia (Whole Cleaned)',
    teluguName: 'తిలాపియా / Tilapia',
    offerPrice: 155,
    originalPrice: 180,
    discountBadge: 'SAVE ₹25',
    specialBadge: 'FRESHWATER',
    origin: 'Krishna Basin Ponds',
    freshness: 'Pond Harvest',
    stockLeft: '18 kg left',
    unit: '/ KG',
    image: 'https://urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/tilapia-whole-fish.png'
  }
];

export default function OfferTiles() {
  return (
    <section id="featured-offers" style={{ padding: '60px 0', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div className="pf-section-head">
          <div>
            <p className="pf-eyebrow">TODAY&apos;S FRESH OFFERS</p>
            <h2 className="pf-section-title">Fresh catch, flash savings.</h2>
          </div>

          <div className="pf-carousel-nav">
            <span className="pf-carousel-badge">
              4 Daily Flash Specials
            </span>
          </div>
        </div>

        <div className="pf-offers-grid">
          {sampleOffers.map((offer) => (
            <article key={offer.id} className="pf-offer-card">
              <div className="pf-offer-imgwrap">
                <span className="pf-discount-badge">{offer.discountBadge}</span>
                <span className="pf-seller-badge">{offer.specialBadge}</span>
                {offer.image ? (
                  <img
                    src={offer.image}
                    alt={offer.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      padding: '12px'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <FishIcon size={40} color="#94a3b8" />
                  </div>
                )}
              </div>

              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f2c59' }}>{offer.name}</h3>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  {offer.teluguName} · <span style={{ color: '#1e56a0', fontWeight: '600' }}>{offer.origin}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span className="pf-freshness-pill" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                    <span>{offer.freshness}</span>
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                    {offer.stockLeft}
                  </span>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through', marginRight: '6px' }}>
                      ₹{offer.originalPrice}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#1e56a0' }}>
                      ₹{offer.offerPrice}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>
                      {offer.unit}
                    </span>
                  </div>

                  <a href="#fish-availability" className="pf-btn-book">
                    Book Now
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
