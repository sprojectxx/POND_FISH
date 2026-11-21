'use client';

/**
 * ADMIN-05 — Fish Varieties & Stock Management
 * Coastal Storefront Theme Alignment (Ported from PondFish Public Storefront)
 * Cloudflare Edge Cache CDN Integration ($0 egress)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AdminSubNav, AdminPagination, AdminSelect, AdminTableSkeleton } from '@/components/ui';

// Cloudflare Edge Cache CDN normalizer
const FISH_CDN_BASE = 'https://pondfish-cdn.sprojectxx.workers.dev/fish-assets';

function getCdnImageUrl(url) {
  if (!url) return null;
  if (url.includes('workers.dev')) return url;
  if (url.includes('/fish-assets/')) {
    const filename = url.split('/fish-assets/').pop();
    return `${FISH_CDN_BASE}/${filename}`;
  }
  return url;
}

export default function AdminFishPage() {
  const [fishList, setFishList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [freshnessFilter, setFreshnessFilter] = useState('ALL');
  const [eligibilityFilter, setEligibilityFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [actionLoading, setActionLoading] = useState(false);
  const [togglingKey, setTogglingKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // View Mode: Default to 'grid' for the vibrant coastal storefront look
  const [viewMode, setViewMode] = useState('grid');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFish, setEditingFish] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    unit_price: '',
    freshness_state: 'GREEN',
    online_bookable: true,
    physical_available: true,
    description: '',
    image_url: '',
  });

  // Image Upload & Preview State
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const fileInputRef = useRef(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [fishRes, catRes] = await Promise.all([
        fetch('/api/v1/admin/fish'),
        fetch('/api/v1/admin/categories'),
      ]);

      const fishData = await fishRes.json();
      const catData = await catRes.json();

      if (fishData.success) {
        setFishList(fishData.fish || []);
      } else {
        setErrorMsg(fishData.error?.message || 'Failed to load fish catalog.');
      }

      if (catData.success) {
        setCategories(catData.categories || []);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingFish(null);
    setFormData({
      name: '',
      category_id: categories[0]?.id || '',
      unit_price: '',
      freshness_state: 'GREEN',
      online_bookable: true,
      physical_available: true,
      description: '',
      image_url: '',
    });
    setImagePreview('');
    setShowManualUrlInput(false);
    setIsModalOpen(true);
  };

  const openEditModal = (fish) => {
    setEditingFish(fish);
    setFormData({
      name: fish.name || '',
      category_id: fish.category_id || '',
      unit_price: fish.unit_price || '',
      freshness_state: fish.freshness_state || 'GREEN',
      online_bookable: Boolean(fish.online_bookable),
      physical_available: Boolean(fish.physical_available),
      description: fish.description || '',
      image_url: fish.image_url || '',
    });
    setImagePreview(fish.image_url || '');
    setShowManualUrlInput(false);
    setIsModalOpen(true);
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setImagePreview(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setIsUploadingImage(true);
      const uploadData = new FormData();
      uploadData.append('file', file);

      const res = await fetch('/api/v1/admin/upload', {
        method: 'POST',
        body: uploadData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setFormData((prev) => ({ ...prev, image_url: data.url }));
        setImagePreview(data.url);
      } else {
        const fallbackUrl = reader.result;
        setFormData((prev) => ({ ...prev, image_url: fallbackUrl }));
      }
    } catch (uploadErr) {
      console.warn('Image upload endpoint unavailable, keeping local preview', uploadErr);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setFormData((prev) => ({ ...prev, image_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveFish = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const url = editingFish ? `/api/v1/admin/fish/${editingFish.id}` : '/api/v1/admin/fish';
      const method = editingFish ? 'PATCH' : 'POST';

      const payload = {
        name: formData.name,
        category_id: formData.category_id,
        unit_price: Number(formData.unit_price),
        freshness_state: formData.freshness_state,
        online_bookable: formData.online_bookable,
        physical_available: formData.physical_available,
        description: formData.description,
        image_url: formData.image_url,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error?.message || 'Failed to save fish.');
      }

      setSuccessMsg(editingFish ? `Updated "${formData.name}" successfully.` : `Added "${formData.name}" to catalog.`);
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickToggle = async (fish, field) => {
    const key = `${fish.id}_${field}`;
    const previousValue = Boolean(fish[field]);
    const updatedValue = !previousValue;

    // 1. Instant Optimistic UI Update: state updates instantly in 0ms with zero user wait time
    setFishList((prev) =>
      prev.map((f) => (f.id === fish.id ? { ...f, [field]: updatedValue } : f))
    );
    setTogglingKey(key);

    try {
      const res = await fetch(`/api/v1/admin/fish/${fish.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: updatedValue }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback to previous state on server error
        setFishList((prev) =>
          prev.map((f) => (f.id === fish.id ? { ...f, [field]: previousValue } : f))
        );
        alert(data.error?.message || 'Update failed');
      }
    } catch (err) {
      // Rollback to previous state on network exception
      setFishList((prev) =>
        prev.map((f) => (f.id === fish.id ? { ...f, [field]: previousValue } : f))
      );
      alert(err.message || 'Network error updating status');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/fish/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Delete operation failed.');
      }
      setSuccessMsg(`"${deleteTarget.name}" deleted from catalog.`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message);
      setDeleteTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered list
  const filteredList = useMemo(() => {
    return fishList.filter((f) => {
      const matchSearch =
        !search ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.category_name && f.category_name.toLowerCase().includes(search.toLowerCase()));

      const matchCat = categoryFilter === 'ALL' || f.category_id === categoryFilter;
      const matchFresh = freshnessFilter === 'ALL' || f.freshness_state === freshnessFilter;
      const matchElig =
        eligibilityFilter === 'ALL' ||
        (eligibilityFilter === 'ONLINE' && f.online_bookable) ||
        (eligibilityFilter === 'PHYSICAL' && f.physical_available) ||
        (eligibilityFilter === 'OFFLINE' && !f.online_bookable && !f.physical_available);

      return matchSearch && matchCat && matchFresh && matchElig;
    });
  }, [fishList, search, categoryFilter, freshnessFilter, eligibilityFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, freshnessFilter, eligibilityFilter]);

  const totalPages = Math.ceil(filteredList.length / limit) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredList.slice(start, start + limit);
  }, [filteredList, page, limit]);

  // Metrics
  const metrics = useMemo(() => {
    const total = fishList.length;
    const online = fishList.filter((f) => f.online_bookable).length;
    const freshCount = fishList.filter((f) => f.freshness_state === 'GREEN').length;
    const totalStock = fishList.reduce((acc, f) => acc + Number(f.available_quantity || 0), 0);
    return { total, online, freshCount, totalStock };
  }, [fishList]);

  // Helper for freshness styling matching the storefront theme
  const getFreshnessMeta = (state) => {
    switch (state) {
      case 'GREEN':
        return {
          bg: '#ECFDF5',
          border: '#A7F3D0',
          color: '#047857',
          dot: '#10B981',
          label: '0–24H FRESH CATCH',
        };
      case 'GREY':
        return {
          bg: '#F1F5F9',
          border: '#CBD5E1',
          color: '#475569',
          dot: '#94A3B8',
          label: '24–48H AGING',
        };
      case 'YELLOW':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          color: '#B45309',
          dot: '#F59E0B',
          label: 'SPECIAL CATCH',
        };
      case 'RED':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          color: '#B91C1C',
          dot: '#EF4444',
          label: '48H+ MARKDOWN',
        };
      default:
        return {
          bg: '#F8FAFC',
          border: '#E2E8F0',
          color: '#64748B',
          dot: '#94A3B8',
          label: state || 'Fresh Catch',
        };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59' }}>
      <AdminSubNav
        tabs={[
          { label: 'Fish Varieties & Stock', href: '/admin/fish', exact: true },
          { label: 'Categories', href: '/admin/categories' },
          { label: 'Discounts & Coupons', href: '/admin/discounts' },
        ]}
      />

      {/* Hero Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '-0.03em', margin: 0, color: '#0F2C59' }}>
            Fish Varieties & Inventory
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* View Toggle: Cards vs Table */}
          <div
            style={{
              display: 'inline-flex',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '3px',
              boxShadow: '0 2px 6px rgba(15, 44, 89, 0.04)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                background: viewMode === 'grid' ? '#1E56A0' : 'transparent',
                color: viewMode === 'grid' ? '#FFFFFF' : '#64748B',
                fontWeight: viewMode === 'grid' ? '700' : '600',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Showcase Cards View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Showcase Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                background: viewMode === 'table' ? '#1E56A0' : 'transparent',
                color: viewMode === 'table' ? '#FFFFFF' : '#64748B',
                fontWeight: viewMode === 'table' ? '700' : '600',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Dense Table View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#1E56A0',
              padding: '9px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(15, 44, 89, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Refresh</span>
          </button>

          <button
            id="btn-create-fish"
            onClick={openCreateModal}
            style={{
              background: '#1E56A0',
              border: 'none',
              color: '#FFFFFF',
              padding: '9px 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 3px 10px rgba(30, 86, 160, 0.28)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add New Fish</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid #EF4444',
          color: '#DC2626',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid #10B981',
          color: '#065F46',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
        </div>
      )}

      {/* KPI Highlight Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>TOTAL VARIETIES</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#0F2C59', marginTop: '4px' }}>{metrics.total}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ONLINE BOOKABLE</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#1E56A0', marginTop: '4px' }}>{metrics.online}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>FRESH CATCH (0-24H)</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#10B981', marginTop: '4px' }}>{metrics.freshCount}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>COUNTER STOCK</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#D97706', marginTop: '4px' }}>
            {metrics.totalStock.toFixed(1)} <span style={{ fontSize: '16px', fontWeight: '700', color: '#64748B' }}>kg</span>
          </div>
        </div>
      </div>

      {/* Category Navigation Pills & Filters */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)',
      }}>
        {/* Row 1: Category Filter Pills */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '14px',
          borderBottom: '1px solid #F1F5F9',
          marginBottom: '14px',
        }}>
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            style={{
              padding: '7px 18px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              border: categoryFilter === 'ALL' ? '1px solid #1E56A0' : '1px solid #E2E8F0',
              background: categoryFilter === 'ALL' ? '#1E56A0' : '#F8FAFC',
              color: categoryFilter === 'ALL' ? '#FFFFFF' : '#425B73',
              boxShadow: categoryFilter === 'ALL' ? '0 2px 6px rgba(30, 86, 160, 0.25)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            All Varieties ({fishList.length})
          </button>

          {categories.map((c) => {
            const isSelected = categoryFilter === c.id;
            const count = fishList.filter((f) => f.category_id === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                style={{
                  padding: '7px 18px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #1E56A0' : '1px solid #E2E8F0',
                  background: isSelected ? '#1E56A0' : '#F8FAFC',
                  color: isSelected ? '#FFFFFF' : '#425B73',
                  boxShadow: isSelected ? '0 2px 6px rgba(30, 86, 160, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Row 2: Search & Channel / Freshness Dropdowns */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              id="fish-search-input"
              type="text"
              placeholder="Search fish varieties (e.g. Rohu, Murrel, Pomfret, Prawns, Tilapia)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                padding: '10px 14px 10px 40px',
                color: '#0F2C59',
                fontSize: '13.5px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
            />
          </div>

          <AdminSelect
            value={freshnessFilter}
            onChange={(val) => setFreshnessFilter(val)}
            options={[
              { value: 'ALL', label: 'All Freshness Tiers' },
              { value: 'GREEN', label: 'Green (0–24h Fresh Catch)' },
              { value: 'GREY', label: 'Grey (24–48h Aging)' },
              { value: 'YELLOW', label: 'Yellow (Special Catch)' },
              { value: 'RED', label: 'Red (48h+ Markdown)' },
            ]}
            style={{ minWidth: '190px' }}
          />

          <AdminSelect
            value={eligibilityFilter}
            onChange={(val) => setEligibilityFilter(val)}
            options={[
              { value: 'ALL', label: 'All Sales Channels' },
              { value: 'ONLINE', label: 'Online Bookable Only' },
              { value: 'PHYSICAL', label: 'Physical Store Only' },
              { value: 'OFFLINE', label: 'Unlisted / Inactive' },
            ]}
            style={{ minWidth: '185px' }}
          />
        </div>
      </div>

      {/* Main Fish Content Area: Showcase Cards or Dense Table */}
      <div style={{ position: 'relative', minHeight: '400px' }}>
        {/* Top Loading Progress Line */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#E2E8F0',
              overflow: 'hidden',
              borderRadius: '2px',
              zIndex: 10,
            }}
          >
            <div
              className="pf-animate-indeterminate"
              style={{
                width: '45%',
                height: '100%',
                background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)',
                borderRadius: '2px',
              }}
            />
          </div>
        )}

        {viewMode === 'grid' ? (
          /* SHOWCASE CARDS VIEW */
          <div>
            {loading ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '22px',
              }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', height: '320px', overflow: 'hidden' }}>
                    <div className="pf-animate-shimmer" style={{ width: '100%', height: '180px', background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)', backgroundSize: '200% 100%' }} />
                    <div style={{ padding: '16px' }}>
                      <div className="pf-animate-shimmer" style={{ width: '60%', height: '18px', background: '#F1F5F9', borderRadius: '4px', marginBottom: '10px' }} />
                      <div className="pf-animate-shimmer" style={{ width: '40%', height: '22px', background: '#F1F5F9', borderRadius: '4px', marginTop: '20px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredList.length === 0 ? (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '64px 24px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
              }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#1E56A0' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: '0 0 6px' }}>No fish varieties found</h3>
                <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '13.5px' }}>
                  Try resetting your category or freshness filters to see all available inventory.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('ALL');
                    setFreshnessFilter('ALL');
                    setEligibilityFilter('ALL');
                  }}
                  style={{
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '22px',
                marginBottom: '24px',
              }}>
                {paginatedList.map((f) => {
                  const freshMeta = getFreshnessMeta(f.freshness_state);
                  const displayImg = getCdnImageUrl(f.image_url);
                  const isOnlineToggling = togglingKey === `${f.id}_online_bookable`;
                  const isStoreToggling = togglingKey === `${f.id}_physical_available`;

                  return (
                    <article
                      key={f.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      {/* Image Frame (Matching Storefront FishCard: 180px, contain, light bg) */}
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '180px',
                          backgroundColor: '#F8FAFC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        {displayImg ? (
                          <img
                            src={displayImg}
                            alt={f.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              padding: '14px',
                              transition: 'transform 0.3s ease',
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement.querySelector('.fallback-icon')?.removeAttribute('style');
                            }}
                          />
                        ) : null}

                        <div
                          className="fallback-icon"
                          style={{
                            display: displayImg ? 'none' : 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            color: '#94A3B8',
                          }}
                        >
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 16s9-15 20-4c-5-2-12-1-20 4z" />
                            <circle cx="17" cy="11" r="1" />
                          </svg>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {f.category_name || 'Fresh Catch'}
                          </span>
                        </div>

                        {/* Storefront Freshness Pill (Top Left) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.04em',
                            background: freshMeta.bg,
                            color: freshMeta.color,
                            border: `1px solid ${freshMeta.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: freshMeta.dot }} />
                          <span>{freshMeta.label}</span>
                        </div>

                        {/* Storefront Category Pill (Top Right) */}
                        {f.category_name && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              background: 'rgba(255, 255, 255, 0.94)',
                              color: '#1E56A0',
                              border: '1px solid #BFDBFE',
                              backdropFilter: 'blur(4px)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            }}
                          >
                            {f.category_name}
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '16.5px', fontWeight: '900', color: '#0F2C59', margin: '0 0 2px 0', lineHeight: '1.3' }}>
                            {f.name}
                          </h3>
                        </div>

                        {/* Price & Stock Metric Row */}
                        <div style={{
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          padding: '10px 14px',
                          margin: '4px 0 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: '#1E56A0' }}>
                                ₹{Number(f.unit_price).toFixed(2)}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>/ kg</span>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: Number(f.available_quantity) > 0 ? '#0F2C59' : '#DC2626' }}>
                              {Number(f.available_quantity || 0).toFixed(1)} kg left
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                              Phys: {Number(f.physical_quantity || 0).toFixed(1)} | Res: {Number(f.reserved_quantity || 0).toFixed(1)}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Channel Toggles with Smooth Loading Spinner & Highlighted Off Text */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => handleQuickToggle(f, 'online_bookable')}
                            disabled={isOnlineToggling}
                            style={{
                              padding: '7px 8px',
                              borderRadius: '8px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              cursor: isOnlineToggling ? 'wait' : 'pointer',
                              border: `1px solid ${f.online_bookable ? '#A7F3D0' : '#CBD5E1'}`,
                              background: f.online_bookable ? '#ECFDF5' : '#F1F5F9',
                              color: f.online_bookable ? '#065F46' : '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                              opacity: isOnlineToggling ? 0.75 : 1,
                            }}
                            title="Toggle Online Pre-booking Eligibility"
                          >
                            {isOnlineToggling ? (
                              <svg className="pf-animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" />
                              </svg>
                            ) : (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.online_bookable ? '#10B981' : '#64748B' }} />
                            )}
                            <span>{isOnlineToggling ? 'Updating...' : f.online_bookable ? 'Online: Active' : 'Online: Off'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickToggle(f, 'physical_available')}
                            disabled={isStoreToggling}
                            style={{
                              padding: '7px 8px',
                              borderRadius: '8px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              cursor: isStoreToggling ? 'wait' : 'pointer',
                              border: `1px solid ${f.physical_available ? '#BFDBFE' : '#CBD5E1'}`,
                              background: f.physical_available ? '#EFF6FF' : '#F1F5F9',
                              color: f.physical_available ? '#1E56A0' : '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                              opacity: isStoreToggling ? 0.75 : 1,
                            }}
                            title="Toggle Store Counter Availability"
                          >
                            {isStoreToggling ? (
                              <svg className="pf-animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" />
                              </svg>
                            ) : (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.physical_available ? '#1E56A0' : '#64748B' }} />
                            )}
                            <span>{isStoreToggling ? 'Updating...' : f.physical_available ? 'Store: Active' : 'Store: Off'}</span>
                          </button>
                        </div>

                        {/* Admin Action Buttons */}
                        <div style={{
                          paddingTop: '12px',
                          borderTop: '1px solid #F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(f)}
                            style={{
                              flex: 1,
                              background: '#EFF6FF',
                              border: '1px solid #DBEAFE',
                              color: '#1E56A0',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#DBEAFE'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#EFF6FF'; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Edit Variety</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(f)}
                            style={{
                              background: '#FEF2F2',
                              border: '1px solid #FEE2E2',
                              color: '#DC2626',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            title="Delete this variety"
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#FECACA'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FEE2E2'; }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* DENSE TABLE VIEW */
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)', marginBottom: '24px' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Fish Variety</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Category</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Unit Price</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Inventory (Avail / Phys / Res)</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Freshness State</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Online Booking</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Physical Store</th>
                    <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <AdminTableSkeleton columns={8} rows={5} />
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
                        No fish varieties match the specified filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((f) => {
                      const freshMeta = getFreshnessMeta(f.freshness_state);
                      const displayImg = getCdnImageUrl(f.image_url);
                      const isOnlineToggling = togglingKey === `${f.id}_online_bookable`;
                      const isStoreToggling = togglingKey === `${f.id}_physical_available`;

                      return (
                        <tr key={f.id} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}>
                          {/* Fish Variety & Image */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                {displayImg ? (
                                  <img
                                    src={displayImg}
                                    alt={f.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                                  />
                                ) : (
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 16s9-15 20-4c-5-2-12-1-20 4z" />
                                    <circle cx="17" cy="11" r="1" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: '#0F2C59', fontSize: '13.5px' }}>{f.name}</div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td style={{ padding: '14px 18px', color: '#425B73' }}>
                            <span style={{
                              background: '#EFF6FF',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #DBEAFE',
                              color: '#1E56A0',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}>
                              {f.category_name || 'Unassigned'}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: '800', color: '#0F2C59', fontSize: '14px' }}>
                              ₹{Number(f.unit_price).toFixed(2)}
                              <span style={{ fontWeight: '500', color: '#64748B', fontSize: '12px' }}> / kg</span>
                            </div>
                          </td>

                          {/* Inventory */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: '700', color: Number(f.available_quantity) > 0 ? '#0F2C59' : '#DC2626', fontSize: '13px' }}>
                              {Number(f.available_quantity || 0).toFixed(1)} kg
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap' }}>
                              Phys: <span style={{ color: '#0F2C59', fontWeight: '600' }}>{Number(f.physical_quantity || 0).toFixed(1)}</span> | Res: <span style={{ color: '#64748B' }}>{Number(f.reserved_quantity || 0).toFixed(1)}</span>
                            </div>
                          </td>

                          {/* Freshness State */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: freshMeta.bg,
                              color: freshMeta.color,
                              border: `1px solid ${freshMeta.border}`,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: freshMeta.dot }} />
                              {f.freshness_state}
                            </span>
                          </td>

                          {/* Online Booking Toggle */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickToggle(f, 'online_bookable')}
                              disabled={isOnlineToggling}
                              style={{
                                background: f.online_bookable ? '#ECFDF5' : '#F1F5F9',
                                border: `1px solid ${f.online_bookable ? '#A7F3D0' : '#CBD5E1'}`,
                                color: f.online_bookable ? '#065F46' : '#334155',
                                padding: '5px 12px',
                                borderRadius: '20px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                cursor: isOnlineToggling ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                                opacity: isOnlineToggling ? 0.75 : 1,
                              }}
                            >
                              {isOnlineToggling ? (
                                <svg className="pf-animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                  <path d="M12 2a10 10 0 0 1 10 10" />
                                </svg>
                              ) : (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.online_bookable ? '#10B981' : '#64748B' }} />
                              )}
                              <span>{isOnlineToggling ? 'Updating...' : f.online_bookable ? 'Bookable' : 'Disabled'}</span>
                            </button>
                          </td>

                          {/* Physical Store Toggle */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickToggle(f, 'physical_available')}
                              disabled={isStoreToggling}
                              style={{
                                background: f.physical_available ? '#EFF6FF' : '#F1F5F9',
                                border: `1px solid ${f.physical_available ? '#BFDBFE' : '#CBD5E1'}`,
                                color: f.physical_available ? '#1E56A0' : '#334155',
                                padding: '5px 12px',
                                borderRadius: '20px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                cursor: isStoreToggling ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                                opacity: isStoreToggling ? 0.75 : 1,
                              }}
                            >
                              {isStoreToggling ? (
                                <svg className="pf-animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                  <path d="M12 2a10 10 0 0 1 10 10" />
                                </svg>
                              ) : (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.physical_available ? '#1E56A0' : '#64748B' }} />
                              )}
                              <span>{isStoreToggling ? 'Updating...' : f.physical_available ? 'In Store' : 'Unavailable'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => openEditModal(f)}
                                style={{
                                  background: '#EFF6FF',
                                  border: '1px solid #DBEAFE',
                                  color: '#1E56A0',
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(f)}
                                style={{
                                  background: '#FEF2F2',
                                  border: '1px solid #FEE2E2',
                                  color: '#DC2626',
                                  padding: '6px 10px',
                                  borderRadius: '7px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Global Pagination */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '6px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={filteredList.length}
            limit={limit}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            itemName="fish varieties"
            loading={loading}
          />
        </div>
      </div>

      {/* Clean, Elegantly Proportioned Create / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 44, 89, 0.5)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '88vh',
            overflowY: 'auto',
            padding: '26px 28px',
            boxShadow: '0 25px 35px -5px rgba(15, 44, 89, 0.25)',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#0F2C59' }}>
                {editingFish ? `Edit: ${editingFish.name}` : 'Add New Fish Variety'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F2C59'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveFish}>
              {/* Variety Name & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
                    Fish Variety Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rohu Fresh Catch"
                    style={{
                      width: '100%',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      color: '#0F2C59',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <AdminSelect
                    value={formData.category_id}
                    onChange={(val) => setFormData({ ...formData, category_id: val })}
                    options={[
                      { value: '', label: 'Select Category' },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Price & Freshness */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
                    Unit Price (₹ per kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    placeholder="250.00"
                    style={{
                      width: '100%',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      color: '#0F2C59',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
                    Freshness Tier
                  </label>
                  <AdminSelect
                    value={formData.freshness_state}
                    onChange={(val) => setFormData({ ...formData, freshness_state: val })}
                    options={[
                      { value: 'GREEN', label: 'GREEN (0–24h Fresh Catch)' },
                      { value: 'GREY', label: 'GREY (24–48h Aging)' },
                      { value: 'YELLOW', label: 'YELLOW (Special / Monitored)' },
                      { value: 'RED', label: 'RED (>48h Expired / Halt)' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Photo Upload & Preview Card */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
                  Product Photo
                </label>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleImageFileChange}
                  style={{ display: 'none' }}
                />

                {imagePreview ? (
                  /* Image Preview Card */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                  }}>
                    <div style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      flexShrink: 0,
                    }}>
                      <img
                        src={getCdnImageUrl(imagePreview)}
                        alt="Fish Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F2C59' }}>
                        Image Attached
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            color: '#1E56A0',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          {isUploadingImage ? 'Uploading...' : 'Change Photo'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #FEE2E2',
                            color: '#DC2626',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Modern Coastal Dropzone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '10px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1E56A0'; e.currentTarget.style.background = '#EFF6FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', color: '#1E56A0' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F2C59' }}>
                      {isUploadingImage ? 'Uploading...' : 'Click to select fish photo'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      PNG, JPG, or WEBP (Cloudflare CDN $0 Egress)
                    </div>
                  </div>
                )}

                {/* Optional Manual URL input */}
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1E56A0',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: '700',
                      textDecoration: 'underline',
                    }}
                  >
                    {showManualUrlInput ? 'Hide manual image URL' : 'Or paste a direct image URL'}
                  </button>
                  {showManualUrlInput && (
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => {
                        setFormData({ ...formData, image_url: e.target.value });
                        setImagePreview(e.target.value);
                      }}
                      placeholder="https://..."
                      style={{
                        width: '100%',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '7px 10px',
                        color: '#0F2C59',
                        fontSize: '12px',
                        marginTop: '6px',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Channels checkboxes */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                gap: '24px',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0F2C59' }}>
                  <input
                    type="checkbox"
                    checked={formData.online_bookable}
                    onChange={(e) => setFormData({ ...formData, online_bookable: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#1E56A0', cursor: 'pointer' }}
                  />
                  <span>Online Booking Eligible</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0F2C59' }}>
                  <input
                    type="checkbox"
                    checked={formData.physical_available}
                    onChange={(e) => setFormData({ ...formData, physical_available: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#1E56A0', cursor: 'pointer' }}
                  />
                  <span>Physical Store Available</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: '#1E56A0',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {actionLoading ? 'Saving...' : editingFish ? 'Update Fish' : 'Create Fish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern, Friendly Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 44, 89, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '26px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
          }}>
            {/* Warning Icon Badge */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#DC2626',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0F2C59', fontWeight: '800' }}>
              Do you really want to delete this fish?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong style={{ color: '#0F2C59' }}>{deleteTarget.name}</strong> from the catalog? This will remove it from both online booking and physical counter sales.
            </p>

            {/* Target Item Summary Card */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              textAlign: 'left',
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {deleteTarget.image_url ? (
                  <img
                    src={getCdnImageUrl(deleteTarget.image_url)}
                    alt={deleteTarget.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                  />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 16s9-15 20-4c-5-2-12-1-20 4z" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', color: '#0F2C59', fontSize: '13.5px' }}>{deleteTarget.name}</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                  {deleteTarget.category_name || 'Unassigned'} • ₹{Number(deleteTarget.unit_price).toFixed(2)}/kg
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                No, Keep It
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete Fish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
