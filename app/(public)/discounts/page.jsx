'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

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
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Active Promotions & Specials
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '12px' }}>
          PondFish Offers & Discounts
        </h1>
        <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '680px', lineHeight: '1.6' }}>
          Enjoy verified daily promotions, early bird counter savings, and automated Day-2 freshness clearance discounts on selected lake and river varieties.
        </p>
      </div>

      {/* 2. Content States */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '12px',
                padding: '28px',
                height: '240px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ width: '80px', height: '24px', borderRadius: '4px', background: '#1E293B', marginBottom: '16px' }}></div>
                <div style={{ width: '70%', height: '28px', borderRadius: '4px', background: '#1E293B', marginBottom: '10px' }}></div>
                <div style={{ width: '90%', height: '14px', borderRadius: '4px', background: '#1E293B' }}></div>
              </div>
              <div style={{ width: '40%', height: '14px', borderRadius: '4px', background: '#1E293B' }}></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Offers Unavailable"
          message={error}
          onRetry={fetchDiscounts}
        />
      ) : discounts.length === 0 ? (
        <EmptyState
          title="No Active Offers Today"
          message="There are currently no active public promotional campaigns. All fish varieties are priced at everyday fair farm-gate counter rates."
          actionText="Browse Fish Catalogue"
          actionHref="/fish"
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {discounts.map((d) => (
            <div
              key={d.id}
              style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #162032 100%)',
                border: '1px solid #1E293B',
                borderRadius: '12px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'rgba(2, 132, 199, 0.1)',
                padding: '8px 16px',
                borderBottomLeftRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#38BDF8',
                letterSpacing: '0.5px'
              }}>
                VERIFIED ACTIVE
              </div>

              <div>
                {/* Promo Code Pill */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#1E293B',
                  border: '1px dashed #38BDF8',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  color: '#38BDF8',
                  fontSize: '14px',
                  fontWeight: '800',
                  fontFamily: 'var(--pf-font-mono, monospace)',
                  marginBottom: '18px'
                }}>
                  🏷️ {d.code || 'SPECIAL'}
                </div>

                <div style={{ fontSize: '32px', fontWeight: '900', color: '#F8FAFC', marginBottom: '8px' }}>
                  {d.percentage ? `${d.percentage}% OFF` : `₹${d.amount} OFF`}
                </div>

                <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '16px' }}>
                  {d.description || (d.fishName ? `Applicable on fresh daily ${d.fishName}.` : 'Applied automatically or via customer app booking checkout.')}
                </p>

                {(d.startDate || d.endDate) && (
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                    {d.endDate && `Valid until: ${new Date(d.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </div>
                )}
              </div>

              <Link
                href="/fish"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#38BDF8',
                  fontSize: '14px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  marginTop: '12px'
                }}
              >
                <span>Browse Eligible Fish</span>
                <span>&rarr;</span>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 3. Freshness Policy / Clearance Guarantee Callout */}
      <div style={{
        marginTop: '64px',
        padding: '36px',
        background: '#070D19',
        border: '1px solid #1E293B',
        borderRadius: '12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '32px',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Zero-Waste Freshness Standard
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Transparent 3-Day Clearance Cycle
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            We believe you deserve full honesty about catch age. Catch harvested today (Day 1) is sold at standard MRP with peak Green status. Any catch remaining by Day 2 receives an automatic clearance discount with Grey status. No fish is ever sold beyond Day 3.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0F172A', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1E293B' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#16A34A' }}></span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>Day 1 — Green (0–24h)</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Peak morning catch, standard store pricing</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0F172A', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1E293B' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#64748B' }}></span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>Day 2 — Grey (24–48h)</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Automated clearance discount, prime cooking quality</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
