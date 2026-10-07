'use client';

/**
 * ADMIN-05 — Fish Management
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 49-54)
 */

import React, { useState, useEffect, useMemo } from 'react';

export default function AdminFishPage() {
  const [fishList, setFishList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [freshnessFilter, setFreshnessFilter] = useState('ALL');
  const [eligibilityFilter, setEligibilityFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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
    setIsModalOpen(true);
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

      setSuccessMsg(editingFish ? 'Fish record updated successfully.' : 'New fish added to catalog.');
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickToggle = async (fish, field) => {
    try {
      const updatedValue = !fish[field];
      const res = await fetch(`/api/v1/admin/fish/${fish.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: updatedValue }),
      });
      const data = await res.json();
      if (data.success) {
        setFishList((prev) =>
          prev.map((f) => (f.id === fish.id ? { ...f, [field]: updatedValue } : f))
        );
      } else {
        alert(data.error?.message || 'Update failed');
      }
    } catch (err) {
      alert(err.message);
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

  // Metrics
  const metrics = useMemo(() => {
    const total = fishList.length;
    const online = fishList.filter((f) => f.online_bookable).length;
    const freshCount = fishList.filter((f) => f.freshness_state === 'GREEN').length;
    const totalStock = fishList.reduce((acc, f) => acc + Number(f.available_quantity || 0), 0);
    return { total, online, freshCount, totalStock };
  }, [fishList]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              Fish Catalog & Inventory Management
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
              ADMIN-05
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: '14px' }}>
            Authoritative catalog configuration, stock availability, pricing, and live customer booking eligibility.
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
            id="btn-create-fish"
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
            <span>+</span> Add New Fish
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>TOTAL VARIETIES</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#F8FAFC', marginTop: '4px' }}>{metrics.total}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>ONLINE BOOKABLE</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#38BDF8', marginTop: '4px' }}>{metrics.online}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>FRESH CATCH (GREEN)</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>{metrics.freshCount}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>AVAILABLE STOCK</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#F59E0B', marginTop: '4px' }}>{metrics.totalStock.toFixed(1)} kg</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#1E293B',
        padding: '16px 20px',
        borderRadius: '10px',
        border: '1px solid #334155',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            id="fish-search-input"
            type="text"
            placeholder="Search fish name, category..."
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={freshnessFilter}
          onChange={(e) => setFreshnessFilter(e.target.value)}
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        >
          <option value="ALL">All Freshness States</option>
          <option value="GREEN">Green (Fresh Catch)</option>
          <option value="GREY">Grey (Aging Catch)</option>
          <option value="YELLOW">Yellow (Special/Watch)</option>
          <option value="RED">Red (Expired / Halt)</option>
        </select>

        <select
          value={eligibilityFilter}
          onChange={(e) => setEligibilityFilter(e.target.value)}
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        >
          <option value="ALL">All Channels</option>
          <option value="ONLINE">Online Bookable Only</option>
          <option value="PHYSICAL">Physical Store Only</option>
          <option value="OFFLINE">Unlisted / Inactive</option>
        </select>
      </div>

      {/* Main Fish Table */}
      <div style={{ background: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Fish Variety</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Category</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Unit Price</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Inventory (Avail / Phys / Res)</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Freshness State</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Online Booking</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Physical Store</th>
              <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  Loading fish catalog...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No fish items match the specified filters.
                </td>
              </tr>
            ) : (
              filteredList.map((f) => {
                const freshColor =
                  f.freshness_state === 'GREEN'
                    ? '#10B981'
                    : f.freshness_state === 'GREY'
                    ? '#94A3B8'
                    : f.freshness_state === 'YELLOW'
                    ? '#F59E0B'
                    : '#EF4444';

                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {f.image_url ? (
                          <img
                            src={f.image_url}
                            alt={f.name}
                            style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '6px',
                            background: '#0F172A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                          }}>
                            🐟
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: '#F8FAFC' }}>{f.name}</div>
                          {f.description && (
                            <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#CBD5E1' }}>
                      <span style={{
                        background: '#0F172A',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                        fontSize: '12px'
                      }}>
                        {f.category_name || 'Unassigned'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontWeight: '600', color: '#38BDF8' }}>
                      ₹{Number(f.unit_price).toFixed(2)} / kg
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '600', color: '#F8FAFC' }}>
                        {Number(f.available_quantity || 0).toFixed(1)} kg
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Phys: {Number(f.physical_quantity || 0).toFixed(1)} | Res: {Number(f.reserved_quantity || 0).toFixed(1)}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: `${freshColor}15`,
                        color: freshColor,
                        border: `1px solid ${freshColor}40`,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: freshColor }}></span>
                        {f.freshness_state}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <button
                        onClick={() => handleQuickToggle(f, 'online_bookable')}
                        style={{
                          background: f.online_bookable ? '#064E3B' : '#334155',
                          border: `1px solid ${f.online_bookable ? '#10B981' : '#475569'}`,
                          color: f.online_bookable ? '#6EE7B7' : '#94A3B8',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {f.online_bookable ? '● Bookable' : '○ Disabled'}
                      </button>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <button
                        onClick={() => handleQuickToggle(f, 'physical_available')}
                        style={{
                          background: f.physical_available ? '#064E3B' : '#334155',
                          border: `1px solid ${f.physical_available ? '#10B981' : '#475569'}`,
                          color: f.physical_available ? '#6EE7B7' : '#94A3B8',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {f.physical_available ? '● Available' : '○ Unavailable'}
                      </button>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(f)}
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
                          onClick={() => setDeleteTarget(f)}
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
            maxWidth: '560px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {editingFish ? `Edit Fish: ${editingFish.name}` : 'Add New Fish Variety'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFish}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
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
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
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
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
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
                    Freshness State
                  </label>
                  <select
                    value={formData.freshness_state}
                    onChange={(e) => setFormData({ ...formData, freshness_state: e.target.value })}
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
                    <option value="GREEN">GREEN (0-24h Fresh Catch)</option>
                    <option value="GREY">GREY (24-48h Aging)</option>
                    <option value="YELLOW">YELLOW (Special / Monitored)</option>
                    <option value="RED">RED (&gt;48h Expired / Halt)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
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
                  Description & Culinary Notes
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Pond-fresh, sweet water fish, tender cuts suitable for curry."
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
                display: 'flex',
                gap: '24px',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.online_bookable}
                    onChange={(e) => setFormData({ ...formData, online_bookable: e.target.checked })}
                  />
                  <span>Online Booking Eligible</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.physical_available}
                    onChange={(e) => setFormData({ ...formData, physical_available: e.target.checked })}
                  />
                  <span>Physical Store Available</span>
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
                  {actionLoading ? 'Saving...' : editingFish ? 'Update Fish' : 'Create Fish'}
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
              Are you sure you want to remove this fish from the active catalog? If bookings or transactions reference this fish, deletion will be blocked to maintain historical audit integrity.
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
