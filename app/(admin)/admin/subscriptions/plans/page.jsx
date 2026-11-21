'use client';

/**
 * ADMIN-08 — Subscription Plans & Plan Fish Eligibility Management
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 67–69)
 * - PondFish Master PRD v2 (Section 12, 17)
 * - Phase 2J-I: Plan Fish Eligibility Management
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AdminSubNav, AdminTableSkeleton, AdminPagination } from '@/components/ui';

export default function AdminSubscriptionPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Create / Edit Plan Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    credit_amount: '',
    weekly_qty_limit_kg: '2',
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

  const handleSelectAllFilteredFish = (filteredFish) => {
    setSelectedFishIds((prev) => {
      const next = new Set(prev);
      filteredFish.forEach((f) => next.add(f.fishId));
      return next;
    });
  };

  const handleClearAllFilteredFish = (filteredFish) => {
    setSelectedFishIds((prev) => {
      const next = new Set(prev);
      filteredFish.forEach((f) => next.delete(f.fishId));
      return next;
    });
  };

  const handleSaveFishEligibility = async () => {
    if (!eligibilityPlan) return;
    setFishModalSaving(true);
    setFishModalError(null);

    try {
      const fishIds = Array.from(selectedFishIds);
      const res = await fetch(`/api/v1/admin/subscriptions/plans/${eligibilityPlan.id}/fish`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fishIds }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Updated fish eligibility for plan "${eligibilityPlan.title}" (${fishIds.length} varieties eligible).`);
        setIsFishModalOpen(false);
        fetchPlans();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setFishModalError(data.error?.message || 'Failed to save fish eligibility.');
      }
    } catch (err) {
      setFishModalError(err.message || 'Network error saving fish eligibility.');
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
        weekly_qty_limit_kg: parseFloat(formData.weekly_qty_limit_kg),
        validity_days: parseInt(formData.validity_days, 10),
        active: formData.active,
      };

      const url = editingPlan
        ? `/api/v1/admin/subscriptions/plans/${editingPlan.id}`
        : '/api/v1/admin/subscriptions/plans';
      const method = editingPlan ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          editingPlan
            ? `Plan "${formData.title}" updated successfully.`
            : `Plan "${formData.title}" created successfully.`
        );
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

  // Snappy Optimistic Active Status Toggle
  const handleToggleActive = async (plan) => {
    setErrorMsg(null);
    const prevActive = plan.active !== false;
    const nextActive = !prevActive;

    // 1. Instant optimistic update
    setPlans((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, active: nextActive } : p))
    );
    setTogglingId(plan.id);

    try {
      const res = await fetch(`/api/v1/admin/subscriptions/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        setPlans((prev) =>
          prev.map((p) => (p.id === plan.id ? { ...p, active: prevActive } : p))
        );
        setErrorMsg(data.error?.message || 'Failed to update plan status.');
      } else {
        setSuccessMsg(`Plan "${plan.title}" ${nextActive ? 'activated' : 'deactivated'} successfully.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      // Rollback
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, active: prevActive } : p))
      );
      setErrorMsg(err.message || 'Status toggle failed.');
    } finally {
      setTogglingId(null);
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

  // Reset page on search or status filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / limit));
  const paginatedPlans = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredPlans.slice(start, start + limit);
  }, [filteredPlans, page, limit]);

  // Metric counts
  const totalSubscribers = useMemo(
    () => plans.reduce((acc, p) => acc + (p.active_subscribers || 0), 0),
    [plans]
  );
  const activePlansCount = useMemo(
    () => plans.filter((p) => p.active !== false).length,
    [plans]
  );

  return (
    <div style={{ color: '#0F2C59', maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      <AdminSubNav
        tabs={[
          { label: 'Customer Subscribers & Wallets', href: '/admin/subscriptions', exact: true },
          { label: 'Subscription Plan Packages', href: '/admin/subscriptions/plans' },
        ]}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#0F2C59' }}>
            Subscription Plans
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={fetchPlans}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F2C59',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              className={loading ? 'pf-animate-spin' : ''}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            id="btn-create-plan"
            onClick={openCreateModal}
            style={{
              background: '#1E56A0',
              color: '#FFFFFF',
              border: 'none',
              padding: '0 20px',
              height: '38px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Create Subscription Plan</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Total Plans
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59' }}>
            {plans.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Configured membership tiers
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Active Plans
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#10B981' }}>
            {activePlansCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Eligible for new subscribers
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Active Subscribers
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0284C7' }}>
            {totalSubscribers}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Customers enrolled across plans
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Plan Quota Window
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59' }}>
            30 Days
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Weekly freshwater quota refresh
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13.5px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>×</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13.5px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>×</button>
        </div>
      )}

      {/* Control Bar: Search & Status Filter Pills */}
      <div style={{
        background: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(15, 44, 89, 0.04)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '260px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            id="input-search-plans"
            type="text"
            placeholder="Search plans by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
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
          {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => {
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                id={`filter-${st.toLowerCase()}`}
                onClick={() => setStatusFilter(st)}
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
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plans Table */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)',
        position: 'relative',
      }}>
        {loading && (
          <div
            className="pf-animate-indeterminate"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              zIndex: 10,
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
          />
        )}
        <div style={{ overflowX: 'auto', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px', fontWeight: '800' }}>
                <th style={{ padding: '14px 20px' }}>Plan Name</th>
                <th style={{ padding: '14px 20px' }}>Price</th>
                <th style={{ padding: '14px 20px' }}>Credit Added</th>
                <th style={{ padding: '14px 20px' }}>Weekly Quota</th>
                <th style={{ padding: '14px 20px' }}>Validity</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px' }}>Subscribers</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={8} rows={4} />
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '64px 20px', textAlign: 'center', color: '#64748B' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px' }}>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
                      No Subscription Plans Found
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      {search ? 'Try clearing your search query' : 'Create your first subscription plan to get started.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPlans.map((p, idx) => (
                  <tr
                    key={p.id}
                    id={`plan-row-${p.id}`}
                    style={{
                      borderBottom: idx < filteredPlans.length - 1 ? '1px solid #F1F5F9' : 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0F2C59', fontSize: '14px' }}>
                      {p.title}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0F2C59' }}>
                      ₹{Number(p.price).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#059669', fontWeight: '800' }}>
                      ₹{Number(p.credit_amount).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#0F2C59', fontWeight: '600' }}>
                      {p.weekly_qty_limit_kg || 0} kg / week
                    </td>
                    <td style={{ padding: '16px 20px', color: '#64748B' }}>
                      {p.validity_days || 30} days
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {/* Snappy Optimistic Active Status Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        disabled={togglingId === p.id}
                        style={{
                          background: p.active !== false ? '#ECFDF5' : '#F1F5F9',
                          border: `1px solid ${p.active !== false ? '#A7F3D0' : '#CBD5E1'}`,
                          color: p.active !== false ? '#065F46' : '#334155',
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: togglingId === p.id ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                          opacity: togglingId === p.id ? 0.75 : 1,
                        }}
                      >
                        {togglingId === p.id ? (
                          <span style={{
                            width: '7px',
                            height: '7px',
                            border: '2px solid currentColor',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.6s linear infinite',
                            display: 'inline-block',
                          }} />
                        ) : (
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: p.active !== false ? '#10B981' : '#64748B',
                            display: 'inline-block',
                          }} />
                        )}
                        <span>{p.active !== false ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: '#EFF6FF',
                        color: '#1E56A0',
                        fontSize: '12px',
                        fontWeight: '800',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        border: '1px solid #BFDBFE',
                      }}>
                        {p.active_subscribers || 0}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Manage Plan Fish Eligibility Button */}
                        <button
                          id={`btn-fish-plan-${p.id}`}
                          onClick={() => openFishEligibilityModal(p)}
                          disabled={actionLoading}
                          style={{
                            background: '#EFF6FF',
                            color: '#1E56A0',
                            border: '1px solid #BFDBFE',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                          <span>Eligible Fish</span>
                          {p.eligible_fish_count !== undefined && (
                            <span style={{ background: '#1E56A0', color: '#FFFFFF', padding: '1px 6px', borderRadius: '10px', fontSize: '10.5px' }}>
                              {p.eligible_fish_count}
                            </span>
                          )}
                        </button>

                        <button
                          id={`btn-edit-plan-${p.id}`}
                          onClick={() => openEditModal(p)}
                          disabled={actionLoading}
                          style={{
                            background: '#FFFFFF',
                            color: '#0F2C59',
                            border: '1px solid #CBD5E1',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={filteredPlans.length}
            limit={limit}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            itemName="plans"
            loading={loading}
            limitOptions={[10, 25, 50]}
          />
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
            boxShadow: '0 20px 40px -8px rgba(15, 44, 89, 0.2)',
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
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: '1',
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
                    placeholder="e.g. Premium Lake Harvest Tier"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      color: '#0F2C59',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Price and Credit Added */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Price (₹) *
                    </label>
                    <input
                      id="input-plan-price"
                      type="number"
                      step="1"
                      required
                      placeholder="e.g. 2999"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Credit Added (₹) *
                    </label>
                    <input
                      id="input-plan-credit"
                      type="number"
                      step="1"
                      required
                      placeholder="e.g. 3500"
                      value={formData.credit_amount}
                      onChange={(e) => setFormData({ ...formData, credit_amount: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Weekly Quota and Validity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Weekly Allowance (Kg) *
                    </label>
                    <input
                      id="input-plan-quota"
                      type="number"
                      step="0.5"
                      placeholder="e.g. 2.5"
                      value={formData.weekly_qty_limit_kg}
                      onChange={(e) => setFormData({ ...formData, weekly_qty_limit_kg: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
                        fontSize: '13.5px',
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
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F2C59',
                        fontSize: '13.5px',
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
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1E56A0' }}
                  />
                  <label htmlFor="input-plan-active" style={{ fontSize: '13.5px', color: '#0F2C59', fontWeight: '600', cursor: 'pointer' }}>
                    Active Status (Available for new customer enrollments)
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: '#FFFFFF',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    padding: '9px 18px',
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
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '9px 24px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
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
            boxShadow: '0 20px 40px -8px rgba(15, 44, 89, 0.2)',
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
                  Manage Eligible Fish — {eligibilityPlan.title}
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
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: '1',
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
                {fishModalError}
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
                    borderRadius: '8px',
                    color: '#0F2C59',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  background: '#EFF6FF',
                  color: '#1E56A0',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #BFDBFE',
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
                    handleSelectAllFilteredFish(filtered);
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#0F2C59',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Select All
                </button>
                <button
                  id="btn-clear-all-filtered-fish"
                  type="button"
                  onClick={() => {
                    const filtered = eligibilityFish.filter((f) =>
                      f.name.toLowerCase().includes(fishSearch.toLowerCase()) ||
                      (f.categoryName || '').toLowerCase().includes(fishSearch.toLowerCase())
                    );
                    handleClearAllFilteredFish(filtered);
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#64748B',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Fish List Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {eligibilityLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                  Loading eligible fish varieties...
                </div>
              ) : eligibilityFish.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                  No fish varieties found in catalog.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {eligibilityFish
                    .filter((f) =>
                      f.name.toLowerCase().includes(fishSearch.toLowerCase()) ||
                      (f.categoryName || '').toLowerCase().includes(fishSearch.toLowerCase())
                    )
                    .map((fish) => {
                      const isEligible = selectedFishIds.has(fish.fishId);
                      return (
                        <div
                          key={fish.fishId}
                          onClick={() => handleToggleFish(fish.fishId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: isEligible ? '1.5px solid #1E56A0' : '1px solid #E2E8F0',
                            background: isEligible ? '#EFF6FF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isEligible}
                            onChange={() => {}}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#1E56A0' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F2C59', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fish.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {fish.categoryName || 'General'} • ₹{fish.unitPrice}/kg
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Selected fish varieties are eligible for subscriber redemption.
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsFishModalOpen(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-fish-eligibility"
                  type="button"
                  onClick={handleSaveFishEligibility}
                  disabled={fishModalSaving}
                  style={{
                    background: '#1E56A0',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: fishModalSaving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                  }}
                >
                  {fishModalSaving ? 'Saving...' : 'Save Eligibility'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
