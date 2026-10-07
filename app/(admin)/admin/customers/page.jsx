'use client';

/**
 * ADMIN-10 — Customers
 * Traceability: PondFish Page-by-Page UI Specification Admin Portal (Section 79-89)
 */

import React, { useState, useEffect, useMemo } from 'react';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subFilter, setSubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
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

  const metrics = useMemo(() => {
    const total = customers.length;
    const subscribers = customers.filter((c) => c.subscription_status === 'ACTIVE').length;
    const blocked = customers.filter((c) => c.isBlocked).length;
    const totalBookings = customers.reduce((sum, c) => sum + (c.bookings_count || 0), 0);
    return { total, subscribers, blocked, totalBookings };
  }, [customers]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              Customer Directory &amp; Account Management
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
              ADMIN-10
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: '14px' }}>
            View customer profiles, active subscription quotas, order histories, and account status governance.
          </p>
        </div>

        <button
          onClick={fetchCustomers}
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
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>TOTAL CUSTOMERS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#F8FAFC', marginTop: '4px' }}>{metrics.total}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>ACTIVE SUBSCRIBERS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#10B981', marginTop: '4px' }}>{metrics.subscribers}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>TOTAL BOOKINGS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#38BDF8', marginTop: '4px' }}>{metrics.totalBookings}</div>
        </div>
        <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>BLOCKED ACCOUNTS</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: metrics.blocked > 0 ? '#EF4444' : '#64748B', marginTop: '4px' }}>
            {metrics.blocked}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{
        background: '#1E293B',
        padding: '16px 20px',
        borderRadius: '10px',
        border: '1px solid #334155',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <div style={{ flex: 1 }}>
          <input
            id="customer-search-input"
            type="text"
            placeholder="Search by customer name, 10-digit mobile, or locality area..."
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
          value={subFilter}
          onChange={(e) => setSubFilter(e.target.value)}
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        >
          <option value="ALL">All Subscriptions</option>
          <option value="ACTIVE">Active Plan Subscribers</option>
          <option value="INACTIVE">Non-Subscribers (Retail)</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        >
          <option value="ALL">All Account States</option>
          <option value="ACTIVE">Active Only</option>
          <option value="BLOCKED">Blocked Only</option>
        </select>
      </div>

      {/* Customers Table */}
      <div style={{ background: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Customer</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Phone</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Account Status</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Subscription &amp; Credit</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Activity (Orders / Txns)</th>
              <th style={{ padding: '14px 18px', fontWeight: '600' }}>Registered</th>
              <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  Loading customer records...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No customer records found matching search filters.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: '600', color: '#F8FAFC' }}>
                      {c.name || 'Unnamed Customer'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      {c.area || 'Locality not set'} {c.age ? `• Age ${c.age}` : ''}
                    </div>
                  </td>

                  <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#CBD5E1' }}>
                    +91 {c.mobile_number}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    {c.isBlocked ? (
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#EF4444',
                        border: '1px solid #EF4444',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}>
                        🚫 BLOCKED
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10B981',
                        border: '1px solid #10B981',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}>
                        ● ACTIVE
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    {c.subscription_status === 'ACTIVE' ? (
                      <div>
                        <div style={{ color: '#10B981', fontWeight: '600', fontSize: '12px' }}>
                          ✓ {c.subscription_plan_name || 'Active Plan'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '600' }}>
                          Balance: {Number(c.credit_balance || 0).toFixed(1)} kg
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748B', fontSize: '12px' }}>Retail Customer</span>
                    )}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ color: '#F8FAFC', fontWeight: '600' }}>
                      {c.bookings_count || 0} Bookings
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      {c.transactions_count || 0} Transactions
                    </div>
                  </td>

                  <td style={{ padding: '14px 18px', color: '#94A3B8', fontSize: '12px' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => openCustomerDetails(c.id)}
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
                        Profile
                      </button>
                      <button
                        onClick={() => setBlockTarget(c)}
                        style={{
                          background: c.isBlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${c.isBlocked ? '#10B981' : '#EF4444'}`,
                          color: c.isBlocked ? '#6EE7B7' : '#FCA5A5',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {c.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Details Drawer / Modal */}
      {selectedCustomerId && (
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
            maxWidth: '720px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                  Customer Details Profile
                </h2>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  ID: {selectedCustomerId}
                </span>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {detailsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  Loading customer details...
                </div>
              ) : !customerDetails ? (
                <div style={{ color: '#EF4444' }}>Failed to load profile.</div>
              ) : (
                <div>
                  {/* Identity Section */}
                  <div style={{
                    background: '#0F172A',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    border: '1px solid #334155',
                    marginBottom: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>CUSTOMER NAME</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#F8FAFC', marginTop: '4px' }}>
                        {customerDetails.customer?.name || 'Unnamed'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>MOBILE NUMBER</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#38BDF8', marginTop: '4px', fontFamily: 'monospace' }}>
                        +91 {customerDetails.customer?.mobile_number}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>ACCOUNT STATUS</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginTop: '4px', color: customerDetails.isBlocked ? '#EF4444' : '#10B981' }}>
                        {customerDetails.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>LOCALITY / AREA</div>
                      <div style={{ fontSize: '13px', color: '#CBD5E1', marginTop: '4px' }}>
                        {customerDetails.customer?.area || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>AGE</div>
                      <div style={{ fontSize: '13px', color: '#CBD5E1', marginTop: '4px' }}>
                        {customerDetails.customer?.age || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>JOINED DATE</div>
                      <div style={{ fontSize: '13px', color: '#CBD5E1', marginTop: '4px' }}>
                        {new Date(customerDetails.customer?.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Active Subscription Section */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#38BDF8', marginBottom: '10px' }}>
                      Subscription State
                    </h3>
                    {customerDetails.activeSubscription ? (
                      <div style={{
                        background: '#064E3B',
                        border: '1px solid #10B981',
                        borderRadius: '8px',
                        padding: '14px 18px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6EE7B7' }}>PLAN NAME</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFFFFF', marginTop: '2px' }}>
                            {customerDetails.activeSubscription.plan_name}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6EE7B7' }}>CREDIT BALANCE</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFFFFF', marginTop: '2px' }}>
                            {Number(customerDetails.activeSubscription.credit_balance).toFixed(1)} kg remaining
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6EE7B7' }}>EXPIRES AT</div>
                          <div style={{ fontSize: '13px', color: '#FFFFFF', marginTop: '2px' }}>
                            {new Date(customerDetails.activeSubscription.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '8px', border: '1px solid #334155', color: '#94A3B8', fontSize: '13px' }}>
                        No active monthly subscription plan.
                      </div>
                    )}
                  </div>

                  {/* Recent Bookings Section */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#CBD5E1', marginBottom: '10px' }}>
                      Recent Bookings ({customerDetails.bookings?.length || 0})
                    </h3>
                    {(!customerDetails.bookings || customerDetails.bookings.length === 0) ? (
                      <div style={{ fontSize: '13px', color: '#64748B' }}>No booking records found.</div>
                    ) : (
                      <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead style={{ background: '#0F172A', color: '#94A3B8' }}>
                            <tr>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Booking Code</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Total</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDetails.bookings.slice(0, 10).map((b) => (
                              <tr key={b.id} style={{ borderBottom: '1px solid #334155' }}>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#38BDF8' }}>{b.booking_code}</td>
                                <td style={{ padding: '8px 12px' }}>₹{Number(b.total_amount).toFixed(2)}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    background: b.status === 'COMPLETED' ? '#064E3B' : '#334155',
                                    color: b.status === 'COMPLETED' ? '#6EE7B7' : '#CBD5E1',
                                  }}>
                                    {b.status}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94A3B8' }}>
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
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#CBD5E1', marginBottom: '10px' }}>
                      Recent Financial Transactions ({customerDetails.transactions?.length || 0})
                    </h3>
                    {(!customerDetails.transactions || customerDetails.transactions.length === 0) ? (
                      <div style={{ fontSize: '13px', color: '#64748B' }}>No transaction records found.</div>
                    ) : (
                      <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead style={{ background: '#0F172A', color: '#94A3B8' }}>
                            <tr>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Txn #</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Method</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Paid Amount</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDetails.transactions.slice(0, 10).map((t) => (
                              <tr key={t.id} style={{ borderBottom: '1px solid #334155' }}>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#CBD5E1' }}>{t.transaction_number || t.id.slice(0, 8)}</td>
                                <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{t.payment_method}</td>
                                <td style={{ padding: '8px 12px', fontWeight: '600', color: '#10B981' }}>₹{Number(t.final_paid_amount || 0).toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94A3B8' }}>
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
            <div style={{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedCustomerId(null)}
                style={{
                  background: '#334155',
                  border: 'none',
                  color: '#CBD5E1',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
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
            border: `1px solid ${blockTarget.isBlocked ? '#10B981' : '#EF4444'}`,
            borderRadius: '12px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: blockTarget.isBlocked ? '#6EE7B7' : '#FCA5A5' }}>
              {blockTarget.isBlocked ? `Reactivate Account: ${blockTarget.name}` : `Block Account: ${blockTarget.name}`}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#CBD5E1', lineHeight: '1.5' }}>
              {blockTarget.isBlocked
                ? `Customer (+91 ${blockTarget.mobile_number}) will regain access to create fresh bookings and claim subscription quotas.`
                : `Blocking customer (+91 ${blockTarget.mobile_number}) will immediately reject all new order creation attempts at checkout. Historical booking snapshots and payment records remain preserved.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setBlockTarget(null)}
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
                onClick={handleToggleBlock}
                disabled={actionLoading}
                style={{
                  background: blockTarget.isBlocked ? '#059669' : '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
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
