'use client';

/**
 * AP-19: Administrative Audit Trail
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 164–168)
 * Immutable traceability of critical business mutations, security actions, settings updates, and system events.
 */

import React, { useState, useEffect, useCallback } from 'react';

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

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
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
  }, [actorType, entityType, search, from, to]);

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

  const getActorBadgeColor = (type) => {
    switch (type) {
      case 'ADMIN': return '#38BDF8';
      case 'WORKER': return '#F59E0B';
      case 'CUSTOMER': return '#22C55E';
      case 'SYSTEM': return '#A855F7';
      default: return '#94A3B8';
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#0F2C59' }}>
            System Mutation Audit Trail
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            Authoritative, immutable event records of critical mutations across operations and settings.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: '#FFFFFF', padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
          <span style={{ color: '#22C55E' }}>Immutable Ledger</span>
          <span style={{ color: '#64748B' }}>|</span>
          <span style={{ color: '#64748B' }}>{pagination.total} Logged Events</span>
        </div>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleFilterSubmit} style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>Actor Type</label>
            <select
              value={actorType}
              onChange={(e) => setActorType(e.target.value)}
              style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px', color: '#0F2C59', fontSize: '13px' }}
            >
              <option value="">All Actors</option>
              <option value="ADMIN">ADMIN</option>
              <option value="WORKER">WORKER</option>
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px', color: '#0F2C59', fontSize: '13px' }}
            >
              <option value="">All Entities</option>
              <option value="SETTINGS">SETTINGS</option>
              <option value="INVENTORY">INVENTORY</option>
              <option value="FISH">FISH</option>
              <option value="BOOKING">BOOKING</option>
              <option value="TRANSACTION">TRANSACTION</option>
              <option value="SUBSCRIPTION">SUBSCRIPTION</option>
              <option value="GPS_JOURNEY">GPS_JOURNEY</option>
              <option value="EXCEPTIONS">EXCEPTIONS</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>Search Keywords</label>
            <input
              type="text"
              placeholder="Action, entity ID, actor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px', color: '#0F2C59', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '7px', color: '#0F2C59', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '7px', color: '#0F2C59', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={{ flex: 1, background: '#38BDF8', color: '#0F2C59', border: 'none', borderRadius: '6px', padding: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{ background: '#F1F5F9', color: '#0F2C59', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #DC2626', borderRadius: '8px', padding: '14px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => fetchLogs(1)} style={{ background: '#EF4444', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Retry
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '15px' }}>No audit records match the selected filters.</p>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Audit entries are recorded automatically whenever mutations occur.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Actor</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>Entity Type</th>
                  <th style={{ padding: '12px 16px' }}>Entity ID</th>
                  <th style={{ padding: '12px 16px' }}>Payload Preview</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#64748B' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${getActorBadgeColor(log.actor_type)}22`,
                          color: getActorBadgeColor(log.actor_type),
                          marginRight: '6px',
                        }}
                      >
                        {log.actor_type}
                      </span>
                      <span style={{ fontSize: '12px', color: '#E2E8F0' }}>{log.actor_id}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0F2C59' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}>
                      {log.entity_type}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#425B73' }}>
                      {log.entity_id}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748B', fontSize: '12px' }}>
                      {log.payload ? JSON.stringify(log.payload) : 'None'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        style={{ background: '#F1F5F9', color: '#1E56A0', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && pagination.total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', fontSize: '12px', color: '#64748B' }}>
            <div>
              Showing {Math.min(pagination.total, (pagination.page - 1) * pagination.limit + 1)} - {Math.min(pagination.total, pagination.page * pagination.limit)} of {pagination.total} records
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                style={{ background: '#FFFFFF', color: '#0F2C59', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 10px', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                style={{ background: '#FFFFFF', color: '#0F2C59', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 10px', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Detail Modal (Section 167) */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 44, 89, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '28px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1E56A0', margin: 0 }}>
                Audit Record Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F8FAFC', padding: '16px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Event ID:</span>
                <div style={{ fontFamily: 'monospace', color: '#0F2C59', fontSize: '12px', marginTop: '2px' }}>{selectedLog.id}</div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Timestamp:</span>
                <div style={{ color: '#0F2C59', marginTop: '2px' }}>{new Date(selectedLog.timestamp).toLocaleString()}</div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Actor:</span>
                <div style={{ color: '#0F2C59', marginTop: '2px' }}>{selectedLog.actor_type} ({selectedLog.actor_id})</div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Action:</span>
                <div style={{ color: '#1E56A0', fontWeight: 'bold', marginTop: '2px' }}>{selectedLog.action}</div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Entity Type:</span>
                <div style={{ color: '#0F2C59', marginTop: '2px' }}>{selectedLog.entity_type}</div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Entity ID:</span>
                <div style={{ fontFamily: 'monospace', color: '#0F2C59', fontSize: '12px', marginTop: '2px' }}>{selectedLog.entity_id}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
                Event Payload & Technical Metadata
              </label>
              <pre style={{ background: '#F8FAFC', padding: '14px', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#1E56A0', fontSize: '12px', overflowX: 'auto', maxHeight: '250px' }}>
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: '#38BDF8', color: '#0F2C59', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 'bold', cursor: 'pointer' }}
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
