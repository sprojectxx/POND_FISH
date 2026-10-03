'use client';

import { useState, useEffect } from 'react';
import FishCard from '../components/FishCard';
import FishCardSkeleton from '../components/FishCardSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

export default function FishCataloguePage() {
  const [fishList, setFishList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onlineBookableOnly, setOnlineBookableOnly] = useState(false);

  async function fetchCatalogue() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedCategory) params.set('category', selectedCategory);
      if (inStockOnly) params.set('available', 'true');
      if (onlineBookableOnly) params.set('online_bookable', 'true');

      const url = `/api/v1/public/fish?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to load catalogue from server.');
      }

      const json = await res.json();
      setFishList(json.data || []);
    } catch (err) {
      console.error('[CATALOGUE FETCH ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load categories once and initialize search params from URL
  useEffect(() => {
    fetch('/api/v1/public/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch((e) => console.error('Failed to load categories', e));

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const catParam = urlParams.get('category');
      if (catParam) {
        setSelectedCategory(catParam);
      }
      const searchParam = urlParams.get('search');
      if (searchParam) {
        setSearch(searchParam);
      }
    }
  }, []);

  // Debounced search / filter trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCatalogue();
    }, 250);

    return () => clearTimeout(handler);
  }, [search, selectedCategory, inStockOnly, onlineBookableOnly]);

  function clearFilters() {
    setSearch('');
    setSelectedCategory('');
    setInStockOnly(false);
    setOnlineBookableOnly(false);
  }

  const hasActiveFilters = Boolean(search || selectedCategory || inStockOnly || onlineBookableOnly);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
      {/* 1. PAGE HEADER */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Real-Time Inventory
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '12px' }}>
          Fresh Fish Catalogue
        </h1>
        <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '640px', lineHeight: '1.6' }}>
          Explore today's live stock available at our Bangalore counter. Filter by category, freshness color rating, and online booking reservation eligibility.
        </p>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div style={{
        background: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '36px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#64748B' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search fish varieties (e.g. Rohu, Katla, Pomfret, Prawns)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 44px',
              background: '#0B1120',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#F8FAFC',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Chips & Toggles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Category Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                border: selectedCategory === '' ? '1px solid #0284C7' : '1px solid #334155',
                background: selectedCategory === '' ? '#0284C7' : '#0B1120',
                color: selectedCategory === '' ? '#FFFFFF' : '#94A3B8'
              }}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: selectedCategory === cat.id ? '1px solid #0284C7' : '1px solid #334155',
                  background: selectedCategory === cat.id ? '#0284C7' : '#0B1120',
                  color: selectedCategory === cat.id ? '#FFFFFF' : '#94A3B8'
                }}
              >
                {cat.name} ({cat.fish_count ?? 0})
              </button>
            ))}
          </div>

          {/* Toggle Switches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#F8FAFC', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>In Store Only</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#F8FAFC', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlineBookableOnly}
                onChange={(e) => setOnlineBookableOnly(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Online Bookable Only</span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. FISH GRID & STATE PRESENTATION */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          <FishCardSkeleton />
          <FishCardSkeleton />
          <FishCardSkeleton />
          <FishCardSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCatalogue} />
      ) : fishList.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No Matching Fish Varieties"
            message="No fish match your search or filter criteria. Try adjusting or clearing your active filters."
            actionLabel="Reset Filters"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            title="Catalogue Under Replenishment"
            message="No fish varieties are currently listed in the store counter. Daily catch arrives from our lake harvest between 07:00 AM – 08:30 AM."
            actionLabel="Refresh Catalogue"
            onAction={fetchCatalogue}
          />
        )
      ) : (
        <div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px' }}>
            Showing <strong>{fishList.length}</strong> available fish {fishList.length === 1 ? 'variety' : 'varieties'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {fishList.map((fish) => (
              <FishCard key={fish.id} fish={fish} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
