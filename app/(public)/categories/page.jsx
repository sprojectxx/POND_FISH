'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { FishIcon, ArrowRight } from '../components/Icons';

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
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 64px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
          Catalogue Categories
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 10px 0' }}>
          Explore by Variety & Water Origin
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '680px', lineHeight: '1.6', margin: 0 }}>
          Browse our certified freshwater lake fish, premium sea catch, and specialty boneless cuts transported daily under 2°C–4°C cold-chain standards to our Bangalore retail counter.
        </p>
      </div>

      {/* 2. Content States */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '24px',
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '28px',
                height: '220px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
              }}
            >
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', marginBottom: '16px' }} />
                <div style={{ width: '60%', height: '20px', borderRadius: '4px', background: '#e2e8f0', marginBottom: '10px' }} />
                <div style={{ width: '90%', height: '14px', borderRadius: '4px', background: '#f1f5f9' }} />
              </div>
              <div style={{ width: '40%', height: '14px', borderRadius: '4px', background: '#e2e8f0' }} />
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
          message="There are currently no active fish categories published. Check back shortly or browse all available fish varieties directly."
          actionLabel="Browse All Fish"
          onAction={() => { window.location.href = '/fish'; }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: '#e0f2fe',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                    marginBottom: '18px',
                  }}
                >
                  <FishIcon size={24} color="#0284c7" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
                  {cat.name}
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                  {cat.description || 'Fresh daily harvest sourced from trusted local water bodies and regional cold chain partners.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                  {cat.fish_count != null ? `${cat.fish_count} Varieties Listed` : 'Fresh Daily'}
                </span>

                <Link
                  href={`/fish?category=${encodeURIComponent(cat.id || cat.name)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#1e56a0',
                    textDecoration: 'none',
                  }}
                >
                  <span>Explore Catch</span>
                  <ArrowRight size={14} color="#1e56a0" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
