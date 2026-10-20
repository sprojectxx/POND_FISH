'use client';

/**
 * Public Discounts & Promotions Page
 * Traceability: PondFish Customer Discounts Spec & API Specification (Section 10)
 * Exclusively displays active backend promotions from /api/v1/public/discounts.
 * Zero hardcoded prices, fake stock, or artificial fallback arrays.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { Tag, ArrowRight, Check } from '../components/Icons';

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

      {/* 2. Content Body: Loading, Error, Empty, or Active Promotions */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b', fontSize: '15px', fontWeight: '600' }}>
          Loading active daily promotions...
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDiscounts} />
      ) : discounts.length === 0 ? (
        <EmptyState
          title="No Active Promotional Discounts"
          message="All daily catches at our Bangalore retail counter are currently priced at standard wholesale-linked market rates. Special promotional discounts and flash clearance savings will be published here when active."
          actionLabel="Browse Today's Catch"
          onAction={() => {
            window.location.href = '/fish';
          }}
        />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f2c59', margin: '0 0 4px 0' }}>
                Active Deals & Promo Code Discounts
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                Authoritative promotions verified by PondFish store management.
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
              {discounts.length} {discounts.length === 1 ? 'Promotion Active' : 'Promotions Active'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {discounts.map((d) => {
              const discountValue = d.discount_percent
                ? `${d.discount_percent}% OFF`
                : d.flat_discount_amount
                ? `₹${d.flat_discount_amount} OFF`
                : 'SPECIAL DEAL';

              const codeText = d.discount_code || d.code;

              return (
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
                    {codeText && (
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
                        <span>{codeText}</span>
                      </div>
                    )}

                    <div style={{ fontSize: '32px', fontWeight: '900', color: '#1e56a0', margin: '0 0 8px 0' }}>
                      {discountValue}
                    </div>

                    <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                      {d.description ||
                        (d.fish_name
                          ? `Applicable on fresh daily ${d.fish_name}.`
                          : 'Applied automatically at retail counter or via customer app reservation checkout.')}
                    </p>
                  </div>

                  <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <Link
                      href={d.fish_id ? `/fish/${d.fish_id}` : '/fish'}
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
                      <span>{d.fish_id ? 'View Discounted Variety' : 'Browse Eligible Catch'}</span>
                      <ArrowRight size={14} color="#1e56a0" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
