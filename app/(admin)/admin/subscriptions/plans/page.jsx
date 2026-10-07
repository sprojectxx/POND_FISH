'use client';

/**
 * ADMIN-08 — Subscription Plans
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 67–69)
 * - PondFish Master PRD v2 (Section 12, 17)
 */

import React, { useState, useEffect, useMemo } from 'react';

export default function AdminSubscriptionPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    credit_amount: '',
    weekly_qty_limit_kg: '',
    validity_days: '30',
    active: true,
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/v1/admin/subscriptions/plans');
      const data = await res.json();
      if (data.success) {
        setPlans(data.plans || []);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load subscription plans.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching subscription plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      title: '',
      price: '',
      credit_amount: '',
      weekly_qty_limit_kg: '2',
      validity_days: '30',
      active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      title: plan.title,
      price: plan.price.toString(),
      credit_amount: plan.credit_amount.toString(),
      weekly_qty_limit_kg: (plan.weekly_qty_limit_kg || 0).toString(),
      validity_days: (plan.validity_days || 30).toString(),
      active: plan.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        price: parseFloat(formData.price),
        credit_amount: parseFloat(formData.credit_amount),
        weekly_qty_limit_kg: parseFloat(formData.weekly_qty_limit_kg || 0),
        validity_days: parseInt(formData.validity_days, 10),
        active: Boolean(formData.active),
      };

      if (!payload.title) {
        throw new Error('Plan Name is required.');
      }
      if (isNaN(payload.price) || payload.price <= 0) {
        throw new Error('Price must be greater than 0.');
      }
      if (isNaN(payload.credit_amount) || payload.credit_amount <= 0) {
        throw new Error('Credit Amount must be greater than 0.');
      }
      if (isNaN(payload.validity_days) || payload.validity_days <= 0) {
        throw new Error('Validity Days must be greater than 0.');
      }

      let res;
      if (editingPlan) {
        res = await fetch(`/api/v1/admin/subscriptions/plans/${editingPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/v1/admin/subscriptions/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editingPlan ? 'Plan updated successfully.' : 'Plan created successfully.');
        setIsModalOpen(false);
        fetchPlans();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error?.message || 'Operation failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Submission error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (plan) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const newStatus = !plan.active;
      const res = await fetch(`/api/v1/admin/subscriptions/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Plan "${plan.title}" ${newStatus ? 'activated' : 'deactivated'} successfully.`);
        fetchPlans();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error?.message || 'Failed to update plan status.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Status toggle failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? p.active === true
          : p.active === false;
      return matchesSearch && matchesStatus;
    });
  }, [plans, search, statusFilter]);

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#F8FAFC' }}>
            💳 Subscription Plans
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>
            ADMIN-08 — Configuration-driven subscription tiers, pricing, credit allowances, and active subscriber metrics
          </p>
        </div>
        <button
          id="btn-create-plan"
          onClick={openCreateModal}
          style={{
            background: '#0284C7',
            color: '#FFFFFF',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>➕</span>
          <span>Create Subscription Plan</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #EF4444',
          color: '#FCA5A5',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid #10B981',
          color: '#6EE7B7',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <div style={{
        background: '#1E293B',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '400px' }}>
          <input
            id="input-search-plans"
            type="text"
            placeholder="Search plans by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#F8FAFC',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => (
            <button
              key={st}
              id={`filter-${st.toLowerCase()}`}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#0284C7' : '#0F172A',
                color: statusFilter === st ? '#FFFFFF' : '#94A3B8',
                border: '1px solid #334155',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Table */}
      <div style={{
        background: '#1E293B',
        borderRadius: '12px',
        border: '1px solid #334155',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <div>Loading Subscription Plans...</div>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#E2E8F0', marginBottom: '4px' }}>
              No Subscription Plans Found
            </div>
            <div style={{ fontSize: '13px' }}>
              {search ? 'Try clearing your search query' : 'Create your first subscription plan to get started.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px' }}>
                <th style={{ padding: '14px 20px' }}>Plan Name</th>
                <th style={{ padding: '14px 20px' }}>Price</th>
                <th style={{ padding: '14px 20px' }}>Credit Added</th>
                <th style={{ padding: '14px 20px' }}>Weekly Quota</th>
                <th style={{ padding: '14px 20px' }}>Expiry Rule</th>
                <th style={{ padding: '14px 20px' }}>Active</th>
                <th style={{ padding: '14px 20px' }}>Active Subscribers</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((p, idx) => (
                <tr
                  key={p.id}
                  id={`row-plan-${p.id}`}
                  style={{
                    borderBottom: idx < filteredPlans.length - 1 ? '1px solid #334155' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                  }}
                >
                  <td style={{ padding: '16px 20px', fontWeight: '600', color: '#F8FAFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>👑</span>
                      <span>{p.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#38BDF8', fontWeight: '700', fontSize: '14px' }}>
                    ₹{Number(p.price).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10B981', fontWeight: '600' }}>
                    ₹{Number(p.credit_amount).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#F8FAFC' }}>
                    {p.weekly_qty_limit_kg} kg / week
                  </td>
                  <td style={{ padding: '16px 20px', color: '#94A3B8' }}>
                    {p.validity_days} days validity
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: p.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: p.active ? '#10B981' : '#EF4444',
                      border: `1px solid ${p.active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}>
                      {p.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: '600', color: '#E2E8F0' }}>
                    <span style={{
                      background: '#0F172A',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                    }}>
                      👥 {p.active_subscribers || 0}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        id={`btn-edit-plan-${p.id}`}
                        onClick={() => openEditModal(p)}
                        disabled={actionLoading}
                        style={{
                          background: '#0F172A',
                          color: '#38BDF8',
                          border: '1px solid #334155',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        id={`btn-toggle-plan-${p.id}`}
                        onClick={() => handleToggleActive(p)}
                        disabled={actionLoading}
                        style={{
                          background: p.active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: p.active ? '#EF4444' : '#10B981',
                          border: `1px solid ${p.active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {p.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Plan Create / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 17, 32, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#1E293B',
            borderRadius: '16px',
            border: '1px solid #334155',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0F172A',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#F8FAFC' }}>
                {editingPlan ? '✏️ Edit Subscription Plan' : '➕ Create Subscription Plan'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Plan Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Plan Name *
                  </label>
                  <input
                    id="input-plan-title"
                    type="text"
                    required
                    placeholder="e.g. Type 1, Premium Monthly, etc."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Price and Credit Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Price (₹) *
                    </label>
                    <input
                      id="input-plan-price"
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 2000"
                      value={formData.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          price: val,
                          // Default credit_amount to price if empty or creating
                          credit_amount: formData.credit_amount ? formData.credit_amount : val,
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0F172A',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Credit Amount (₹) *
                    </label>
                    <input
                      id="input-plan-credit"
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 2000"
                      value={formData.credit_amount}
                      onChange={(e) => setFormData({ ...formData, credit_amount: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0F172A',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Weekly Quota and Validity Days */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Weekly Allowance (kg)
                    </label>
                    <input
                      id="input-plan-quota"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 2"
                      value={formData.weekly_qty_limit_kg}
                      onChange={(e) => setFormData({ ...formData, weekly_qty_limit_kg: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0F172A',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Expiry Rule (Days) *
                    </label>
                    <input
                      id="input-plan-validity"
                      type="number"
                      required
                      placeholder="e.g. 30"
                      value={formData.validity_days}
                      onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0F172A',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Active Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <input
                    id="input-plan-active"
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="input-plan-active" style={{ fontSize: '14px', color: '#E2E8F0', cursor: 'pointer' }}>
                    Active Status (Eligible for new customer subscriptions)
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#0F172A',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-plan"
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: '#0284C7',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                  }}
                >
                  {actionLoading ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
