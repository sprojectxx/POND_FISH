'use client';

/**
 * ADMIN-09 — Customer Subscription Management & Wallets
 * Full-width horizontal directory layout matching Fish Varieties & Stock standard.
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 70–78)
 * - PondFish Master PRD v2 (Sections 12, 17)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AdminSubNav, AdminSelect, AdminTableSkeleton, AdminPagination } from '@/components/ui';

export default function AdminCustomerSubscriptionsPage() {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'EXPIRED' | 'NONE'
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Selection & Detail Drawer State
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Available Plans for purchase
  const [availablePlans, setAvailablePlans] = useState([]);

  // Active Tab in Drawer: 'HISTORY' | 'LEDGER'
  const [activeTab, setActiveTab] = useState('HISTORY');
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Add Subscription Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentSource, setPaymentSource] = useState('CASH');
  const [confirmedCash, setConfirmedCash] = useState(false);
  const [razorpayDetails, setRazorpayDetails] = useState({
    orderId: '',
    paymentId: '',
    signature: '',
  });

  // Manual Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDirection, setAdjustDirection] = useState('ADD');
  const [adjustReason, setAdjustReason] = useState('');
  const [confirmedAdjust, setConfirmedAdjust] = useState(false);

  // Global Action / Feedback State
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Initial load
  useEffect(() => {
    fetchAvailablePlans();
    handleSearch('');
  }, []);

  const fetchAvailablePlans = async () => {
    try {
      const res = await fetch('/api/v1/admin/subscriptions/plans');
      const data = await res.json();
      if (data.success) {
        setAvailablePlans((data.plans || []).filter((p) => p.active));
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const handleSearch = async (queryToSearch) => {
    try {
      setSearching(true);
      setErrorMsg(null);
      const res = await fetch(
        `/api/v1/admin/subscriptions/customers?search=${encodeURIComponent(queryToSearch || '')}&limit=100`
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.customers || []);
      } else {
        setErrorMsg(data.error?.message || 'Error searching customers.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error searching customers.');
    } finally {
      setSearching(false);
    }
  };

  const selectCustomer = async (customerId, andOpenDrawer = false) => {
    setSelectedCustomerId(customerId);
    if (andOpenDrawer) {
      setIsDrawerOpen(true);
    }
    try {
      setLoadingDetails(true);
      setErrorMsg(null);
      const res = await fetch(`/api/v1/admin/subscriptions/customers/${customerId}`);
      const data = await res.json();
      if (data.success) {
        setCustomerDetails(data.data);
        if (activeTab === 'LEDGER') {
          fetchLedger(customerId);
        }
      } else {
        setErrorMsg(data.error?.message || 'Failed to load customer subscription details.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error fetching customer details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchLedger = async (customerId) => {
    const cid = customerId || selectedCustomerId;
    if (!cid) return;
    try {
      setLoadingLedger(true);
      const res = await fetch(`/api/v1/admin/subscriptions/ledger?customerId=${cid}`);
      const data = await res.json();
      if (data.success) {
        setLedgerEntries(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'LEDGER') {
      fetchLedger(selectedCustomerId);
    }
  };

  // Open Purchase Modal for customer
  const openPurchaseModal = (cust) => {
    const cid = cust?.customerId || selectedCustomerId;
    if (!cid) return;
    setSelectedCustomerId(cid);
    selectCustomer(cid);
    if (availablePlans.length > 0) {
      setSelectedPlanId(availablePlans[0].id);
    }
    setPaymentSource('CASH');
    setConfirmedCash(false);
    setRazorpayDetails({ orderId: '', paymentId: '', signature: '' });
    setIsPurchaseModalOpen(true);
  };

  // Handle Add Subscription Purchase
  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId);
      if (!selectedPlan) throw new Error('Please select a valid subscription plan.');

      if (paymentSource === 'CASH' && !confirmedCash) {
        throw new Error('Please explicitly confirm cash receipt before activating.');
      }

      const payload = {
        customerId: selectedCustomerId,
        planId: selectedPlanId,
        paymentSource,
        confirmedByAdmin: paymentSource === 'CASH' ? confirmedCash : true,
        razorpayOrderId: paymentSource === 'RAZORPAY' ? razorpayDetails.orderId : undefined,
        razorpayPaymentId: paymentSource === 'RAZORPAY' ? razorpayDetails.paymentId : undefined,
        razorpaySignature: paymentSource === 'RAZORPAY' ? razorpayDetails.signature : undefined,
      };

      const res = await fetch('/api/v1/admin/subscriptions/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          `Subscription added successfully! ₹${selectedPlan.credit_amount} credit added. New Credit Balance: ₹${data.data.resultingBalance.toFixed(2)}.`
        );
        setIsPurchaseModalOpen(false);
        selectCustomer(selectedCustomerId);
        handleSearch(searchQuery);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(data.error?.message || 'Subscription purchase failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Submission error.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Credit Adjustment Modal for customer
  const openAdjustModal = (cust) => {
    const cid = cust?.customerId || selectedCustomerId;
    if (!cid) return;
    setSelectedCustomerId(cid);
    selectCustomer(cid);
    setAdjustAmount('');
    setAdjustDirection('ADD');
    setAdjustReason('');
    setConfirmedAdjust(false);
    setIsAdjustModalOpen(true);
  };

  // Handle Credit Adjustment Submit
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const parsed = parseFloat(adjustAmount);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('Adjustment amount must be a positive number greater than 0.');
      }
      if (!adjustReason.trim()) {
        throw new Error('Reason is mandatory for manual credit adjustment.');
      }
      if (!confirmedAdjust) {
        throw new Error('Please confirm the credit adjustment.');
      }

      const payload = {
        customerId: selectedCustomerId,
        amount: parsed,
        direction: adjustDirection,
        reason: adjustReason.trim(),
      };

      const res = await fetch('/api/v1/admin/subscriptions/adjust-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          `Credit adjusted successfully! New balance: ₹${data.data.resultingBalance.toFixed(2)}.`
        );
        setIsAdjustModalOpen(false);
        selectCustomer(selectedCustomerId);
        handleSearch(searchQuery);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(data.error?.message || 'Credit adjustment failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Submission error.');
    } finally {
      setActionLoading(false);
    }
  };

  // Selected customer object for modals
  const selectedCustomerItem = searchResults.find((c) => c.customerId === selectedCustomerId);
  const activeCustomerName = customerDetails?.customer?.name || selectedCustomerItem?.name || 'Customer';
  const activeCustomerMobile = customerDetails?.customer?.mobileNumber || selectedCustomerItem?.mobileNumber || '';
  const currentCreditNum = customerDetails?.activeSubscription?.creditBalance ?? selectedCustomerItem?.creditBalance ?? 0;

  const selectedPlanObj = availablePlans.find((p) => p.id === selectedPlanId);
  const newCreditPreview = selectedPlanObj ? currentCreditNum + parseFloat(selectedPlanObj.credit_amount) : currentCreditNum;

  const adjustAmountNum = parseFloat(adjustAmount) || 0;
  const adjustResultingPreview =
    adjustDirection === 'ADD'
      ? currentCreditNum + adjustAmountNum
      : Math.max(0, currentCreditNum - adjustAmountNum);

  // Client-side Filter
  const filteredCustomers = useMemo(() => {
    return searchResults.filter((c) => {
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? c.status === 'ACTIVE'
          : statusFilter === 'EXPIRED'
          ? c.status === 'EXPIRED'
          : c.status === 'NONE';

      if (!searchQuery.trim()) return matchesStatus;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.mobileNumber && c.mobileNumber.includes(q)) ||
        (c.area && c.area.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [searchResults, statusFilter, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / limit));
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredCustomers.slice(start, start + limit);
  }, [filteredCustomers, page, limit]);

  // Metric counts
  const totalSubscribersCount = useMemo(() => searchResults.length, [searchResults]);
  const activeSubscribersCount = useMemo(() => searchResults.filter((c) => c.status === 'ACTIVE').length, [searchResults]);
  const expiredSubscribersCount = useMemo(() => searchResults.filter((c) => c.status === 'EXPIRED').length, [searchResults]);
  const noPlanSubscribersCount = useMemo(() => searchResults.filter((c) => c.status === 'NONE').length, [searchResults]);
  const totalWalletCreditSum = useMemo(
    () => searchResults.reduce((acc, c) => acc + (Number(c.creditBalance) || 0), 0),
    [searchResults]
  );

  return (
    <div style={{ color: '#0F2C59', maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      <AdminSubNav
        tabs={[
          { label: 'Customer Subscribers & Wallets', href: '/admin/subscriptions', exact: true },
          { label: 'Subscription Plan Packages', href: '/admin/subscriptions/plans' },
        ]}
      />

      {/* Page Header with Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#0F2C59' }}>
            Customer Subscribers &amp; Wallets
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => {
              handleSearch(searchQuery);
              if (selectedCustomerId) selectCustomer(selectedCustomerId);
            }}
            disabled={searching || loadingDetails}
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
              cursor: searching || loadingDetails ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              className={searching ? 'pf-animate-spin' : ''}
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
            <span>{searching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
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

      {/* KPI Highlight Summary Cards */}
      <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>TOTAL CUSTOMERS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#0F2C59', marginTop: '4px' }}>{totalSubscribersCount}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ACTIVE SUBSCRIBERS</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#10B981', marginTop: '4px' }}>{activeSubscribersCount}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>TOTAL WALLET CREDIT</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
            ₹{totalWalletCreditSum.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>EXPIRED / INACTIVE</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#D97706', marginTop: '4px' }}>
            {expiredSubscribersCount + noPlanSubscribersCount}
          </div>
        </div>
      </div>

      {/* Control Bar: Status Filter Pills & Search Input (Matching Fish Varieties standard) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)',
      }}>
        {/* Row 1: Status Filter Pills */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '14px',
          borderBottom: '1px solid #F1F5F9',
          marginBottom: '14px',
        }}>
          {[
            { id: 'ALL', label: `All Customers (${totalSubscribersCount})` },
            { id: 'ACTIVE', label: `Active Plans (${activeSubscribersCount})` },
            { id: 'EXPIRED', label: `Expired (${expiredSubscribersCount})` },
            { id: 'NONE', label: `No Plan (${noPlanSubscribersCount})` },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
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
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Row 2: Search Input & Action Button */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '240px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none', display: 'flex' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by customer name, mobile number, area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
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

          <button
            onClick={() => handleSearch(searchQuery)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: '#1E56A0',
              color: '#FFFFFF',
              border: 'none',
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Customer Table (Horizontal List) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.03)',
        position: 'relative',
      }}>
        {searching && (
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
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px' }}>Mobile Number</th>
                <th style={{ padding: '14px 20px' }}>Active Plan</th>
                <th style={{ padding: '14px 20px' }}>Wallet Credit</th>
                <th style={{ padding: '14px 20px' }}>Weekly Quota</th>
                <th style={{ padding: '14px 20px' }}>Valid Till</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {searching ? (
                <AdminTableSkeleton columns={8} rows={5} />
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '64px 20px', textAlign: 'center', color: '#64748B' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px' }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
                      No Customers Found
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      {searchQuery ? 'Try clearing your search keyword.' : 'No customer records match the selected status filter.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((cust, idx) => {
                  const isSelected = selectedCustomerId === cust.customerId && isDrawerOpen;
                  const initials = (cust.name || 'CU')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={cust.customerId}
                      id={`customer-row-${cust.customerId}`}
                      onClick={() => selectCustomer(cust.customerId, true)}
                      style={{
                        borderBottom: idx < filteredCustomers.length - 1 ? '1px solid #F1F5F9' : 'none',
                        background: isSelected ? '#F0F7FF' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
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
                              {cust.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {cust.area || 'Counter Customer'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Mobile */}
                      <td style={{ padding: '16px 20px', fontWeight: '600', color: '#0F2C59' }}>
                        {cust.mobileNumber}
                      </td>

                      {/* Active Plan */}
                      <td style={{ padding: '16px 20px' }}>
                        {cust.planTitle ? (
                          <div>
                            <span style={{
                              fontWeight: '800',
                              color: '#1E56A0',
                              fontSize: '13px',
                            }}>
                              {cust.planTitle}
                            </span>
                            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                              ₹{Number(cust.planPrice || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12.5px' }}>No Active Plan</span>
                        )}
                      </td>

                      {/* Wallet Balance */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: cust.creditBalance > 0 ? '#ECFDF5' : '#F8FAFC',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: cust.creditBalance > 0 ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                        }}>
                          <span style={{
                            fontWeight: '800',
                            color: cust.creditBalance > 0 ? '#059669' : '#64748B',
                            fontSize: '14px',
                          }}>
                            ₹{Number(cust.creditBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </td>

                      {/* Weekly Quota */}
                      <td style={{ padding: '16px 20px', color: '#0F2C59', fontWeight: '600' }}>
                        {cust.hasSubscription ? (
                          <span>
                            {cust.weeklyQtyUsed || 0} / {cust.weeklyQtyLimitKg || 0} kg
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td style={{ padding: '16px 20px', color: '#64748B', fontSize: '12.5px' }}>
                        {cust.expiresAt ? (
                          new Date(cust.expiresAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 9px',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background:
                            cust.status === 'ACTIVE'
                              ? '#ECFDF5'
                              : cust.status === 'EXPIRED'
                              ? '#FEF3C7'
                              : '#F1F5F9',
                          color:
                            cust.status === 'ACTIVE'
                              ? '#065F46'
                              : cust.status === 'EXPIRED'
                              ? '#B45309'
                              : '#334155',
                          border: `1px solid ${
                            cust.status === 'ACTIVE'
                              ? '#A7F3D0'
                              : cust.status === 'EXPIRED'
                              ? '#FDE68A'
                              : '#CBD5E1'
                          }`,
                        }}>
                          {cust.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            id={`btn-row-add-plan-${cust.customerId}`}
                            onClick={() => openPurchaseModal(cust)}
                            title="Add Subscription Plan"
                            style={{
                              background: '#1E56A0',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 3px rgba(30, 86, 160, 0.2)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>Plan</span>
                          </button>

                          <button
                            id={`btn-row-adjust-credit-${cust.customerId}`}
                            onClick={() => openAdjustModal(cust)}
                            title="Adjust Wallet Credit"
                            style={{
                              background: '#FFFFFF',
                              color: '#0F2C59',
                              border: '1px solid #CBD5E1',
                              padding: '6px 11px',
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 2px rgba(15, 44, 89, 0.04)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            <span>Credit</span>
                          </button>

                          <button
                            id={`btn-row-details-${cust.customerId}`}
                            onClick={() => selectCustomer(cust.customerId, true)}
                            title="View Customer Report & Ledger"
                            style={{
                              background: '#F8FAFC',
                              color: '#1E56A0',
                              border: '1px solid #CBD5E1',
                              padding: '6px 11px',
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
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                              <polyline points="10 9 9 9 8 9"/>
                            </svg>
                            <span>Report</span>
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

        {/* Pagination Bar */}
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
          loading={searching}
          limitOptions={[10, 25, 50, 100]}
        />
      </div>

      {/* Slide-Over Drawer: Customer Subscription Profile, History & Ledger */}
      {isDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 44, 89, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 900,
        }}>
          <div style={{
            background: '#FFFFFF',
            width: '100%',
            maxWidth: '820px',
            height: '100%',
            overflowY: 'auto',
            boxShadow: '-8px 0 32px rgba(15, 44, 89, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease',
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                    {activeCustomerName}
                  </h2>
                  {customerDetails?.activeSubscription && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background:
                        customerDetails.activeSubscription.status === 'ACTIVE'
                          ? '#ECFDF5'
                          : '#F1F5F9',
                      color:
                        customerDetails.activeSubscription.status === 'ACTIVE'
                          ? '#065F46'
                          : '#334155',
                      border: `1px solid ${
                        customerDetails.activeSubscription.status === 'ACTIVE'
                          ? '#A7F3D0'
                          : '#CBD5E1'
                      }`,
                    }}>
                      {customerDetails.activeSubscription.status}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                  {activeCustomerMobile} {customerDetails?.customer?.area ? `• ${customerDetails.customer.area}` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => openPurchaseModal({ customerId: selectedCustomerId })}
                  style={{
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '7px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>Add Plan</span>
                </button>

                <button
                  onClick={() => openAdjustModal({ customerId: selectedCustomerId })}
                  style={{
                    background: '#FFFFFF',
                    color: '#0F2C59',
                    border: '1px solid #CBD5E1',
                    padding: '8px 12px',
                    borderRadius: '7px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <span>Adjust Credit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close drawer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#64748B',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: '1',
                    marginLeft: '6px',
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              {loadingDetails ? (
                <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #E2E8F0',
                    borderTopColor: '#1E56A0',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 14px',
                  }} />
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>Loading Customer Subscription Details...</div>
                </div>
              ) : customerDetails ? (
                <>
                  {/* Hero Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: '800', letterSpacing: '0.04em', marginBottom: '6px' }}>
                        Current Credit
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>
                        ₹{Number(customerDetails.activeSubscription?.creditBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                        Wallet balance
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: '800', letterSpacing: '0.04em', marginBottom: '6px' }}>
                        Active Plan
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#1E56A0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customerDetails.activeSubscription?.planTitle || 'None'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                        {customerDetails.activeSubscription?.planPrice ? `₹${customerDetails.activeSubscription.planPrice}` : 'No active tier'}
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: '800', letterSpacing: '0.04em', marginBottom: '6px' }}>
                        Weekly Allowance
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59' }}>
                        {customerDetails.activeSubscription ? `${customerDetails.activeSubscription.weeklyQtyUsed || 0} / ${customerDetails.activeSubscription.weeklyQtyLimitKg || 0} kg` : '0 kg'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                        Used this week
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: '800', letterSpacing: '0.04em', marginBottom: '6px' }}>
                        Expiry Date
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F2C59', marginTop: '4px' }}>
                        {customerDetails.activeSubscription?.expiresAt
                          ? new Date(customerDetails.activeSubscription.expiresAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                        {customerDetails.activeSubscription?.expiresAt ? 'Valid until term end' : 'Inactive'}
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '12px 0', fontSize: '12.5px', color: '#64748B', flexWrap: 'wrap' }}>
                    <span>Total Purchased: <strong style={{ color: '#0F2C59' }}>₹{customerDetails.metrics?.totalPurchasedCredit || 0}</strong></span>
                    <span>Total Used: <strong style={{ color: '#0F2C59' }}>₹{customerDetails.metrics?.totalUsedCredit || 0}</strong></span>
                    <span>Total Restored: <strong style={{ color: '#0F2C59' }}>₹{customerDetails.metrics?.totalRestoredCredit || 0}</strong></span>
                    <span>Adjustments: <strong style={{ color: '#0F2C59' }}>₹{customerDetails.metrics?.totalAdjustedCredit || 0}</strong></span>
                  </div>

                  {/* Sub-Navigation Tabs */}
                  <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0' }}>
                    <button
                      id="drawer-tab-history"
                      onClick={() => handleTabChange('HISTORY')}
                      style={{
                        background: activeTab === 'HISTORY' ? '#1E56A0' : 'transparent',
                        color: activeTab === 'HISTORY' ? '#FFFFFF' : '#64748B',
                        border: 'none',
                        padding: '9px 18px',
                        borderRadius: '8px 8px 0 0',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Purchase &amp; Plan History
                    </button>
                    <button
                      id="drawer-tab-ledger"
                      onClick={() => handleTabChange('LEDGER')}
                      style={{
                        background: activeTab === 'LEDGER' ? '#1E56A0' : 'transparent',
                        color: activeTab === 'LEDGER' ? '#FFFFFF' : '#64748B',
                        border: 'none',
                        padding: '9px 18px',
                        borderRadius: '8px 8px 0 0',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Wallet &amp; Credits Ledger
                    </button>
                  </div>

                  {/* TAB 1: Subscription History */}
                  {activeTab === 'HISTORY' && (
                    <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F2C59' }}>
                          Subscription Purchase History
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                          {customerDetails.subscriptions?.length || 0} Records
                        </span>
                      </div>

                      {(!customerDetails.subscriptions || customerDetails.subscriptions.length === 0) ? (
                        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                          No subscriptions recorded for this customer yet.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '800' }}>
                                <th style={{ padding: '12px 18px' }}>Created Date</th>
                                <th style={{ padding: '12px 18px' }}>Plan</th>
                                <th style={{ padding: '12px 18px' }}>Price</th>
                                <th style={{ padding: '12px 18px' }}>Credit Added</th>
                                <th style={{ padding: '12px 18px' }}>Expiry</th>
                                <th style={{ padding: '12px 18px' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerDetails.subscriptions.map((sub, idx) => (
                                <tr
                                  key={sub.id}
                                  style={{
                                    borderBottom: idx < customerDetails.subscriptions.length - 1 ? '1px solid #F1F5F9' : 'none',
                                  }}
                                >
                                  <td style={{ padding: '14px 18px', color: '#0F2C59' }}>
                                    {new Date(sub.created_at).toLocaleString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                  <td style={{ padding: '14px 18px', fontWeight: '700', color: '#1E56A0' }}>
                                    {sub.plan_title || 'Custom Plan'}
                                  </td>
                                  <td style={{ padding: '14px 18px', color: '#0F2C59', fontWeight: '700' }}>
                                    ₹{Number(sub.plan_price || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ padding: '14px 18px', color: '#059669', fontWeight: '800' }}>
                                    ₹{Number(sub.plan_credit_amount || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ padding: '14px 18px', color: '#64748B' }}>
                                    {new Date(sub.expires_at).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </td>
                                  <td style={{ padding: '14px 18px' }}>
                                    <span style={{
                                      padding: '3px 8px',
                                      borderRadius: '20px',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      background: sub.status === 'ACTIVE' ? '#ECFDF5' : '#F1F5F9',
                                      color: sub.status === 'ACTIVE' ? '#065F46' : '#334155',
                                      border: `1px solid ${sub.status === 'ACTIVE' ? '#A7F3D0' : '#CBD5E1'}`,
                                    }}>
                                      {sub.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Credit Movement Ledger */}
                  {activeTab === 'LEDGER' && (
                    <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F2C59' }}>
                          Wallet &amp; Credits Ledger
                        </span>
                        <button
                          onClick={() => fetchLedger(selectedCustomerId)}
                          disabled={loadingLedger}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            color: '#0F2C59',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: loadingLedger ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <svg
                            className={loadingLedger ? 'pf-animate-spin' : ''}
                            width="12"
                            height="12"
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
                          <span>{loadingLedger ? 'Refreshing...' : 'Refresh Ledger'}</span>
                        </button>
                      </div>

                      {loadingLedger ? (
                        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            border: '2.5px solid #E2E8F0',
                            borderTopColor: '#1E56A0',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 10px',
                          }} />
                          Loading ledger transactions...
                        </div>
                      ) : ledgerEntries.length === 0 ? (
                        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                          No ledger transactions found for this customer.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '800' }}>
                                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                                <th style={{ padding: '12px 16px' }}>Movement Type</th>
                                <th style={{ padding: '12px 16px' }}>Opening</th>
                                <th style={{ padding: '12px 16px' }}>Movement</th>
                                <th style={{ padding: '12px 16px' }}>Closing Balance</th>
                                <th style={{ padding: '12px 16px' }}>Reference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ledgerEntries.map((entry, idx) => {
                                const isCredit = entry.type === 'PURCHASE' || entry.type === 'CREDIT_REFUND';
                                const isDebit = entry.type === 'DEBIT_BOOKING' || entry.type === 'DEBIT_BILL';
                                return (
                                  <tr
                                    key={entry.id}
                                    style={{
                                      borderBottom: idx < ledgerEntries.length - 1 ? '1px solid #F1F5F9' : 'none',
                                    }}
                                  >
                                    <td style={{ padding: '14px 16px', color: '#0F2C59' }}>
                                      {new Date(entry.createdAt).toLocaleString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span style={{
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        background:
                                          entry.type === 'PURCHASE'
                                            ? '#EFF6FF'
                                            : entry.type === 'CREDIT_REFUND'
                                            ? '#ECFDF5'
                                            : entry.type === 'ADJUSTMENT'
                                            ? '#FEF3C7'
                                            : '#FEF2F2',
                                        color:
                                          entry.type === 'PURCHASE'
                                            ? '#1E56A0'
                                            : entry.type === 'CREDIT_REFUND'
                                            ? '#065F46'
                                            : entry.type === 'ADJUSTMENT'
                                            ? '#B45309'
                                            : '#991B1B',
                                        border: `1px solid ${
                                          entry.type === 'PURCHASE'
                                            ? '#BFDBFE'
                                            : entry.type === 'CREDIT_REFUND'
                                            ? '#A7F3D0'
                                            : entry.type === 'ADJUSTMENT'
                                            ? '#FDE68A'
                                            : '#FECACA'
                                        }`,
                                      }}>
                                        {entry.type}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', color: '#64748B' }}>
                                      {entry.openingBalance !== null ? `₹${Number(entry.openingBalance).toFixed(2)}` : '—'}
                                    </td>
                                    <td style={{
                                      padding: '14px 16px',
                                      fontWeight: '800',
                                      color: isCredit ? '#059669' : isDebit ? '#DC2626' : '#B45309',
                                    }}>
                                      {isCredit ? `+₹${Number(entry.amount).toFixed(2)}` : isDebit ? `-₹${Number(entry.amount).toFixed(2)}` : `±₹${Number(entry.amount).toFixed(2)}`}
                                    </td>
                                    <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0F2C59' }}>
                                      ₹{Number(entry.closingBalance).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '14px 16px', color: '#64748B', fontSize: '12px' }}>
                                      {entry.reference}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD SUBSCRIPTION (ADMIN-09 FLOW) */}
      {isPurchaseModalOpen && (
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
            maxWidth: '560px',
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
                Add Subscription to Customer
              </h2>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
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
                  fontSize: '24px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 1. Customer Summary */}
                <div style={{ background: '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: '800', letterSpacing: '0.04em' }}>
                    Customer
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F2C59', marginTop: '2px' }}>
                    {activeCustomerName} {activeCustomerMobile ? `(${activeCustomerMobile})` : ''}
                  </div>
                </div>

                {/* 2. Select Plan */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Subscription Plan *
                  </label>
                  <AdminSelect
                    id="select-purchase-plan"
                    value={selectedPlanId}
                    onChange={(val) => setSelectedPlanId(val)}
                    options={availablePlans.map((p) => ({
                      value: p.id,
                      label: `${p.title} — ₹${p.price} (Adds ₹${p.credit_amount} Credit, ${p.weekly_qty_limit_kg}kg/wk)`,
                    }))}
                    placeholder="Choose a subscription plan..."
                    style={{ width: '100%' }}
                  />
                </div>

                {/* 3. Review Authoritative Amount + Credit Summary */}
                {selectedPlanObj && (
                  <div style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Authoritative Price:</span>
                      <strong style={{ color: '#0F2C59' }}>₹{Number(selectedPlanObj.price).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Credit Added:</span>
                      <strong style={{ color: '#059669' }}>+₹{Number(selectedPlanObj.credit_amount).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #DBEAFE', paddingTop: '6px' }}>
                      <span style={{ color: '#64748B' }}>Existing Credit:</span>
                      <span style={{ color: '#0F2C59' }}>₹{Number(currentCreditNum).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#1E56A0', fontWeight: '800' }}>New Credit Balance:</span>
                      <strong style={{ color: '#1E56A0', fontSize: '15px' }}>₹{Number(newCreditPreview).toFixed(2)}</strong>
                    </div>
                  </div>
                )}

                {/* 4. Select Payment Source (CASH vs RAZORPAY) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Payment Source *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      id="btn-source-cash"
                      onClick={() => setPaymentSource('CASH')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: paymentSource === 'CASH' ? '#10B981' : '#E2E8F0',
                        background: paymentSource === 'CASH' ? '#ECFDF5' : '#F8FAFC',
                        color: paymentSource === 'CASH' ? '#065F46' : '#64748B',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Cash Payment
                    </button>
                    <button
                      type="button"
                      id="btn-source-razorpay"
                      onClick={() => setPaymentSource('RAZORPAY')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: paymentSource === 'RAZORPAY' ? '#1E56A0' : '#E2E8F0',
                        background: paymentSource === 'RAZORPAY' ? '#EFF6FF' : '#F8FAFC',
                        color: paymentSource === 'RAZORPAY' ? '#1E56A0' : '#64748B',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Razorpay Online
                    </button>
                  </div>
                </div>

                {/* Cash Explicit Confirmation */}
                {paymentSource === 'CASH' && (
                  <div style={{
                    background: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    borderRadius: '10px',
                    padding: '14px',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        id="checkbox-confirm-cash"
                        type="checkbox"
                        checked={confirmedCash}
                        onChange={(e) => setConfirmedCash(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1E56A0' }}
                      />
                      <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
                        I confirm that cash payment of ₹{selectedPlanObj?.price || 0} has been physically collected from the customer.
                      </span>
                    </label>
                  </div>
                )}

                {/* Razorpay Identifiers Input */}
                {paymentSource === 'RAZORPAY' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Razorpay Order ID *
                      </label>
                      <input
                        id="input-rzp-order"
                        type="text"
                        placeholder="order_xxxxxxxxxxxxx"
                        value={razorpayDetails.orderId}
                        onChange={(e) => setRazorpayDetails({ ...razorpayDetails, orderId: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          color: '#0F2C59',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Razorpay Payment ID *
                      </label>
                      <input
                        id="input-rzp-payment"
                        type="text"
                        placeholder="pay_xxxxxxxxxxxxx"
                        value={razorpayDetails.paymentId}
                        onChange={(e) => setRazorpayDetails({ ...razorpayDetails, paymentId: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          color: '#0F2C59',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Razorpay Signature *
                      </label>
                      <input
                        id="input-rzp-sig"
                        type="text"
                        placeholder="Hex HMAC signature"
                        value={razorpayDetails.signature}
                        onChange={(e) => setRazorpayDetails({ ...razorpayDetails, signature: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          color: '#0F2C59',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
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
                  id="btn-confirm-purchase"
                  type="submit"
                  disabled={actionLoading || (paymentSource === 'CASH' && !confirmedCash)}
                  style={{
                    background: paymentSource === 'CASH' && !confirmedCash ? '#94A3B8' : '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: paymentSource === 'CASH' && !confirmedCash ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {actionLoading ? 'Processing...' : 'Confirm & Activate Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL CREDIT ADJUSTMENT */}
      {isAdjustModalOpen && (
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
            maxWidth: '520px',
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
                Manual Credit Adjustment
              </h2>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
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
                  fontSize: '24px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 1. Customer Context */}
                <div style={{ background: '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: '800', letterSpacing: '0.04em' }}>
                    Customer
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F2C59', marginTop: '2px' }}>
                    {activeCustomerName} ({activeCustomerMobile})
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700', marginTop: '4px' }}>
                    Current Balance: ₹{Number(currentCreditNum).toFixed(2)}
                  </div>
                </div>

                {/* 2. Adjustment Direction: ADD vs DEDUCT */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Adjustment Direction *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      id="btn-adjust-add"
                      onClick={() => setAdjustDirection('ADD')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: adjustDirection === 'ADD' ? '#10B981' : '#E2E8F0',
                        background: adjustDirection === 'ADD' ? '#ECFDF5' : '#F8FAFC',
                        color: adjustDirection === 'ADD' ? '#065F46' : '#64748B',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      + Add Credit
                    </button>
                    <button
                      type="button"
                      id="btn-adjust-deduct"
                      onClick={() => setAdjustDirection('DEDUCT')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: adjustDirection === 'DEDUCT' ? '#EF4444' : '#E2E8F0',
                        background: adjustDirection === 'DEDUCT' ? '#FEF2F2' : '#F8FAFC',
                        color: adjustDirection === 'DEDUCT' ? '#991B1B' : '#64748B',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      - Deduct Credit
                    </button>
                  </div>
                </div>

                {/* 3. Adjustment Amount */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Adjustment Amount (₹) *
                  </label>
                  <input
                    id="input-adjust-amount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 500"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      color: '#0F2C59',
                      fontSize: '14px',
                      fontWeight: '700',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Resulting Balance Preview */}
                {adjustAmountNum > 0 && (
                  <div style={{
                    background: '#F8FAFC',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}>
                    <span style={{ color: '#64748B' }}>Resulting Balance:</span>
                    <strong style={{ color: '#0F2C59' }}>₹{adjustResultingPreview.toFixed(2)}</strong>
                  </div>
                )}

                {/* 4. Mandatory Reason */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Reason for Adjustment (Mandatory) *
                  </label>
                  <textarea
                    id="input-adjust-reason"
                    rows={3}
                    placeholder="e.g. Customer compensation for damaged catch, counter promo waiver, etc."
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      color: '#0F2C59',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* 5. Explicit Confirmation */}
                <div style={{
                  background: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  borderRadius: '10px',
                  padding: '14px',
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      id="checkbox-confirm-adjust"
                      type="checkbox"
                      checked={confirmedAdjust}
                      onChange={(e) => setConfirmedAdjust(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1E56A0' }}
                    />
                    <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
                      I understand this action modifies customer monetary credit and will be authoritatively recorded on the ledger.
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
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
                  id="btn-confirm-adjust"
                  type="submit"
                  disabled={actionLoading || !confirmedAdjust || adjustAmountNum <= 0 || !adjustReason.trim()}
                  style={{
                    background:
                      !confirmedAdjust || adjustAmountNum <= 0 || !adjustReason.trim()
                        ? '#94A3B8'
                        : '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor:
                      !confirmedAdjust || adjustAmountNum <= 0 || !adjustReason.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {actionLoading ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
