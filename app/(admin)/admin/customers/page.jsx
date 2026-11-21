'use client';

/**
 * ADMIN-10 — Customer Directory & Accounts
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 79-89)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AdminSubNav, AdminPagination, AdminTableSkeleton } from '@/components/ui';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subFilter, setSubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Customer Detail Drawer state
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Block/Unblock Modal state
  const [blockTarget, setBlockTarget] = useState(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/v1/admin/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load customers.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch full details when customer is selected
  const openCustomerDetails = async (customerId) => {
    setSelectedCustomerId(customerId);
    setDetailsLoading(true);
    setCustomerDetails(null);
    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}`);
      const data = await res.json();
      if (data.success) {
        setCustomerDetails(data.data);
      } else {
        setErrorMsg(data.error?.message || 'Failed to load customer profile details.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching profile details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!blockTarget) return;
    setActionLoading(true);
    try {
      const nextBlocked = !blockTarget.isBlocked;
      const res = await fetch(`/api/v1/admin/customers/${blockTarget.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: nextBlocked }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Status update failed.');
      }

      setSuccessMsg(data.message || 'Customer status updated.');
      setBlockTarget(null);

      // Refresh list and modal
      await fetchCustomers();
      if (selectedCustomerId === blockTarget.id) {
        openCustomerDetails(blockTarget.id);
      }
    } catch (err) {
      setErrorMsg(err.message);
      setBlockTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        !search ||
        (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
        (c.mobile_number && c.mobile_number.includes(search)) ||
        (c.area && c.area.toLowerCase().includes(search.toLowerCase()));

      const matchSub =
        subFilter === 'ALL' ||
        (subFilter === 'ACTIVE' && c.subscription_status === 'ACTIVE') ||
        (subFilter === 'INACTIVE' && c.subscription_status !== 'ACTIVE');

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'BLOCKED' && c.isBlocked) ||
        (statusFilter === 'ACTIVE' && !c.isBlocked);

      return matchSearch && matchSub && matchStatus;
    });
  }, [customers, search, subFilter, statusFilter]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [search, subFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / limit));
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredCustomers.slice(start, start + limit);
  }, [filteredCustomers, page, limit]);

  const metrics = useMemo(() => {
    const total = customers.length;
    const subscribers = customers.filter((c) => c.subscription_status === 'ACTIVE').length;
    const blocked = customers.filter((c) => c.isBlocked).length;
    const totalBookings = customers.reduce((sum, c) => sum + (c.bookings_count || 0), 0);
    return { total, subscribers, blocked, totalBookings };
  }, [customers]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', paddingBottom: '40px' }}>
      <AdminSubNav
        tabs={[
          { label: 'Customer Directory & Accounts', href: '/admin/customers', exact: true },
          { label: 'Broadcasts & Notifications', href: '/admin/notifications' },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Customer Directory &amp; Accounts
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={fetchCustomers}
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
        </div>
      </div>

      {/* Alerts */}
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

      {/* KPI Cards */}
      <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>TOTAL CUSTOMERS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#0F2C59', marginTop: '4px' }}>{metrics.total}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ACTIVE SUBSCRIBERS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#10B981', marginTop: '4px' }}>{metrics.subscribers}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>TOTAL BOOKINGS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#1E56A0', marginTop: '4px' }}>{metrics.totalBookings}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>BLOCKED ACCOUNTS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: metrics.blocked > 0 ? '#EF4444' : '#64748B', marginTop: '4px' }}>
            {metrics.blocked}
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Pills & Search Input */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)',
      }}>
        {/* Row 1: Filter Pills */}
        <div
          className="pf-admin-pill-scroll"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '14px',
            borderBottom: '1px solid #F1F5F9',
            marginBottom: '14px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'ALL', label: `All Customers (${customers.length})`, filterType: 'status' },
            { id: 'ACTIVE', label: `Active (${customers.filter((c) => !c.isBlocked).length})`, filterType: 'status' },
            { id: 'SUB_ACTIVE', label: `Subscribers (${customers.filter((c) => c.subscription_status === 'ACTIVE').length})`, filterType: 'sub' },
            { id: 'SUB_RETAIL', label: `Retail (${customers.filter((c) => c.subscription_status !== 'ACTIVE').length})`, filterType: 'sub' },
            { id: 'BLOCKED', label: `Blocked (${customers.filter((c) => c.isBlocked).length})`, filterType: 'status' },
          ].map((pill) => {
            const isSelected =
              pill.filterType === 'status'
                ? (pill.id === 'ALL' && statusFilter === 'ALL' && subFilter === 'ALL') ||
                  (pill.id === statusFilter && subFilter === 'ALL')
                : (pill.id === 'SUB_ACTIVE' && subFilter === 'ACTIVE') ||
                  (pill.id === 'SUB_RETAIL' && subFilter === 'INACTIVE');

            const handleClick = () => {
              if (pill.id === 'ALL') {
                setStatusFilter('ALL');
                setSubFilter('ALL');
              } else if (pill.filterType === 'status') {
                setStatusFilter(pill.id);
                setSubFilter('ALL');
              } else if (pill.id === 'SUB_ACTIVE') {
                setSubFilter('ACTIVE');
                setStatusFilter('ALL');
              } else if (pill.id === 'SUB_RETAIL') {
                setSubFilter('INACTIVE');
                setStatusFilter('ALL');
              }
            };

            return (
              <button
                key={pill.id}
                type="button"
                onClick={handleClick}
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
                  flexShrink: 0,
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Row 2: Search Input */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none', display: 'flex' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="customer-search-input"
              type="text"
              placeholder="Search by customer name, 10-digit mobile, or locality area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontSize: '13px',
                color: '#0F2C59',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Customers Table Container */}
      <div
        className="pf-admin-table-card"
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Subtle Top Loading Line */}
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

        <div className="pf-admin-table-scroll" style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px', fontWeight: '800' }}>
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px' }}>Mobile Number</th>
                <th style={{ padding: '14px 20px' }}>Account Status</th>
                <th style={{ padding: '14px 20px' }}>Subscription &amp; Credit</th>
                <th style={{ padding: '14px 20px' }}>Activity (Orders / Txns)</th>
                <th style={{ padding: '14px 20px' }}>Registered</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton columns={7} rows={5} />
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '64px 20px', textAlign: 'center', color: '#64748B' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px' }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
                      No Customers Found
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      {search ? 'Try adjusting your search keywords.' : 'No customer accounts match the selected filter.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c, idx) => {
                  const initials = (c.name || 'CU')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: idx < paginatedCustomers.length - 1 ? '1px solid #F1F5F9' : 'none',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Customer Info */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            color: '#1E56A0',
                            fontWeight: '800',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: '800', color: '#0F2C59', fontSize: '14px' }}>
                              {c.name || 'Unnamed Customer'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {c.area || 'Locality not set'} {c.age ? `• Age ${c.age}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Mobile */}
                      <td style={{ padding: '16px 20px', fontWeight: '600', color: '#0F2C59' }}>
                        +91 {c.mobile_number}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {c.isBlocked ? (
                          <span style={{
                            background: '#FEF2F2',
                            color: '#991B1B',
                            border: '1px solid #FECACA',
                            padding: '3px 9px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            Blocked
                          </span>
                        ) : (
                          <span style={{
                            background: '#ECFDF5',
                            color: '#065F46',
                            border: '1px solid #A7F3D0',
                            padding: '3px 9px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            Active
                          </span>
                        )}
                      </td>

                      {/* Subscription & Credit */}
                      <td style={{ padding: '16px 20px' }}>
                        {c.subscription_status === 'ACTIVE' ? (
                          <div>
                            <div style={{ color: '#1E56A0', fontWeight: '800', fontSize: '13px' }}>
                              {c.subscription_plan_name || 'Active Plan'}
                            </div>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#ECFDF5',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #A7F3D0',
                              marginTop: '3px',
                            }}>
                              <span style={{ color: '#065F46', fontWeight: '800', fontSize: '12px' }}>
                                ₹{Number(c.credit_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#64748B', fontSize: '12.5px' }}>Retail Customer</span>
                        )}
                      </td>

                      {/* Activity */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: '#0F2C59', fontWeight: '700' }}>
                          {c.bookings_count || 0} Bookings
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          {c.transactions_count || 0} Transactions
                        </div>
                      </td>

                      {/* Registered */}
                      <td style={{ padding: '16px 20px', color: '#64748B', fontSize: '12.5px' }}>
                        {new Date(c.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => openCustomerDetails(c.id)}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #CBD5E1',
                              color: '#1E56A0',
                              padding: '6px 12px',
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                            <span>Profile</span>
                          </button>

                          <button
                            onClick={() => setBlockTarget(c)}
                            style={{
                              background: c.isBlocked ? '#ECFDF5' : '#FEF2F2',
                              border: `1px solid ${c.isBlocked ? '#A7F3D0' : '#FECACA'}`,
                              color: c.isBlocked ? '#065F46' : '#991B1B',
                              padding: '6px 12px',
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {c.isBlocked ? (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>Unblock</span>
                              </>
                            ) : (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                                </svg>
                                <span>Block</span>
                              </>
                            )}
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

        {/* Standard Pagination Bar */}
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={filteredCustomers.length}
          limit={limit}
          onPageChange={(p) => setPage(p)}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          itemName="customers"
          loading={loading}
          limitOptions={[10, 25, 50, 100]}
        />
      </div>

      {/* Customer Details Drawer / Modal */}
      {selectedCustomerId && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '740px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px -8px rgba(15, 44, 89, 0.2)',
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
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                  Customer Profile &amp; History
                </h2>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  ID: {selectedCustomerId}
                </span>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
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
                  fontSize: '22px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {detailsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #E2E8F0',
                    borderTopColor: '#1E56A0',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 12px',
                  }} />
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>Loading customer profile details...</div>
                </div>
              ) : !customerDetails ? (
                <div style={{ color: '#991B1B', background: '#FEF2F2', padding: '14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                  Failed to load profile details.
                </div>
              ) : (
                <div>
                  {/* Identity Grid */}
                  <div style={{
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    border: '1px solid #E2E8F0',
                    marginBottom: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CUSTOMER NAME</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', marginTop: '4px' }}>
                        {customerDetails.customer?.name || 'Unnamed Customer'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>MOBILE NUMBER</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E56A0', marginTop: '4px' }}>
                        +91 {customerDetails.customer?.mobile_number}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ACCOUNT STATUS</div>
                      <div style={{ marginTop: '4px' }}>
                        {customerDetails.isBlocked ? (
                          <span style={{
                            background: '#FEF2F2',
                            color: '#991B1B',
                            border: '1px solid #FECACA',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                          }}>
                            Blocked
                          </span>
                        ) : (
                          <span style={{
                            background: '#ECFDF5',
                            color: '#065F46',
                            border: '1px solid #A7F3D0',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LOCALITY / AREA</div>
                      <div style={{ fontSize: '13px', color: '#0F2C59', fontWeight: '600', marginTop: '4px' }}>
                        {customerDetails.customer?.area || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AGE</div>
                      <div style={{ fontSize: '13px', color: '#0F2C59', fontWeight: '600', marginTop: '4px' }}>
                        {customerDetails.customer?.age || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>JOINED DATE</div>
                      <div style={{ fontSize: '13px', color: '#0F2C59', fontWeight: '600', marginTop: '4px' }}>
                        {new Date(customerDetails.customer?.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Active Subscription Section */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E56A0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Subscription State
                    </div>
                    {customerDetails.activeSubscription ? (
                      <div style={{
                        background: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '14px',
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '800', textTransform: 'uppercase' }}>PLAN NAME</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#065F46', marginTop: '2px' }}>
                            {customerDetails.activeSubscription.plan_name}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '800', textTransform: 'uppercase' }}>CREDIT BALANCE</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                            ₹{Number(customerDetails.activeSubscription.credit_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '800', textTransform: 'uppercase' }}>EXPIRES AT</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#065F46', marginTop: '2px' }}>
                            {new Date(customerDetails.activeSubscription.expires_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#F8FAFC', padding: '14px 18px', borderRadius: '10px', border: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                        No active monthly subscription plan enrolled.
                      </div>
                    )}
                  </div>

                  {/* Recent Bookings Section */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F2C59', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Recent Bookings ({customerDetails.bookings?.length || 0})
                    </div>
                    {(!customerDetails.bookings || customerDetails.bookings.length === 0) ? (
                      <div style={{ fontSize: '13px', color: '#64748B', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        No booking records found.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                          <thead style={{ background: '#F8FAFC', color: '#475569', textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}>
                            <tr>
                              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Booking Code</th>
                              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Total</th>
                              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Status</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDetails.bookings.slice(0, 10).map((b, bIdx) => (
                              <tr key={b.id} style={{ borderBottom: bIdx < customerDetails.bookings.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                                <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1E56A0' }}>{b.booking_code}</td>
                                <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0F2C59' }}>₹{Number(b.total_amount).toFixed(2)}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    background: b.status === 'COMPLETED' ? '#ECFDF5' : '#F1F5F9',
                                    color: b.status === 'COMPLETED' ? '#065F46' : '#475569',
                                    border: `1px solid ${b.status === 'COMPLETED' ? '#A7F3D0' : '#CBD5E1'}`,
                                  }}>
                                    {b.status}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B' }}>
                                  {new Date(b.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recent Transactions Section */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F2C59', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Recent Financial Transactions ({customerDetails.transactions?.length || 0})
                    </div>
                    {(!customerDetails.transactions || customerDetails.transactions.length === 0) ? (
                      <div style={{ fontSize: '13px', color: '#64748B', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        No transaction records found.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                          <thead style={{ background: '#F8FAFC', color: '#475569', textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}>
                            <tr>
                              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Txn #</th>
                              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Method</th>
                              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Paid Amount</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDetails.transactions.slice(0, 10).map((t, tIdx) => (
                              <tr key={t.id} style={{ borderBottom: tIdx < customerDetails.transactions.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                                <td style={{ padding: '10px 14px', color: '#1E56A0', fontWeight: '700' }}>{t.transaction_number || t.id.slice(0, 8)}</td>
                                <td style={{ padding: '10px 14px', color: '#64748B' }}>{t.payment_method}</td>
                                <td style={{ padding: '10px 14px', fontWeight: '800', color: '#059669' }}>₹{Number(t.final_paid_amount || 0).toFixed(2)}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B' }}>
                                  {new Date(t.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedCustomerId(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0F2C59',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15, 44, 89, 0.04)',
                }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block / Unblock Modal */}
      {blockTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            border: `1px solid ${blockTarget.isBlocked ? '#A7F3D0' : '#FECACA'}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 40px -8px rgba(15, 44, 89, 0.2)',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: '800', color: blockTarget.isBlocked ? '#065F46' : '#991B1B' }}>
              {blockTarget.isBlocked ? `Reactivate Account: ${blockTarget.name}` : `Block Account: ${blockTarget.name}`}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#425B73', lineHeight: '1.5' }}>
              {blockTarget.isBlocked
                ? `Customer (+91 ${blockTarget.mobile_number}) will regain access to create fresh bookings and claim subscription quotas.`
                : `Blocking customer (+91 ${blockTarget.mobile_number}) will immediately reject all new order creation attempts at checkout. Historical booking snapshots and payment records remain preserved.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setBlockTarget(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#425B73',
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
                onClick={handleToggleBlock}
                disabled={actionLoading}
                style={{
                  background: blockTarget.isBlocked ? '#059669' : '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  boxShadow: blockTarget.isBlocked ? '0 2px 6px rgba(5, 150, 105, 0.25)' : '0 2px 6px rgba(220, 38, 38, 0.25)',
                }}
              >
                {actionLoading ? 'Processing...' : blockTarget.isBlocked ? 'Confirm Reactivation' : 'Confirm Block Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
