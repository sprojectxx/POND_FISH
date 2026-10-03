'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchCategories() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/categories');
      if (!res.ok) {
        throw new Error('Failed to load categories from server.');
      }
      const json = await res.json();
      setCategories(json.data || []);
    } catch (err) {
      console.error('[CATEGORIES FETCH ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Catalogue Categories
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '12px' }}>
          Explore by Variety & Origin
        </h1>
        <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '680px', lineHeight: '1.6' }}>
          Browse our sustainable freshwater lake fish, premium sea catch, and specialty river varieties transported daily under cold-chain standards to our Bangalore counter.
        </p>
      </div>

      {/* 2. Content States */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '12px',
                padding: '28px',
                height: '220px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#1E293B', marginBottom: '16px' }}></div>
                <div style={{ width: '60%', height: '20px', borderRadius: '4px', background: '#1E293B', marginBottom: '10px' }}></div>
                <div style={{ width: '90%', height: '14px', borderRadius: '4px', background: '#1E293B' }}></div>
              </div>
              <div style={{ width: '40%', height: '14px', borderRadius: '4px', background: '#1E293B' }}></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Categories Unavailable"
          message={error}
          onRetry={fetchCategories}
        />
      ) : categories.length === 0 ? (
        <EmptyState
          title="No Categories Configured"
          message="There are currently no active fish categories published in the database. Please check back shortly or browse all available fish varieties directly."
          actionText="Browse All Fish"
          actionHref="/fish"
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '12px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
            >
              <div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: 'rgba(2, 132, 199, 0.15)',
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  marginBottom: '18px'
                }}>
                  🐟
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
                  {cat.name}
                </h3>
                <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '20px' }}>
                  {cat.description || 'Fresh daily harvest sourced from trusted local water bodies and regional cold chain partners.'}
                </p>
              </div>

              <Link
                href={`/fish?category=${encodeURIComponent(cat.name)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#38BDF8',
                  fontSize: '14px',
                  fontWeight: '700',
                  textDecoration: 'none'
                }}
              >
                <span>Browse {cat.name}</span>
                <span>&rarr;</span>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 3. Bottom Information Banner */}
      <div style={{
        marginTop: '64px',
        padding: '32px',
        background: 'linear-gradient(180deg, #0F172A 0%, #070D19 100%)',
        border: '1px solid #1E293B',
        borderRadius: '12px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '6px' }}>
            Looking for something specific?
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.5' }}>
            Our Bangalore counter receives new stock every morning between 07:00 AM and 08:30 AM. Call our counter directly for special whole-fish requests.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href="/fish"
            style={{
              padding: '12px 24px',
              background: '#0284C7',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              textDecoration: 'none'
            }}
          >
            Open Live Catalogue
          </Link>
          <Link
            href="/contact"
            style={{
              padding: '12px 24px',
              background: '#1E293B',
              color: '#F8FAFC',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              textDecoration: 'none',
              border: '1px solid #334155'
            }}
          >
            Contact Counter
          </Link>
        </div>
      </div>
    </div>
  );
}
