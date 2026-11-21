'use client';

/**
 * AP-20: Operational Exceptions Center & Order Alerts
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 169–173)
 * Centralized operational anomaly monitoring, severity grading, and authorized resolution workflows.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminSubNav, AdminPagination, AdminSelect, AdminTableSkeleton } from '@/components/ui';

export default function AdminExceptionsPage() {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Selected Exception for Detail Modal
  const [selectedException, setSelectedException] = useState(null);

  // Resolution Action State
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const [showConfirmResolve, setShowConfirmResolve] = useState(null);

  // Lock body scroll and handle Escape key when modals are open
  useEffect(() => {
    const isAnyModalOpen = Boolean(selectedException || showConfirmResolve);
    if (!isAnyModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedException(null);
        setShowConfirmResolve(null);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedException, showConfirmResolve]);

  const fetchExceptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (severity) params.append('severity', severity);

      const res = await fetch(`/api/v1/admin/exceptions?${params.toString()}`);

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/exceptions';
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch operational exceptions');
      }

      setExceptions(json.data || []);
    } catch (err) {
      console.error('[Exceptions Error]:', err);
      setError(err.message || 'Unable to load operational exceptions.');
    } finally {
      setLoading(false);
    }
  }, [category, severity]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [category, severity]);

  const totalPages = Math.ceil(exceptions.length / limit) || 1;
  const paginatedExceptions = useMemo(() => {
    const start = (page - 1) * limit;
    return exceptions.slice(start, start + limit);
  }, [exceptions, page, limit]);

  const handleExecuteResolution = async (ex, reasonText) => {
    try {
      setResolvingId(ex.id);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch('/api/v1/admin/exceptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actionType: ex.allowedAction,
          entityId: ex.entityId,
          reason: reasonText || resolutionReason || 'Admin resolved operational anomaly',
        }),
      });

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/exceptions';
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to execute resolution action');
      }

      setSuccessMsg(`Exception for ${ex.entityType} ${ex.entityId} successfully resolved and recorded in audit trail.`);
      setShowConfirmResolve(null);
      setSelectedException(null);
      setResolutionReason('');
      fetchExceptions();
    } catch (err) {
      console.error('[Resolution Error]:', err);
      setError(err.message || 'Resolution failed.');
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' };
      case 'HIGH':
        return { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' };
      case 'MEDIUM':
        return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
      case 'LOW':
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
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
            Order Alerts &amp; Operational Exceptions
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            background: exceptions.length > 0 ? '#FFF7ED' : '#ECFDF5',
            color: exceptions.length > 0 ? '#C2410C' : '#065F46',
            border: `1px solid ${exceptions.length > 0 ? '#FED7AA' : '#A7F3D0'}`,
            padding: '6px 14px',
            borderRadius: '8px',
            fontWeight: '700',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: exceptions.length > 0 ? '#EA580C' : '#10B981' }} />
            <span>{exceptions.length > 0 ? `${exceptions.length} Active Anomalies` : 'All Systems Healthy'}</span>
          </div>

          <button
            onClick={fetchExceptions}
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
            <span>{loading ? 'Scanning...' : 'Refresh Alerts'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#065F46', fontSize: '13px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#991B1B', fontSize: '13px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B' }}>Severity:</label>
          <AdminSelect
            value={severity}
            onChange={(val) => setSeverity(val)}
            options={[
              { value: '', label: 'All Severities' },
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ]}
            style={{ minWidth: '160px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B' }}>Category:</label>
          <AdminSelect
            value={category}
            onChange={(val) => setCategory(val)}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'FAILED_PAYMENTS', label: 'Failed Payments' },
              { value: 'EXPIRED_BOOKINGS', label: 'Expired Bookings' },
              { value: 'INVENTORY_ANOMALIES', label: 'Inventory Anomalies' },
              { value: 'NOTIFICATION_FAILURES', label: 'Notification Failures' },
              { value: 'STALE_GPS', label: 'Stale GPS Telemetry' },
            ]}
            style={{ minWidth: '200px' }}
          />
        </div>
      </div>

      {/* Exception List Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'visible', position: 'relative', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
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

        <div style={{ overflowX: 'auto', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Issue &amp; Category</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Entity</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current State</th>
                <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested Action</th>
                <th style={{ padding: '14px 18px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={6} rows={5} />
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#065F46', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                      No operational exceptions detected
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                      All payments, inventory allocations, pickup reservations, and GPS fleet telemetry are operating within normal parameters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedExceptions.map((ex) => {
                  const badge = getSeverityBadge(ex.severity);
                  return (
                    <tr
                      key={ex.id}
                      style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {ex.severity}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '700', color: '#0F2C59' }}>{ex.issue}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          Category: {ex.category}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#1E56A0', border: '1px solid #CBD5E1' }}>
                          {ex.entityType}
                        </span>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                          ID: {ex.entityId?.slice(0, 10)}...
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', color: '#0F2C59', fontWeight: '500', fontSize: '12px' }}>
                        {ex.currentState}
                      </td>

                      <td style={{ padding: '14px 18px', color: '#475569', fontSize: '12px', maxWidth: '300px', lineHeight: '1.4' }}>
                        {ex.suggestedAction}
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedException(ex)}
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
                          {ex.canResolve && (
                            <button
                              onClick={() => setShowConfirmResolve(ex)}
                              disabled={resolvingId === ex.id}
                              style={{
                                background: '#1E56A0',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '5px 14px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: '700',
                                boxShadow: '0 1px 3px rgba(30, 86, 160, 0.25)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
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
          page={page}
          totalPages={totalPages}
          total={exceptions.length}
          limit={limit}
          onPageChange={(p) => setPage(p)}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          itemName="anomalies"
          loading={loading}
        />
      </div>

      {/* Exception Detail Modal */}
      {selectedException && (
        <div
          onClick={() => setSelectedException(null)}
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
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                Operational Exception Details
              </h3>
              <button
                onClick={() => setSelectedException(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Severity:</span>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '9999px', background: getSeverityBadge(selectedException.severity).bg, color: getSeverityBadge(selectedException.severity).text, border: `1px solid ${getSeverityBadge(selectedException.severity).border}` }}>
                    {selectedException.severity}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Category:</span>
                <div style={{ color: '#0F2C59', fontWeight: '600', marginTop: '2px' }}>{selectedException.category}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Entity Type:</span>
                <div style={{ color: '#0F2C59', fontWeight: '600', marginTop: '2px' }}>{selectedException.entityType}</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Current State:</span>
                <div style={{ color: '#0F2C59', fontWeight: '600', marginTop: '2px' }}>{selectedException.currentState}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Entity ID:</span>
                <div style={{ fontFamily: 'monospace', color: '#0F2C59', fontSize: '12px', marginTop: '2px', wordBreak: 'break-all' }}>{selectedException.entityId}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: '6px' }}>
                Suggested Resolution Procedure
              </label>
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', lineHeight: '1.4' }}>
                {selectedException.suggestedAction}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSelectedException(null)}
                style={{ background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
              {selectedException.canResolve && (
                <button
                  onClick={() => {
                    const ex = selectedException;
                    setSelectedException(null);
                    setShowConfirmResolve(ex);
                  }}
                  style={{ background: '#1E56A0', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '9px 20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)' }}
                >
                  Proceed to Resolution
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolution Confirmation Modal */}
      {showConfirmResolve && (
        <div
          onClick={() => { setShowConfirmResolve(null); setResolutionReason(''); }}
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
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              overscrollBehavior: 'contain',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: '0 0 12px 0' }}>
              Confirm Exception Resolution
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Executing this resolution will invoke the authorized remedy for this anomaly and log an immutable audit record.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '14px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '6px', color: '#0F2C59', fontWeight: '700' }}>
                Action: {showConfirmResolve.allowedAction}
              </div>
              <div style={{ color: '#64748B', fontSize: '12px' }}>
                Target: {showConfirmResolve.entityType} ({showConfirmResolve.entityId?.slice(0, 14)}...)
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: '6px' }}>
                Resolution Reason / Audit Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Customer contact verified or batch inventory restocked"
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowConfirmResolve(null); setResolutionReason(''); }}
                style={{ background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteResolution(showConfirmResolve, resolutionReason)}
                disabled={resolvingId === showConfirmResolve.id}
                style={{ background: '#1E56A0', color: '#FFFFFF', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)' }}
              >
                {resolvingId === showConfirmResolve.id ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
