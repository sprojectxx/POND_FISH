'use client';

/**
 * AP-19: Administrative Audit Trail & Activity Log
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 164–168)
 * Immutable traceability of critical business mutations, security actions, settings updates, and system events.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminSubNav, AdminPagination, AdminSelect, AdminTableSkeleton } from '@/components/ui';

function formatActionName(action) {
  if (!action) return 'System Action';
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return '—';
  
  // Specific clean summaries
  if (payload.planTitle) {
    return `Plan: ${payload.planTitle}${payload.eligibleFishCount !== undefined ? ` (${payload.eligibleFishCount} fish varieties)` : ''}`;
  }
  if (payload.updated && typeof payload.updated === 'object') {
    const keys = Object.keys(payload.updated);
    if (keys.length > 0) {
      return `Updated: ${keys.map(k => k.replace(/_/g, ' ')).join(', ')}`;
    }
  }
  if (payload.reason) {
    return `Reason: ${payload.reason}`;
  }
  if (payload.name) {
    return `Name: ${payload.name}`;
  }
  if (payload.status) {
    return `Status changed: ${payload.status}`;
  }
  if (payload.amount !== undefined) {
    return `Amount: ₹${payload.amount}`;
  }

  // Fallback: concise keys
  const keys = Object.keys(payload).filter(k => k !== 'ip' && k !== 'userAgent');
  if (keys.length > 0) {
    return `Fields: ${keys.slice(0, 3).join(', ')}`;
  }

  return 'Event recorded';
}

function formatDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actorType, setActorType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Selected Log for Inspection Modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Lock body scroll and handle Escape key when modal is open
  useEffect(() => {
    if (!selectedLog) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedLog]);

  const fetchLogs = useCallback(async (page = 1, limit = pagination.limit || 25) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (actorType) params.append('actorType', actorType);
      if (entityType) params.append('entityType', entityType);
      if (search) params.append('search', search);
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const res = await fetch(`/api/v1/admin/audit?${params.toString()}`);

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/audit';
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch audit records');
      }

      setLogs(json.data.logs || []);
      setPagination(json.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('[Audit Error]:', err);
      setError(err.message || 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, actorType, entityType, search, from, to]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleResetFilters = () => {
    setActorType('');
    setEntityType('');
    setSearch('');
    setFrom('');
    setTo('');
  };

  const getActorBadgeStyle = (type) => {
    switch (type) {
      case 'ADMIN':
        return { bg: '#EFF6FF', text: '#1E56A0', border: '#BFDBFE' };
      case 'WORKER':
        return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
      case 'CUSTOMER':
        return { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' };
      case 'SYSTEM':
        return { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Store Operations', href: '/admin/settings', exact: true },
          { label: 'Reports & Exports', href: '/admin/reports' },
          { label: 'Activity Log', href: '/admin/audit' },
          { label: 'Order Alerts', href: '/admin/exceptions' },
          { label: 'Security & Passwords', href: '/admin/security' },
          { label: 'My Profile', href: '/admin/profile' },
        ]}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Store Activity Log
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', boxShadow: '0 1px 2px rgba(15, 44, 89, 0.04)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
            <span style={{ color: '#065F46', fontWeight: '700' }}>Live Trail</span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span style={{ color: '#64748B', fontWeight: '600' }}>{pagination.total} Logged Events</span>
          </div>

          <button
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#0F2C59',
              height: '36px',
              padding: '0 14px',
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
        </div>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleFilterSubmit} style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: '6px' }}>Actor Type</label>
            <AdminSelect
              value={actorType}
              onChange={(val) => setActorType(val)}
              options={[
                { value: '', label: 'All Actors' },
                { value: 'ADMIN', label: 'Admin User' },
                { value: 'WORKER', label: 'Store Worker' },
                { value: 'CUSTOMER', label: 'Customer' },
                { value: 'SYSTEM', label: 'System Process' },
              ]}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: '6px' }}>Entity Type</label>
            <AdminSelect
              value={entityType}
              onChange={(val) => setEntityType(val)}
              options={[
                { value: '', label: 'All Entities' },
                { value: 'SETTINGS', label: 'Store Settings' },
                { value: 'INVENTORY', label: 'Inventory Allocation' },
                { value: 'FISH', label: 'Fish Varieties' },
                { value: 'BOOKING', label: 'Customer Bookings' },
                { value: 'TRANSACTION', label: 'Sales & Receipts' },
                { value: 'SUBSCRIPTION', label: 'Subscriptions' },
              ]}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: '6px' }}>Search Details</label>
            <input
              type="text"
              placeholder="Filter by keyword or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={{ flex: 1, background: '#1E56A0', color: '#FFFFFF', border: 'none', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)', transition: 'all 0.15s ease' }}
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#64748B', padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#991B1B', fontSize: '13px', fontWeight: '600' }}>
          <span>{error}</span>
          <button onClick={() => fetchLogs(1)} style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>
            Retry
          </button>
        </div>
      )}

      {/* Streamlined Activity Log Table */}
      <div
        className="pf-admin-table-card"
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
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

        <div className="pf-admin-table-scroll" style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Date &amp; Time</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Actor</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Action</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Target Area</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Details &amp; Summary</th>
                <th style={{ padding: '14px 18px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={6} rows={5} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600' }}>No activity records match the selected filters.</p>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Audit entries are recorded automatically whenever changes or operations occur.</span>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actorStyle = getActorBadgeStyle(log.actor_type);
                  const readableAction = formatActionName(log.action);
                  const summaryText = summarizePayload(log.payload);

                  return (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', color: '#64748B', fontSize: '12px' }}>
                        {formatDate(log.timestamp)}
                      </td>

                      {/* Actor Badge */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            background: actorStyle.bg,
                            color: actorStyle.text,
                            border: `1px solid ${actorStyle.border}`,
                          }}
                        >
                          {log.actor_type}
                        </span>
                      </td>

                      {/* Action Name */}
                      <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0F2C59' }}>
                        {readableAction}
                      </td>

                      {/* Target Area */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }}>
                          {log.entity_type}
                        </span>
                      </td>

                      {/* Summary */}
                      <td style={{ padding: '14px 18px', maxWidth: '380px', color: '#475569', fontSize: '12px', lineHeight: '1.4' }}>
                        {summaryText}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          style={{
                            background: '#F8FAFC',
                            color: '#1E56A0',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination Controls */}
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(newPage) => fetchLogs(newPage, pagination.limit)}
          onLimitChange={(newLimit) => {
            setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
            fetchLogs(1, newLimit);
          }}
          itemName="records"
          loading={loading}
        />
      </div>

      {/* Audit Detail Modal (Section 167) */}
      {selectedLog && (
        <div
          onClick={() => setSelectedLog(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 44, 89, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            className="pf-admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                Audit Record Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Timestamp:</span>
                <div style={{ color: '#0F2C59', fontWeight: '600', marginTop: '2px' }}>{formatDate(selectedLog.timestamp)}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Actor:</span>
                <div style={{ color: '#0F2C59', fontWeight: '600', marginTop: '2px' }}>{selectedLog.actor_type} ({selectedLog.actor_id})</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Action:</span>
                <div style={{ color: '#1E56A0', fontWeight: '700', marginTop: '2px' }}>{selectedLog.action}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Target Area:</span>
                <div style={{ color: '#0F2C59', fontWeight: '600', marginTop: '2px' }}>{selectedLog.entity_type}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Entity ID:</span>
                <div style={{ fontFamily: 'monospace', color: '#0F2C59', fontSize: '12px', marginTop: '2px', wordBreak: 'break-all' }}>{selectedLog.entity_id}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: '6px' }}>
                Event Payload &amp; Technical Metadata
              </label>
              <pre style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '12px', overflowX: 'auto', maxHeight: '250px', lineHeight: '1.4' }}>
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: '#1E56A0', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '9px 20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
