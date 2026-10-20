'use client';

/**
 * ADMIN-08 — Subscription Plans & Plan Fish Eligibility Management
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 67–69)
 * - PondFish Master PRD v2 (Section 12, 17)
 * - Phase 2J-I: Plan Fish Eligibility Management
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

  // Create / Edit Plan Modal State
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

  // Fish Eligibility Modal State (Phase 2J-I)
  const [isFishModalOpen, setIsFishModalOpen] = useState(false);
  const [eligibilityPlan, setEligibilityPlan] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityFish, setEligibilityFish] = useState([]);
  const [selectedFishIds, setSelectedFishIds] = useState(new Set());
  const [fishSearch, setFishSearch] = useState('');
  const [fishModalError, setFishModalError] = useState(null);
  const [fishModalSaving, setFishModalSaving] = useState(false);

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

  // Phase 2J-I: Open Fish Eligibility Modal and fetch eligibility records
  const openFishEligibilityModal = async (plan) => {
    setEligibilityPlan(plan);
    setIsFishModalOpen(true);
    setEligibilityLoading(true);
    setFishModalError(null);
    setFishSearch('');

    try {
      const res = await fetch(`/api/v1/admin/subscriptions/plans/${plan.id}/fish`);
      const data = await res.json();
      if (data.success) {
        setEligibilityFish(data.fish || []);
        const eligibleIds = new Set(
          (data.fish || []).filter((f) => f.isEligible).map((f) => f.fishId)
        );
        setSelectedFishIds(eligibleIds);
      } else {
        setFishModalError(data.error?.message || 'Failed to load fish eligibility for this plan.');
      }
    } catch (err) {
      setFishModalError(err.message || 'Network error fetching plan fish eligibility.');
    } finally {
      setEligibilityLoading(false);
    }
  };

  const handleToggleFish = (fishId) => {
    setSelectedFishIds((prev) => {
      const next = new Set(prev);
      if (next.has(fishId)) {
        next.delete(fishId);
      } else {
        next.add(fishId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = (filteredList) => {
    setSelectedFishIds((prev) => {
      const next = new Set(prev);
      filteredList.forEach((f) => next.add(f.fishId));
      return next;
    });
  };

  const handleDeselectAllFiltered = (filteredList) => {
    setSelectedFishIds((prev) => {
      const next = new Set(prev);
      filteredList.forEach((f) => next.delete(f.fishId));
      return next;
    });
  };

  const handleSaveFishEligibility = async () => {
    if (!eligibilityPlan) return;
    setFishModalError(null);
    setFishModalSaving(true);

    try {
      const payload = {
        fishIds: Array.from(selectedFishIds),
      };

      const res = await fetch(`/api/v1/admin/subscriptions/plans/${eligibilityPlan.id}/fish`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          `Eligible fish for plan "${eligibilityPlan.title}" saved successfully (${data.eligibleFishCount} fish eligible).`
        );
        setIsFishModalOpen(false);
        fetchPlans();
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setFishModalError(data.error?.message || 'Failed to save fish eligibility.');
      }
    } catch (err) {
      setFishModalError(err.message || 'Error saving fish eligibility.');
    } finally {
      setFishModalSaving(false);
    }
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
    <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', color: '#0F2C59' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#0F2C59' }}>
            Subscription Plans
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            ADMIN-08 — Configuration-driven subscription tiers, pricing, credit allowances, and species eligibility
          </p>
        </div>
        <button
          id="btn-create-plan"
          onClick={openCreateModal}
          style={{
            background: 'linear-gradient(135deg, #1E56A0 0%, #0F2C59 100%)',
            color: '#FFFFFF',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(30, 86, 160, 0.25)',
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
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          color: '#16A34A',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#16A34A', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <div style={{
        background: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        boxShadow: '0 2px 4px rgba(15, 44, 89, 0.04)',
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
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#0F2C59',
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
                background: statusFilter === st ? '#1E56A0' : '#F8FAFC',
                color: statusFilter === st ? '#FFFFFF' : '#64748B',
                border: '1px solid #CBD5E1',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
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
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(15, 44, 89, 0.04)',
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <div>Loading Subscription Plans...</div>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0F2C59', marginBottom: '4px' }}>
              No Subscription Plans Found
            </div>
            <div style={{ fontSize: '13px', color: '#64748B' }}>
              {search ? 'Try clearing your search query' : 'Create your first subscription plan to get started.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px', fontWeight: '800' }}>
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
                    borderBottom: idx < filteredPlans.length - 1 ? '1px solid #E2E8F0' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : '#F8FAFC',
                  }}
                >
                  <td style={{ padding: '16px 20px', fontWeight: '700', color: '#0F2C59' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>💎</span>
                      <span>{p.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#1E56A0', fontWeight: '700', fontSize: '14px' }}>
                    ₹{Number(p.price).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#16A34A', fontWeight: '700' }}>
                    ₹{Number(p.credit_amount).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#0F2C59', fontWeight: '600' }}>
                    {p.weekly_qty_limit_kg} kg / week
                  </td>
                  <td style={{ padding: '16px 20px', color: '#64748B' }}>
                    {p.validity_days} days validity
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: p.active ? '#DCFCE7' : '#FEE2E2',
                      color: p.active ? '#16A34A' : '#DC2626',
                      border: `1px solid ${p.active ? '#BBF7D0' : '#FECACA'}`,
                    }}>
                      {p.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: '700', color: '#0F2C59' }}>
                    <span style={{
                      background: '#FFFFFF',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                    }}>
                      {p.active_subscribers || 0}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* Phase 2J-I: Manage Plan Fish Eligibility Button */}
                      <button
                        id={`btn-fish-plan-${p.id}`}
                        onClick={() => openFishEligibilityModal(p)}
                        disabled={actionLoading}
                        style={{
                          background: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        🐟 Eligible Fish {p.eligible_fish_count !== undefined ? `(${p.eligible_fish_count})` : ''}
                      </button>
                      <button
                        id={`btn-edit-plan-${p.id}`}
                        onClick={() => openEditModal(p)}
                        disabled={actionLoading}
                        style={{
                          background: '#F0F9FF',
                          color: '#0369A1',
                          border: '1px solid #BAE6FD',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
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
                          background: p.active ? '#FEF2F2' : '#F0FDF4',
                          color: p.active ? '#DC2626' : '#16A34A',
                          border: `1px solid ${p.active ? '#FECACA' : '#BBF7D0'}`,
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
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

      {/* Create / Edit Plan Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 44, 89, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 40px rgba(15, 44, 89, 0.15)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                {editingPlan ? `Edit Plan: ${editingPlan.title}` : 'Create Subscription Plan'}
              </h2>
              <button
                id="btn-close-plan-modal"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '22px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Plan Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      color: '#0F2C59',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Price and Credit Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                          credit_amount: formData.credit_amount ? formData.credit_amount : val,
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
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
                  <label htmlFor="input-plan-active" style={{ fontSize: '14px', color: '#0F2C59', fontWeight: '600', cursor: 'pointer' }}>
                    Active Status (Eligible for new customer subscriptions)
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#F8FAFC',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-plan"
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: 'linear-gradient(135deg, #1E56A0 0%, #0F2C59 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(30, 86, 160, 0.25)',
                  }}
                >
                  {actionLoading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 2J-I: Fish Eligibility Management Modal */}
      {isFishModalOpen && eligibilityPlan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 44, 89, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            boxShadow: '0 20px 40px rgba(15, 44, 89, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F2C59' }}>
                  🐟 Manage Eligible Fish — {eligibilityPlan.title}
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                  Plan quota: {eligibilityPlan.weekly_qty_limit_kg} kg/week • Plan price: ₹{Number(eligibilityPlan.price).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                id="btn-close-fish-modal"
                onClick={() => setIsFishModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '22px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Error Banner */}
            {fishModalError && (
              <div style={{
                background: '#FEF2F2',
                borderBottom: '1px solid #FECACA',
                color: '#DC2626',
                padding: '12px 24px',
                fontSize: '13px',
                fontWeight: '600',
              }}>
                ⚠️ {fishModalError}
              </div>
            )}

            {/* Controls Bar: Search & Quick Selection */}
            <div style={{
              padding: '16px 24px',
              background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '240px' }}>
                <input
                  id="input-search-eligible-fish"
                  type="text"
                  placeholder="Search catalogue fish..."
                  value={fishSearch}
                  onChange={(e) => setFishSearch(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    color: '#0F2C59',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  background: '#F0F9FF',
                  color: '#0369A1',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #BAE6FD',
                }}>
                  {selectedFishIds.size} of {eligibilityFish.length} eligible
                </span>

                <button
                  id="btn-select-all-filtered-fish"
                  type="button"
                  onClick={() => {
                    const filtered = eligibilityFish.filter((f) =>
                      f.name.toLowerCase().includes(fishSearch.toLowerCase()) ||
                      (f.categoryName || '').toLowerCase().includes(fishSearch.toLowerCase())
                    );
                    handleSelectAllFiltered(filtered);
                  }}
                  style={{
                    background: '#F8FAFC',
                    color: '#0F2C59',
                    border: '1px solid #CBD5E1',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Select All
                </button>
                <button
                  id="btn-deselect-all-filtered-fish"
                  type="button"
                  onClick={() => {
                    const filtered = eligibilityFish.filter((f) =>
                      f.name.toLowerCase().includes(fishSearch.toLowerCase()) ||
                      (f.categoryName || '').toLowerCase().includes(fishSearch.toLowerCase())
                    );
                    handleDeselectAllFiltered(filtered);
                  }}
                  style={{
                    background: '#F8FAFC',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Fish List Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#F8FAFC' }}>
              {eligibilityLoading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                  <div>Loading catalogue fish and plan eligibility...</div>
                </div>
              ) : eligibilityFish.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  No fish found in the catalogue.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {eligibilityFish
                    .filter((f) =>
                      f.name.toLowerCase().includes(fishSearch.toLowerCase()) ||
                      (f.categoryName || '').toLowerCase().includes(fishSearch.toLowerCase())
                    )
                    .map((fish) => {
                      const isChecked = selectedFishIds.has(fish.fishId);
                      return (
                        <div
                          key={fish.fishId}
                          id={`fish-eligibility-row-${fish.fishId}`}
                          onClick={() => handleToggleFish(fish.fishId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: isChecked ? '#F0FDF4' : '#FFFFFF',
                            border: `1px solid ${isChecked ? '#86EFAC' : '#E2E8F0'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <input
                              id={`checkbox-fish-${fish.fishId}`}
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleFish(fish.fishId)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '700', color: '#0F2C59', fontSize: '14px' }}>
                                  {fish.name}
                                </span>
                                {fish.categoryName && (
                                  <span style={{
                                    fontSize: '11px',
                                    background: '#F1F5F9',
                                    color: '#475569',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: '600',
                                  }}>
                                    {fish.categoryName}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                                Default Base Price: ₹{Number(fish.pricePerKg).toLocaleString('en-IN')}/kg
                              </div>
                            </div>
                          </div>

                          <div>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: isChecked ? '#DCFCE7' : '#F1F5F9',
                              color: isChecked ? '#16A34A' : '#94A3B8',
                              border: `1px solid ${isChecked ? '#BBF7D0' : '#E2E8F0'}`,
                            }}>
                              {isChecked ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FFFFFF',
            }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Only eligible species can be claimed under this plan's weekly allowance.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsFishModalOpen(false)}
                  style={{
                    background: '#F8FAFC',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-eligible-fish"
                  type="button"
                  onClick={handleSaveFishEligibility}
                  disabled={fishModalSaving || eligibilityLoading}
                  style={{
                    background: 'linear-gradient(135deg, #1E56A0 0%, #0F2C59 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(30, 86, 160, 0.3)',
                  }}
                >
                  {fishModalSaving ? 'Saving...' : `Save Eligible Fish (${selectedFishIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
