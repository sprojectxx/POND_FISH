'use client';

/**
 * ADMIN-06 — Category Management
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 55-58)
 */

import React, { useState, useEffect } from 'react';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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

      setSuccessMsg(editingCategory ? 'Category updated successfully.' : 'New category created.');
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
      setSuccessMsg(`"${deleteTarget.name}" deleted successfully.`);
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
    try {
      const res = await fetch(`/api/v1/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !cat.active }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, active: !c.active } : c))
        );
      } else {
        alert(data.error?.message || 'Toggle failed');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const totalFishAssigned = categories.reduce((sum, c) => sum + Number(c.fish_count || 0), 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              Category Management
            </h1>
            <span style={{
              background: '#0284C7',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '0.05em'
            }}>
              ADMIN-06
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: '14px' }}>
            Organize fish varieties into public catalog groupings with display ordering and visibility controls.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={fetchCategories}
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#CBD5E1',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
          <button
            id="btn-create-category"
            onClick={openCreateModal}
            style={{
              background: '#0284C7',
              border: 'none',
              color: '#FFFFFF',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>+</span> Create Category
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #EF4444',
          color: '#FCA5A5',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10B981',
          color: '#6EE7B7',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>TOTAL CATEGORIES</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#F8FAFC', marginTop: '4px' }}>{categories.length}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>ACTIVE GROUPS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>
            {categories.filter((c) => c.active !== false).length}
          </div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>TOTAL FISH SPECIES</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#38BDF8', marginTop: '4px' }}>{totalFishAssigned}</div>
        </div>
      </div>

      {/* Category Table */}
      <div style={{ background: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Category Name</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Description</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Assigned Fish</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Display Order</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Visibility</th>
              <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  Loading category list...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#F8FAFC', marginBottom: '6px' }}>
                    No categories created yet.
                  </div>
                  <p style={{ margin: '0 0 16px', color: '#64748B' }}>
                    Create a category to organize fish in the catalog.
                  </p>
                  <button
                    onClick={openCreateModal}
                    style={{
                      background: '#0284C7',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Create Category
                  </button>
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '14px 18px', fontWeight: '600', color: '#F8FAFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#38BDF8' }}>📁</span>
                      <span>{cat.name}</span>
                    </div>
                  </td>

                  <td style={{ padding: '14px 18px', color: '#94A3B8', maxWidth: '300px' }}>
                    {cat.description || <span style={{ color: '#64748B', fontStyle: 'italic' }}>No description</span>}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      background: '#0F172A',
                      color: '#CBD5E1',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      fontWeight: '600',
                    }}>
                      {cat.fish_count || 0} varieties
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px', color: '#F8FAFC', fontWeight: '600' }}>
                    #{cat.display_order ?? 1}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <button
                      onClick={() => handleToggleActive(cat)}
                      style={{
                        background: cat.active !== false ? '#064E3B' : '#334155',
                        border: `1px solid ${cat.active !== false ? '#10B981' : '#475569'}`,
                        color: cat.active !== false ? '#6EE7B7' : '#94A3B8',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      {cat.active !== false ? '● Active' : '○ Disabled'}
                    </button>
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(cat)}
                        style={{
                          background: '#334155',
                          border: 'none',
                          color: '#F8FAFC',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #EF4444',
                          color: '#FCA5A5',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
        }}>
          <div style={{
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {editingCategory ? `Edit: ${editingCategory.name}` : 'Create Category'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Freshwater Fish, Marine Exotics"
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#F8FAFC',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  Display Order *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#F8FAFC',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Primary sweet water river and lake varieties."
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#F8FAFC',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                  <span>Active &amp; Visible in Customer Catalog</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#334155',
                    border: 'none',
                    color: '#CBD5E1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: '#0284C7',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
        }}>
          <div style={{
            background: '#1E293B',
            border: '1px solid #EF4444',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#FCA5A5' }}>
              Confirm Deletion: {deleteTarget.name}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#CBD5E1', lineHeight: '1.5' }}>
              Are you sure you want to delete this category? If there are fish varieties assigned to this category ({deleteTarget.fish_count || 0} assigned), deletion will be rejected to protect catalog structure.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  background: '#334155',
                  border: 'none',
                  color: '#CBD5E1',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                style={{
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
