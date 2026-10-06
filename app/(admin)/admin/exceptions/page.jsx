'use client';

/**
 * AP-20: Operational Exceptions Center
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 169–173)
 * Centralized operational anomaly monitoring, severity grading, and authorized resolution workflows.
 */

import React, { useState, useEffect, useCallback } from 'react';

const ADMIN_SECRET = 'pondfish-admin-key-2026';

export default function AdminExceptionsPage() {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');

  // Selected Exception for Detail Modal
  const [selectedException, setSelectedException] = useState(null);

  // Resolution Action State
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const [showConfirmResolve, setShowConfirmResolve] = useState(null);

  const fetchExceptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (severity) params.append('severity', severity);

      const res = await fetch(`/api/v1/admin/exceptions?${params.toString()}`, {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });

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

  const handleExecuteResolution = async (ex, reasonText) => {
    try {
      setResolvingId(ex.id);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch('/api/v1/admin/exceptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({
          actionType: ex.allowedAction,
          entityId: ex.entityId,
          reason: reasonText || resolutionReason || 'Admin resolved operational anomaly',
        }),
      });

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
        return { bg: '#7F1D1D', text: '#FCA5A5', border: '#EF4444' };
      case 'HIGH':
        return { bg: '#7C2D12', text: '#FDBA74', border: '#F97316' };
      case 'MEDIUM':
        return { bg: '#713F12', text: '#FDE047', border: '#EAB308' };
      case 'LOW':
        return { bg: '#1E293B', text: '#94A3B8', border: '#475569' };
      default:
        return { bg: '#1E293B', text: '#94A3B8', border: '#334155' };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#F8FAFC' }}>
            Operational Exceptions Center
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>
            Centralized monitoring of failed transactions, overdue bookings, stock discrepancies, and delivery signals.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: '#1E293B', padding: '6px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
          <span style={{ color: exceptions.length > 0 ? '#F97316' : '#22C55E' }}>
            {exceptions.length > 0 ? `⚠️ ${exceptions.length} Active Anomalies` : '✅ All Systems Healthy'}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#064E3B', border: '1px solid #059669', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#A7F3D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: '#A7F3D0', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #DC2626', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#FECACA', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#1E293B', padding: '16px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Severity:</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            style={{ background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '6px 10px', color: '#F8FAFC', fontSize: '13px' }}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#94A3B8' }}>Category:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '6px 10px', color: '#F8FAFC', fontSize: '13px' }}
          >
            <option value="">All Categories</option>
            <option value="FAILED_PAYMENTS">Failed Payments</option>
            <option value="EXPIRED_BOOKINGS">Expired Bookings</option>
            <option value="INVENTORY_ANOMALIES">Inventory Anomalies</option>
            <option value="NOTIFICATION_FAILURES">Notification Failures</option>
            <option value="STALE_GPS">Stale GPS Telemetry</option>
          </select>
        </div>

        <button
          onClick={fetchExceptions}
          style={{ background: '#38BDF8', color: '#0B1120', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginLeft: 'auto' }}
        >
          🔄 Refresh Exceptions
        </button>
      </div>

      {/* Exception List Table */}
      <div style={{ background: '#1E293B', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            Scanning operational pipelines for anomalies...
          </div>
        ) : exceptions.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#22C55E' }}>🎉 No operational exceptions detected.</p>
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              All payments, inventory balances, bookings, and GPS journeys are operating within normal parameters.
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px 16px' }}>Severity</th>
                  <th style={{ padding: '12px 16px' }}>Issue</th>
                  <th style={{ padding: '12px 16px' }}>Entity</th>
                  <th style={{ padding: '12px 16px' }}>Current State</th>
                  <th style={{ padding: '12px 16px' }}>Suggested Action</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((ex) => {
                  const badge = getSeverityBadge(ex.severity);
                  return (
                    <tr key={ex.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {ex.severity}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#F8FAFC' }}>
                        {ex.issue}
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          Category: {ex.category}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '500' }}>{ex.entityType}</span>
                        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#CBD5E1' }}>
                          {ex.entityId}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#E2E8F0', fontSize: '12px' }}>
                        {ex.currentState}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px', maxWidth: '320px' }}>
                        {ex.suggestedAction}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setSelectedException(ex)}
                            style={{ background: '#334155', color: '#38BDF8', border: '1px solid #475569', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                          >
                            Inspect
                          </button>
                          {ex.canResolve && (
                            <button
                              onClick={() => setShowConfirmResolve(ex)}
                              disabled={resolvingId === ex.id}
                              style={{ background: '#F59E0B', color: '#0B1120', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exception Detail Modal */}
      {selectedException && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '28px', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: 0 }}>
                Exception Diagnosis: {selectedException.issue}
              </h3>
              <button
                onClick={() => setSelectedException(null)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#0F172A', padding: '16px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div>
                <span style={{ color: '#94A3B8' }}>Category: </span>
                <span style={{ color: '#F8FAFC' }}>{selectedException.category}</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Severity: </span>
                <span style={{ color: getSeverityBadge(selectedException.severity).text, fontWeight: 'bold' }}>{selectedException.severity}</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Affected Entity: </span>
                <span style={{ color: '#38BDF8', fontWeight: '500' }}>{selectedException.entityType} ({selectedException.entityId})</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Current State: </span>
                <span style={{ color: '#F8FAFC' }}>{selectedException.currentState}</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Suggested Action: </span>
                <span style={{ color: '#FCD34D' }}>{selectedException.suggestedAction}</span>
              </div>
            </div>

            {selectedException.context && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                  Diagnostic Context
                </label>
                <pre style={{ background: '#0B1120', padding: '14px', borderRadius: '6px', border: '1px solid #334155', color: '#38BDF8', fontSize: '12px', overflowX: 'auto' }}>
                  {JSON.stringify(selectedException.context, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSelectedException(null)}
                style={{ background: '#334155', color: '#F8FAFC', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}
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
                  style={{ background: '#F59E0B', color: '#0B1120', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Proceed to Resolve
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolution Confirmation Modal */}
      {showConfirmResolve && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1E293B', border: '1px solid #F59E0B', borderRadius: '12px', padding: '28px', maxWidth: '520px', width: '100%' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#F59E0B', margin: '0 0 12px 0' }}>
              ⚠️ Confirm Resolution Action
            </h3>
            <p style={{ fontSize: '13px', color: '#E2E8F0', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Executing action <strong>{showConfirmResolve.allowedAction}</strong> on {showConfirmResolve.entityType} <code>{showConfirmResolve.entityId}</code>.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                Resolution Reason (Recorded into Audit Trail):
              </label>
              <input
                type="text"
                placeholder="e.g., Stock physical count confirmed 0, deactivating listing"
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowConfirmResolve(null)}
                style={{ background: '#334155', color: '#F8FAFC', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteResolution(showConfirmResolve, resolutionReason)}
                disabled={resolvingId === showConfirmResolve.id}
                style={{ background: '#F59E0B', color: '#0B1120', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {resolvingId === showConfirmResolve.id ? 'Resolving...' : 'Confirm & Audit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
