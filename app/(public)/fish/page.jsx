'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FishCard from '../components/FishCard';
import FishCardSkeleton from '../components/FishCardSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { Search, X } from '../components/Icons';

function FishCatalogueContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const searchParam = searchParams.get('search');

  const [fishList, setFishList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState(searchParam || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onlineBookableOnly, setOnlineBookableOnly] = useState(false);

  // Load categories once
  useEffect(() => {
    fetch('/api/v1/public/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch((e) => console.error('Failed to load categories', e));
  }, []);

  // Synchronize category filter whenever URL query parameter or categories list changes
  useEffect(() => {
    if (categoryParam) {
      const p = categoryParam.trim().toLowerCase();
      const matched = categories.find(
        (c) =>
          c.id.toLowerCase() === p ||
          c.slug?.toLowerCase() === p ||
          c.name.toLowerCase() === p ||
          c.name.toLowerCase().includes(p) ||
          p.includes(c.name.toLowerCase()) ||
          (p.includes('freshwater') && c.slug === 'freshwater') ||
          (p.includes('marine') && c.slug === 'marine') ||
          (p.includes('sea') && c.slug === 'marine') ||
          (p.includes('shell') && c.slug === 'shellfish') ||
          (p.includes('prawn') && c.slug === 'shellfish')
      );
      if (matched) {
        setSelectedCategory(matched.id);
      } else {
        setSelectedCategory(categoryParam);
      }
    } else {
      setSelectedCategory('');
    }
  }, [categoryParam, categories]);

  // Synchronize search query parameter
  useEffect(() => {
    if (searchParam !== null) {
      setSearch(searchParam);
    }
  }, [searchParam]);

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
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 64px', width: '100%' }}>
      {/* 1. PAGE HEADER */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
          Real-Time Inventory Counter
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 10px 0' }}>
          Fresh Fish Catalogue
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '680px', lineHeight: '1.6', margin: 0 }}>
          Explore today&apos;s live stock directly available at our Bangalore counter. Filter by water category, freshness tier, and online pre-booking eligibility.
        </p>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '36px',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#64748b' }}>
            <Search size={18} color="#64748b" />
          </span>
          <input
            type="text"
            placeholder="Search fish varieties (e.g. Rohu, Boche, Pomfret, Prawns, Tilapia)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '13px 44px 13px 44px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              color: '#0f2c59',
              fontSize: '14px',
              fontWeight: '500',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
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
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Clear search"
            >
              <X size={16} />
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
                padding: '7px 16px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                border: selectedCategory === '' ? '1px solid #1e56a0' : '1px solid #e2e8f0',
                background: selectedCategory === '' ? '#1e56a0' : '#f8fafc',
                color: selectedCategory === '' ? '#ffffff' : '#425b73',
                transition: 'all 0.15s ease',
              }}
            >
              All Varieties
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '9999px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #1e56a0' : '1px solid #e2e8f0',
                    background: isSelected ? '#1e56a0' : '#f8fafc',
                    color: isSelected ? '#ffffff' : '#425b73',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.name} {cat.fish_count != null ? `(${cat.fish_count})` : ''}
                </button>
              );
            })}
          </div>

          {/* Toggle Switches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#0f2c59', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#1e56a0' }}
              />
              <span>In Counter Only</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#0f2c59', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlineBookableOnly}
                onChange={(e) => setOnlineBookableOnly(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#1e56a0' }}
              />
              <span>Online Bookable</span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1e56a0',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '4px 8px',
                }}
              >
                Reset Filters
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
            message="No fish match your search or filter criteria. Try clearing filters to see the full daily harvest."
            actionLabel="Reset Filters"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            title="Live Catch Arriving Shortly"
            message="Fresh lake fish arrives every morning between 07:00 AM – 08:30 AM via our temperature-controlled fleet."
            actionLabel="Refresh Catalogue"
            onAction={fetchCatalogue}
          />
        )
      ) : (
        <div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '16px' }}>
            Showing <strong style={{ color: '#0f2c59' }}>{fishList.length}</strong> available {fishList.length === 1 ? 'variety' : 'varieties'}
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

export default function FishCataloguePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 64px', width: '100%' }}>
        <FishCardSkeleton />
      </div>
    }>
      <FishCatalogueContent />
    </Suspense>
  );
}
