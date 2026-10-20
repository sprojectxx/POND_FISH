'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ErrorState from '../components/ErrorState';
import { Tag, ArrowRight, Check, FishIcon } from '../components/Icons';

const dailySpecials = [
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

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchDiscounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/discounts');
      if (!res.ok) {
        throw new Error('Failed to load active promotions from server.');
      }
      const json = await res.json();
      setDiscounts(json.data || []);
    } catch (err) {
      console.error('[DISCOUNTS FETCH ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDiscounts();
  }, []);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 64px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
          Active Promotions & Specials
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 10px 0' }}>
          PondFish Offers & Flash Savings
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '680px', lineHeight: '1.6', margin: 0 }}>
          Enjoy verified daily promotions, early bird counter savings, and automated Day-2 freshness clearance discounts on selected lake and river varieties.
        </p>
      </div>

      {/* 2. Promo Code Campaigns from Backend (if any active) */}
      {discounts.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f2c59', marginBottom: '16px' }}>
            Storewide & Promo Code Discounts
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {discounts.map((d) => (
              <div
                key={d.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: '#ecfdf5',
                    borderBottomLeftRadius: '12px',
                    borderLeft: '1px solid #a7f3d0',
                    borderBottom: '1px solid #a7f3d0',
                    padding: '6px 14px',
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#047857',
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Check size={12} color="#047857" />
                  <span>VERIFIED ACTIVE</span>
                </div>

                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#f8fafc',
                      border: '1px dashed #1e56a0',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      color: '#1e56a0',
                      fontSize: '13px',
                      fontWeight: '800',
                      fontFamily: 'monospace',
                      marginBottom: '16px',
                    }}
                  >
                    <Tag size={14} color="#1e56a0" />
                    <span>{d.discount_code || d.code || 'FLASH DEAL'}</span>
                  </div>

                  <div style={{ fontSize: '32px', fontWeight: '900', color: '#1e56a0', margin: '0 0 8px 0' }}>
                    {d.discount_percent ? `${d.discount_percent}% OFF` : `₹${d.flat_discount_amount} OFF`}
                  </div>

                  <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                    {d.description || (d.fish_name ? `Applicable on fresh daily ${d.fish_name}.` : 'Applied automatically at counter or customer app booking checkout.')}
                  </p>
                </div>

                <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <Link
                    href="/fish"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#1e56a0',
                      fontSize: '13px',
                      fontWeight: '800',
                      textDecoration: 'none',
                    }}
                  >
                    <span>Browse Eligible Fish</span>
                    <ArrowRight size={14} color="#1e56a0" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Daily Flash Specials (Always shown so customers see harvest savings) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f2c59', margin: '0 0 4px 0' }}>
              Today&apos;s Verified Daily Flash Specials
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Harvested fresh this morning from Andhra &amp; coastal waters with counter price reductions.
            </p>
          </div>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '12px',
              fontWeight: '800',
            }}
          >
            4 Daily Flash Specials Active
          </span>
        </div>

        <div className="pf-offers-grid">
          {dailySpecials.map((offer) => (
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
                      padding: '12px',
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
                  <span>{offer.teluguName}</span> • <span style={{ color: '#1e56a0', fontWeight: '600' }}>{offer.origin}</span>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                  <span className="pf-card-pill pf-pill-green">{offer.freshness}</span>
                  <span className="pf-card-pill pf-pill-gray">{offer.stockLeft}</span>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontSize: '12px', textDecoration: 'line-through', color: '#94a3b8', marginRight: '6px' }}>
                      ₹{offer.originalPrice}
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#1e56a0' }}>
                      ₹{offer.offerPrice}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{offer.unit}</span>
                  </div>

                  <Link href="/fish" className="pf-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                    Book Now
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
