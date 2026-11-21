'use client';

/**
 * ADMIN-11 — Workers
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 90-95)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AdminPagination, AdminSelect, AdminTableSkeleton } from '@/components/ui';

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [resetWorker, setResetWorker] = useState(null);
  const [toggleWorkerTarget, setToggleWorkerTarget] = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    mobile_number: '',
    password: '',
    active: true,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    mobile_number: '',
    active: true,
  });

  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  });

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/v1/admin/workers');
      const data = await res.json();
      if (data.success) {
        setWorkers(data.workers || []);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load worker accounts.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching workers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/admin/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create worker account.');
      }

      setSuccessMsg(`Worker account for "${data.worker.name}" created successfully.`);
      setIsCreateOpen(false);
      setCreateForm({ name: '', mobile_number: '', password: '', active: true });
      await fetchWorkers();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingWorker) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/workers/${editingWorker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update worker account.');
      }

      setSuccessMsg(`Worker "${data.worker.name}" updated successfully.`);
      setEditingWorker(null);
      await fetchWorkers();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetWorker) return;
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/workers/${resetWorker.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordForm.password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to reset password.');
      }

      setSuccessMsg(`Password for worker "${resetWorker.name}" has been reset.`);
      setResetWorker(null);
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleWorkerTarget) return;
    setActionLoading(true);
    try {
      const nextActive = !toggleWorkerTarget.active;
      const res = await fetch(`/api/v1/admin/workers/${toggleWorkerTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update worker status.');
      }

      setSuccessMsg(`Worker status changed to ${nextActive ? 'Active' : 'Disabled'}.`);
      setToggleWorkerTarget(null);
      await fetchWorkers();
    } catch (err) {
      setErrorMsg(err.message);
      setToggleWorkerTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (w) => {
    setEditingWorker(w);
    setEditForm({
      name: w.name,
      mobile_number: w.mobile_number,
      active: w.active !== false,
    });
  };

  const openResetModal = (w) => {
    setResetWorker(w);
    setPasswordForm({ password: '', confirmPassword: '' });
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchSearch =
        !search ||
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.mobile_number.includes(search);

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && w.active !== false) ||
        (statusFilter === 'DISABLED' && w.active === false);

      return matchSearch && matchStatus;
    });
  }, [workers, search, statusFilter]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filteredWorkers.length / limit) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredWorkers.slice(start, start + limit);
  }, [filteredWorkers, page, limit]);

  const metrics = useMemo(() => {
    const total = workers.length;
    const active = workers.filter((w) => w.active !== false).length;
    const todayOrders = workers.reduce((sum, w) => sum + (w.today_orders || 0), 0);
    const monthOrders = workers.reduce((sum, w) => sum + (w.month_orders || 0), 0);
    return { total, active, todayOrders, monthOrders };
  }, [workers]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Staff &amp; Shifts Management
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            id="btn-refresh-workers"
            onClick={fetchWorkers}
            disabled={loading}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#0F2C59',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
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
            id="btn-create-worker"
            onClick={() => setIsCreateOpen(true)}
            style={{
              background: '#1E56A0',
              border: 'none',
              color: '#FFFFFF',
              height: '38px',
              padding: '0 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Create Worker Account</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {/* KPI Cards */}
      <div
        className="pf-admin-metrics-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}
      >
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL WORKERS</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>{metrics.total}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTIVE FULFILLMENT STAFF</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>{metrics.active}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TODAY ORDERS FULFILLED</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#1E56A0', marginTop: '6px' }}>{metrics.todayOrders}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MONTHLY FULFILLMENTS</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#D97706', marginTop: '6px' }}>{metrics.monthOrders}</div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div style={{
        background: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
      }}>
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748B"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="worker-search-input"
            type="text"
            placeholder="Search worker by name or mobile number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '9px 12px 9px 36px',
              color: '#0F2C59',
              fontSize: '13px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'inline-flex', padding: '4px', background: '#F1F5F9', borderRadius: '10px', border: '1px solid #E2E8F0', gap: '4px' }}>
          {[
            { id: 'ALL', label: `All Staff (${metrics.total})` },
            { id: 'ACTIVE', label: `Active (${metrics.active})` },
            { id: 'DISABLED', label: `Disabled (${metrics.total - metrics.active})` },
          ].map((pill) => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? '#1E56A0' : 'transparent',
                  color: active ? '#FFFFFF' : '#64748B',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workers Table */}
      <div
        className="pf-admin-table-card"
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          position: 'relative',
          minHeight: '400px',
          boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
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
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
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
        <div className="pf-admin-table-scroll" style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Worker Name</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mobile (Login ID)</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Access Status</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today's Orders</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly Orders</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Created</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={7} rows={5} />
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    No worker accounts found.
                  </td>
                </tr>
              ) : (
                paginatedWorkers.map((w) => (
                  <tr
                    key={w.id}
                    style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: '#E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          color: '#0F2C59',
                          fontWeight: '700',
                        }}>
                          {w.name ? w.name.charAt(0).toUpperCase() : 'W'}
                        </div>
                        <span style={{ fontWeight: '700', color: '#0F2C59' }}>{w.name}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#1E56A0', fontWeight: '600' }}>
                      +91 {w.mobile_number}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {w.active !== false ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '0.04em',
                          background: '#ECFDF5',
                          color: '#065F46',
                          border: '1px solid #A7F3D0',
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                          ACTIVE
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '0.04em',
                          background: '#FEF2F2',
                          color: '#991B1B',
                          border: '1px solid #FECACA',
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                          DISABLED
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>
                      {w.today_orders || 0}
                    </td>

                    <td style={{ padding: '14px 18px', color: '#425B73' }}>
                      {w.month_orders || 0}
                    </td>

                    <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(w)}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#0F2C59',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openResetModal(w)}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            color: '#1E56A0',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Reset PIN
                        </button>
                        <button
                          onClick={() => setToggleWorkerTarget(w)}
                          style={{
                            background: w.active !== false ? '#FEF2F2' : '#ECFDF5',
                            border: `1px solid ${w.active !== false ? '#FECACA' : '#A7F3D0'}`,
                            color: w.active !== false ? '#991B1B' : '#065F46',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {w.active !== false ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={filteredWorkers.length}
          limit={limit}
          onPageChange={(p) => setPage(p)}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          itemName="staff members"
          loading={loading}
        />
      </div>

      {/* Create Worker Modal */}
      {isCreateOpen && (
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
          <div
            className="pf-admin-modal-card"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                Create Fulfillment Worker Account
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
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

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Full Worker Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  10-Digit Mobile Number (Login ID) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength="10"
                  pattern="[0-9]{10}"
                  value={createForm.mobile_number}
                  onChange={(e) => setCreateForm({ ...createForm, mobile_number: e.target.value.replace(/\D/g, '') })}
                  placeholder="9876543210"
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Temporary Password (min 6 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength="6"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="••••••••"
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

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#0F2C59', fontWeight: '500' }}>
                  <input
                    type="checkbox"
                    checked={createForm.active}
                    onChange={(e) => setCreateForm({ ...createForm, active: e.target.checked })}
                  />
                  <span>Active &amp; authorized to fulfill pickup orders immediately</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
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
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {editingWorker && (
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
          <div
            className="pf-admin-modal-card"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                Edit Worker: {editingWorker.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
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

            <form onSubmit={handleEdit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Full Worker Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  maxLength="10"
                  pattern="[0-9]{10}"
                  value={editForm.mobile_number}
                  onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value.replace(/\D/g, '') })}
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

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#0F2C59', fontWeight: '500' }}>
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  />
                  <span>Active &amp; Authorized</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
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
                  {actionLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetWorker && (
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
          <div
            className="pf-admin-modal-card"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px', color: '#0F2C59' }}>
              Reset Password: {resetWorker.name}
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748B' }}>
              Set a new cryptographic password for worker mobile (+91 {resetWorker.mobile_number}).
            </p>

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength="6"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  placeholder="••••••••"
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength="6"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResetWorker(null)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
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
                  {actionLoading ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable / Enable Confirmation Modal */}
      {toggleWorkerTarget && (
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
          <div
            className="pf-admin-modal-card"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: toggleWorkerTarget.active !== false ? '#991B1B' : '#065F46', fontWeight: '800' }}>
              {toggleWorkerTarget.active !== false ? `Disable Account: ${toggleWorkerTarget.name}` : `Enable Account: ${toggleWorkerTarget.name}`}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
              {toggleWorkerTarget.active !== false
                ? `Disabling this account immediately prevents new logins to the worker fulfillment portal. All historical orders fulfilled by this worker remain intact for audit traceability.`
                : `Enabling this account will restore access to fulfill pickup orders.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setToggleWorkerTarget(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
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
                type="button"
                onClick={handleToggleStatus}
                disabled={actionLoading}
                style={{
                  background: toggleWorkerTarget.active !== false ? '#DC2626' : '#059669',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  boxShadow: toggleWorkerTarget.active !== false ? '0 2px 6px rgba(220, 38, 38, 0.25)' : '0 2px 6px rgba(5, 150, 105, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {actionLoading ? 'Updating...' : toggleWorkerTarget.active !== false ? 'Confirm Disable' : 'Confirm Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
