'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FishCard from './components/FishCard';
import FishCardSkeleton from './components/FishCardSkeleton';
import EmptyState from './components/EmptyState';
import ErrorState from './components/ErrorState';

export default function PublicHomePage() {
  const [featuredFish, setFeaturedFish] = useState([]);
  const [categories, setCategories] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [fishRes, catRes, discRes] = await Promise.all([
        fetch('/api/v1/public/fish'),
        fetch('/api/v1/public/categories'),
        fetch('/api/v1/public/discounts'),
      ]);

      if (!fishRes.ok || !catRes.ok || !discRes.ok) {
        throw new Error('Failed to load public portal data.');
      }

      const [fishData, catData, discData] = await Promise.all([
        fishRes.json(),
        catRes.json(),
        discRes.json(),
      ]);

      setFeaturedFish(fishData.data || []);
      setCategories(catData.data || []);
      setDiscounts(discData.data || []);
    } catch (err) {
      console.error('[HOME FETCH ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 1. HERO SECTION */}
      <section style={{
        background: 'radial-gradient(ellipse at top, #1E293B 0%, #0B1120 70%)',
        borderBottom: '1px solid #1E293B',
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            borderRadius: '9999px',
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#38BDF8',
            marginBottom: '24px'
          }}>
            <span>✨</span>
            <span>Single Store + Dedicated Truck Fresh Catch</span>
          </div>

          <h1 style={{
            fontSize: '44px',
            fontWeight: '900',
            letterSpacing: '-1px',
            lineHeight: '1.15',
            color: '#F8FAFC',
            marginBottom: '20px'
          }}>
            Fresh Catch Daily from Lake to Store with{' '}
            <span style={{
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              0–24h Green Freshness
            </span>
          </h1>

          <p style={{
            fontSize: '18px',
            color: '#94A3B8',
            lineHeight: '1.6',
            maxWidth: '680px',
            margin: '0 auto 36px'
          }}>
            PondFish operates a transparent single-store supply chain in Bangalore. Harvested fresh, transported in our monitored dedicated truck, and sold with real-time inventory transparency.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link
              href="/fish"
              style={{
                padding: '14px 32px',
                background: '#0284C7',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '700',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                transition: 'transform 0.2s, background 0.2s'
              }}
            >
              Explore Live Fish Catalogue &rarr;
            </Link>
            <Link
              href="/about"
              style={{
                padding: '14px 28px',
                background: '#1E293B',
                color: '#F8FAFC',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                border: '1px solid #334155'
              }}
            >
              Our Freshness Guarantee
            </Link>
          </div>

          {/* Value Badges */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '32px',
            marginTop: '48px',
            paddingTop: '32px',
            borderTop: '1px solid rgba(51, 65, 85, 0.4)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94A3B8' }}>
              <span style={{ color: '#22C55E' }}>✓</span> 100% Chemical & Formalin Free
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94A3B8' }}>
              <span style={{ color: '#22C55E' }}>✓</span> Daily Monitored Truck Delivery
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94A3B8' }}>
              <span style={{ color: '#22C55E' }}>✓</span> Transparent Freshness Color-Coding
            </div>
          </div>
        </div>
      </section>

      {/* 2. ACTIVE PROMOTION BANNER (If Active in DB) */}
      {discounts.length > 0 && (
        <section style={{ background: '#0284C7', padding: '16px 24px', color: '#FFFFFF' }}>
          <div style={{
            maxWidth: '1240px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>🏷️</span>
              <div>
                <strong>Active Store Promotion:</strong> Use code{' '}
                <span style={{
                  background: '#0B1120',
                  color: '#FACC15',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '800',
                  letterSpacing: '1px'
                }}>
                  {discounts[0].discount_code}
                </span>{' '}
                for {discounts[0].discount_percent ? `${discounts[0].discount_percent}% off` : `₹${discounts[0].flat_discount_amount} off`}!
              </div>
            </div>
            <Link
              href="/discounts"
              style={{
                fontSize: '13px',
                fontWeight: '700',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '6px 16px',
                borderRadius: '6px',
                color: '#FFFFFF'
              }}
            >
              View Offer Details &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* 3. FEATURED FISH SECTION */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '64px 24px', width: '100%' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
              Real-Time Inventory
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
              Today's Live Fresh Catch
            </h2>
          </div>
          <Link
            href="/fish"
            style={{ fontSize: '14px', fontWeight: '700', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>View All Fish Varieties</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {/* Dynamic Content States */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <FishCardSkeleton />
            <FishCardSkeleton />
            <FishCardSkeleton />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : featuredFish.length === 0 ? (
          /* Authoritative Empty State (PRD Sec. 5.11): Zero fake fish */
          <EmptyState
            title="Fresh Catch In Transit"
            message="No fresh fish varieties are currently listed in the store counter. Daily harvest arrives via our dedicated truck between 07:00 AM – 08:30 AM."
            actionLabel="View Catalogue & Filters"
            onAction={() => window.location.href = '/fish'}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {featuredFish.slice(0, 6).map((fish) => (
              <FishCard key={fish.id} fish={fish} />
            ))}
          </div>
        )}
      </section>

      {/* 4. FRESHNESS GUARANTEE PROTOCOL (Design System Spec) */}
      <section style={{
        background: '#0F172A',
        borderTop: '1px solid #1E293B',
        borderBottom: '1px solid #1E293B',
        padding: '64px 24px'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC', marginBottom: '12px' }}>
              The PondFish Freshness Standard
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
              Every batch received at our counter is strictly categorized by elapsed harvest time. We never freeze or artificially preserve fish.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Green */}
            <div style={{ background: '#0B1120', padding: '32px 24px', borderRadius: '12px', border: '1px solid #16A34A' }}>
              <div style={{
                display: 'inline-flex',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: '#DCFCE7',
                color: '#16A34A',
                fontWeight: '800',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                0–24 HOURS ELAPSED
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC', marginBottom: '10px' }}>
                🟢 Peak Fresh Catch
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
                Harvested within the last 24 hours. Firm flesh, bright clear eyes, and fresh water aroma. Eligible for online reservation and premium counter sales.
              </p>
            </div>

            {/* Grey */}
            <div style={{ background: '#0B1120', padding: '32px 24px', borderRadius: '12px', border: '1px solid #64748B' }}>
              <div style={{
                display: 'inline-flex',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: '#F1F5F9',
                color: '#64748B',
                fontWeight: '800',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                24–48 HOURS ELAPSED
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC', marginBottom: '10px' }}>
                ⚪ Day Catch (Discounted)
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
                High-quality catch from the previous day, kept continuously under strict crushed-ice temperatures. Automatically marked down for walk-in counter customers.
              </p>
            </div>

            {/* Red */}
            <div style={{ background: '#0B1120', padding: '32px 24px', borderRadius: '12px', border: '1px solid #DC2626' }}>
              <div style={{
                display: 'inline-flex',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: '#FEE2E2',
                color: '#DC2626',
                fontWeight: '800',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                48+ HOURS ELAPSED
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC', marginBottom: '10px' }}>
                🔴 Clearance & Auto-Scrap
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
                Batches reaching 48 hours are automatically removed from online booking. They undergo final counter clearance or disposal per food safety standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. STORE & TRUCK LOGISTICS (PRD Section 22) */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '80px 24px', width: '100%' }}>
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '48px 36px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '40px',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Operational Architecture
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#F8FAFC', marginBottom: '16px', lineHeight: '1.2' }}>
              Dedicated Cold-Chain Truck to Single Retail Store
            </h2>
            <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '24px' }}>
              We do not distribute across third-party warehouses. Our dedicated refrigerated truck transports daily lake catch directly to our flagship Bangalore store, ensuring total cold-chain integrity.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#F8FAFC' }}>
                <span style={{ color: '#22C55E' }}>📍</span>
                <span><strong>Counter Address:</strong> 123 Fresh Lake Road, Water Town, Bangalore</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#F8FAFC' }}>
                <span style={{ color: '#38BDF8' }}>⏰</span>
                <span><strong>Store Hours:</strong> 06:00 AM – 09:00 PM Daily</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#F8FAFC' }}>
                <span style={{ color: '#FACC15' }}>🚚</span>
                <span><strong>Fresh Stock Replenishment:</strong> 07:00 AM – 08:30 AM Daily</span>
              </div>
            </div>
          </div>

          <div style={{
            background: '#0B1120',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📱</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px' }}>
              Customer Mobile App
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '20px' }}>
              Reserve fish up to 48 hours in advance, subscribe for weekly fresh fish credits, and view live GPS tracking when our delivery truck is on the route.
            </p>
            <div style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: '#1E293B',
              color: '#38BDF8',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              border: '1px solid #334155'
            }}>
              Available on Android
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
