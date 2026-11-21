'use client';

/**
 * ADMIN-06 — Category Management
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 55-58)
 */

import React, { useState, useEffect } from 'react';
import { AdminSubNav, AdminTableSkeleton } from '@/components/ui';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 1,
    active: true,
  });

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/v1/admin/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load categories.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Lock body scroll and handle Escape key when modals are open
  useEffect(() => {
    const isAnyOpen = Boolean(isModalOpen || deleteTarget);
    if (!isAnyOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setDeleteTarget(null);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, deleteTarget]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      display_order: categories.length + 1,
      active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      display_order: cat.display_order ?? 1,
      active: cat.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const url = editingCategory
        ? `/api/v1/admin/categories/${editingCategory.id}`
        : '/api/v1/admin/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        display_order: Number(formData.display_order) || 1,
        active: Boolean(formData.active),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error?.message || 'Failed to save category.');
      }

      setSuccessMsg(editingCategory ? `Updated category "${formData.name}".` : `Created category "${formData.name}".`);
      setIsModalOpen(false);
      await fetchCategories();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete category.');
      }
      setSuccessMsg(`Category "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      await fetchCategories();
    } catch (err) {
      setErrorMsg(err.message);
      setDeleteTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (cat) => {
    const prevActive = cat.active !== false;
    const nextActive = !prevActive;

    // Instant Optimistic UI Update
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, active: nextActive } : c))
    );
    setTogglingId(cat.id);

    try {
      const res = await fetch(`/api/v1/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, active: prevActive } : c))
        );
        alert(data.error?.message || 'Toggle failed');
      }
    } catch (err) {
      // Rollback
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, active: prevActive } : c))
      );
      alert(err.message || 'Network error updating category status');
    } finally {
      setTogglingId(null);
    }
  };

  const totalFishAssigned = categories.reduce((sum, c) => sum + Number(c.fish_count || 0), 0);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59' }}>
      <AdminSubNav
        tabs={[
          { label: 'Fish Varieties & Stock', href: '/admin/fish', exact: true },
          { label: 'Categories', href: '/admin/categories' },
          { label: 'Discounts & Coupons', href: '/admin/discounts' },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
              Fish Categories
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={fetchCategories}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#1E56A0',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.04)',
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
            id="btn-create-category"
            onClick={openCreateModal}
            style={{
              background: '#1E56A0',
              border: 'none',
              color: '#FFFFFF',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid #EF4444',
          color: '#DC2626',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
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
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
        </div>
      )}

      {/* KPI Cards */}
      <div
        className="pf-admin-metrics-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}
      >
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', letterSpacing: '0.04em' }}>TOTAL CATEGORIES</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', marginTop: '4px' }}>{categories.length}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', letterSpacing: '0.04em' }}>ACTIVE GROUPS</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>
            {categories.filter((c) => c.active !== false).length}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', letterSpacing: '0.04em' }}>TOTAL FISH VARIETIES</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#1E56A0', marginTop: '4px' }}>{totalFishAssigned}</div>
        </div>
      </div>

      {/* Category Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', position: 'relative', minHeight: '350px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.03)' }}>
        {/* Subtle Top Loading Line */}
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

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Category Name</th>
                <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Description</th>
                <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Assigned Varieties</th>
                <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Display Order</th>
                <th style={{ padding: '14px 18px', fontWeight: '600', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={6} rows={4} />
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#1E56A0' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
                      No categories created yet
                    </div>
                    <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '13px' }}>
                      Create categories to organize fresh fish in the customer store and admin catalog.
                    </p>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      style={{
                        background: '#1E56A0',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Create First Category
                    </button>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#EFF6FF', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E56A0', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <span style={{ fontSize: '13.5px' }}>{cat.name}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#64748B', maxWidth: '300px' }}>
                      {cat.description || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No description</span>}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        background: '#EFF6FF',
                        color: '#1E56A0',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #DBEAFE',
                        fontWeight: '600',
                        fontSize: '12px',
                      }}>
                        {cat.fish_count || 0} varieties
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#0F2C59', fontWeight: '700' }}>
                      #{cat.display_order ?? 1}
                    </td>

                    {/* Active Toggle Button */}
                    <td style={{ padding: '14px 18px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(cat)}
                        disabled={togglingId === cat.id}
                        style={{
                          background: cat.active !== false ? '#ECFDF5' : '#F1F5F9',
                          border: `1px solid ${cat.active !== false ? '#A7F3D0' : '#CBD5E1'}`,
                          color: cat.active !== false ? '#065F46' : '#334155',
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: togglingId === cat.id ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                          opacity: togglingId === cat.id ? 0.75 : 1,
                        }}
                        title="Click to toggle category visibility"
                      >
                        {togglingId === cat.id ? (
                          <svg className="pf-animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                        ) : (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: cat.active !== false ? '#10B981' : '#64748B',
                            }}
                          />
                        )}
                        <span>{togglingId === cat.id ? 'Updating...' : cat.active !== false ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(cat)}
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
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#DBEAFE'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#EFF6FF'; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
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
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#FECACA'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FEE2E2'; }}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 44, 89, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            className="pf-admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '500px',
              padding: '26px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overscrollBehavior: 'contain',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                  {editingCategory ? `Edit: ${editingCategory.name}` : 'Create Category'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Define category name, culinary description, and ordering.
                </p>
              </div>
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
                onMouseEnter={(e) => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F2C59'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F2C59', marginBottom: '6px' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Freshwater Fish"
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

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F2C59', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Freshwater river and pond fish varieties, delivered fresh daily."
                  style={{
                    width: '100%',
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#0F2C59',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F2C59', marginBottom: '6px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F2C59', marginBottom: '6px' }}>
                    Active Status
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '9px 12px',
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    color: '#0F2C59',
                    fontWeight: '600',
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#1E56A0', cursor: 'pointer' }}
                    />
                    <span>Active in Catalog</span>
                  </label>
                </div>
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
                    padding: '9px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {actionLoading ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern, Friendly Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 44, 89, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            className="pf-admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              overscrollBehavior: 'contain',
            }}
          >
            {/* Warning Icon Badge */}
            <div style={{
              width: '54px',
              height: '54px',
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
              Do you really want to delete this category?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong style={{ color: '#0F2C59' }}>{deleteTarget.name}</strong>?
              {Number(deleteTarget.fish_count) > 0 && (
                <span style={{ display: 'block', color: '#DC2626', fontWeight: '600', marginTop: '6px' }}>
                  Warning: {deleteTarget.fish_count} fish varieties currently belong to this category. Deletion is blocked while varieties are assigned.
                </span>
              )}
            </p>

            {/* Target Item Summary Card */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#EFF6FF',
                border: '1px solid #DBEAFE',
                color: '#1E56A0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', color: '#0F2C59', fontSize: '13px' }}>{deleteTarget.name}</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                  {deleteTarget.fish_count || 0} varieties assigned • Order #{deleteTarget.display_order ?? 1}
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
                {actionLoading ? 'Deleting...' : 'Yes, Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
