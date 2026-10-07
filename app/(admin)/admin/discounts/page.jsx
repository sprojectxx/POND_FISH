'use client';

/**
 * ADMIN-07 — Discounts
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 59-66)
 */

import React, { useState, useEffect, useMemo } from 'react';

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState([]);
  const [fishList, setFishList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formData, setFormData] = useState({
    discount_code: '',
    fish_id: '',
    discount_type: 'PERCENTAGE',
    discount_value: '',
    starts_at: '',
    expires_at: '',
    active: true,
  });

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [discRes, fishRes] = await Promise.all([
        fetch('/api/v1/admin/discounts'),
        fetch('/api/v1/admin/fish'),
      ]);

      const discData = await discRes.json();
      const fishData = await fishRes.json();

      if (discData.success) {
        setDiscounts(discData.discounts || []);
      } else {
        setErrorMsg(discData.error?.message || 'Failed to load discounts.');
      }

      if (fishData.success) {
        setFishList(fishData.fish || []);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching discounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingDiscount(null);
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 86400000);

    setFormData({
      discount_code: '',
      fish_id: '',
      discount_type: 'PERCENTAGE',
      discount_value: '10',
      starts_at: now.toISOString().slice(0, 16),
      expires_at: nextWeek.toISOString().slice(0, 16),
      active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (d) => {
    setEditingDiscount(d);
    setFormData({
      discount_code: d.discount_code,
      fish_id: d.fish_id || '',
      discount_type: d.discount_percent ? 'PERCENTAGE' : 'FLAT',
      discount_value: d.discount_percent || d.flat_discount_amount || '',
      starts_at: d.starts_at ? new Date(d.starts_at).toISOString().slice(0, 16) : '',
      expires_at: d.expires_at ? new Date(d.expires_at).toISOString().slice(0, 16) : '',
      active: d.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const url = editingDiscount
        ? `/api/v1/admin/discounts/${editingDiscount.id}`
        : '/api/v1/admin/discounts';
      const method = editingDiscount ? 'PATCH' : 'POST';

      const payload = {
        discount_code: formData.discount_code.trim().toUpperCase(),
        fish_id: formData.fish_id ? formData.fish_id : null,
        discount_percent: formData.discount_type === 'PERCENTAGE' ? Number(formData.discount_value) : null,
        flat_discount_amount: formData.discount_type === 'FLAT' ? Number(formData.discount_value) : null,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        active: Boolean(formData.active),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error?.message || 'Failed to save discount campaign.');
      }

      setSuccessMsg(editingDiscount ? 'Discount campaign updated.' : 'New discount created.');
      setIsModalOpen(false);
      await fetchData();
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
      const res = await fetch(`/api/v1/admin/discounts/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Delete operation failed.');
      }
      setSuccessMsg(`Discount "${deleteTarget.discount_code}" deleted.`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message);
      setDeleteTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (d) => {
    try {
      const res = await fetch(`/api/v1/admin/discounts/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !d.active }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscounts((prev) =>
          prev.map((item) => (item.id === d.id ? { ...item, active: !d.active } : item))
        );
      } else {
        alert(data.error?.message || 'Toggle failed');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const computedStatus = (d) => {
    if (d.active === false) return { label: 'DISABLED', color: '#64748B', bg: '#1E293B' };
    const now = new Date();
    if (d.starts_at && new Date(d.starts_at) > now) {
      return { label: 'SCHEDULED', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
    }
    if (d.expires_at && new Date(d.expires_at) < now) {
      return { label: 'EXPIRED', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
    }
    return { label: 'ACTIVE', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
  };

  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      const matchSearch =
        !search ||
        d.discount_code.toLowerCase().includes(search.toLowerCase()) ||
        (d.fish_name && d.fish_name.toLowerCase().includes(search.toLowerCase()));

      const status = computedStatus(d).label;
      const matchStatus = statusFilter === 'ALL' || status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [discounts, search, statusFilter]);

  const activeCount = discounts.filter((d) => computedStatus(d).label === 'ACTIVE').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              Discount &amp; Promotion Campaigns
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
              ADMIN-07
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: '14px' }}>
            Authoritative promotional codes, percentage off, flat discounts, and validity schedules.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={fetchData}
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
            id="btn-create-discount"
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
            <span>+</span> Create Discount
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
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>TOTAL CAMPAIGNS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#F8FAFC', marginTop: '4px' }}>{discounts.length}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>LIVE ACTIVE CODES</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>{activeCount}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>STOREWIDE DISCOUNTS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#38BDF8', marginTop: '4px' }}>
            {discounts.filter((d) => !d.fish_id).length}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{
        background: '#1E293B',
        padding: '16px 20px',
        borderRadius: '10px',
        border: '1px solid #334155',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Search coupon code or fish name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#F8FAFC',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Now</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="EXPIRED">Expired</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {/* Discounts Table */}
      <div style={{ background: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Promo Code</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Target Applicability</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Benefit Value</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Validity Window</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Lifecycle State</th>
              <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  Loading discounts...
                </td>
              </tr>
            ) : filteredDiscounts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No promotional discounts found.
                </td>
              </tr>
            ) : (
              filteredDiscounts.map((d) => {
                const status = computedStatus(d);
                const isPercentage = Boolean(d.discount_percent);
                const displayValue = isPercentage
                  ? `${d.discount_percent}% OFF`
                  : `₹${Number(d.flat_discount_amount).toFixed(2)} FLAT`;

                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        fontSize: '14px',
                        color: '#38BDF8',
                        background: '#0F172A',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #334155'
                      }}>
                        {d.discount_code}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#CBD5E1' }}>
                      {d.fish_id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🐟</span> {d.fish_name || 'Specific Fish'}
                        </span>
                      ) : (
                        <span style={{ color: '#10B981', fontWeight: '600' }}>🌐 All Catalog Fish (Storewide)</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', fontWeight: '700', color: '#F8FAFC' }}>
                      {displayValue}
                    </td>

                    <td style={{ padding: '14px 18px', color: '#94A3B8', fontSize: '12px' }}>
                      <div>
                        {d.starts_at ? new Date(d.starts_at).toLocaleDateString() : 'Immediate'} →{' '}
                        {d.expires_at ? new Date(d.expires_at).toLocaleDateString() : 'No Expiry'}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        background: status.bg,
                        color: status.color,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}>
                        {status.label}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleActive(d)}
                          style={{
                            background: d.active !== false ? '#064E3B' : '#334155',
                            border: `1px solid ${d.active !== false ? '#10B981' : '#475569'}`,
                            color: d.active !== false ? '#6EE7B7' : '#94A3B8',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {d.active !== false ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => openEditModal(d)}
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
                          onClick={() => setDeleteTarget(d)}
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
                );
              })
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
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {editingDiscount ? `Edit: ${editingDiscount.discount_code}` : 'Create Discount Campaign'}
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
                  Discount Code (Uppercase Alphanumeric) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.discount_code}
                  onChange={(e) => setFormData({ ...formData, discount_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MONSOON15, FIRSTCATCH"
                  style={{
                    width: '100%',
                    background: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#38BDF8',
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  Target Product
                </label>
                <select
                  value={formData.fish_id}
                  onChange={(e) => setFormData({ ...formData, fish_id: e.target.value })}
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
                >
                  <option value="">Storewide (Applies to all varieties)</option>
                  {fishList.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                    Discount Type *
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
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
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                    Value {formData.discount_type === 'PERCENTAGE' ? '(1 - 100 %)' : '(₹)'} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={formData.discount_type === 'PERCENTAGE' ? 100 : 10000}
                    required
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'PERCENTAGE' ? '15' : '50.00'}
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                    Starts At
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
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

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                    Expires At
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
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
                  <span>Active immediately upon start date</span>
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
                  {actionLoading ? 'Saving...' : editingDiscount ? 'Update Campaign' : 'Create Campaign'}
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
              Confirm Deletion: {deleteTarget.discount_code}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#CBD5E1', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete this discount campaign? Customers will no longer be able to apply this code during checkout.
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
