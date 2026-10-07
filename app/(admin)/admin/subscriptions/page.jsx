'use client';

/**
 * ADMIN-09 — Customer Subscription Management
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 70–78)
 * - PondFish Master PRD v2 (Sections 12, 17)
 */

import React, { useState, useEffect } from 'react';

export default function AdminCustomerSubscriptionsPage() {
  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Available Plans for purchase
  const [availablePlans, setAvailablePlans] = useState([]);

  // Active Tab: 'HISTORY' | 'LEDGER'
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

  // Initial load: fetch plans and recent customers
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
        `/api/v1/admin/subscriptions/customers?search=${encodeURIComponent(queryToSearch || '')}&limit=25`
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.customers || []);
        // Auto-select first customer if none selected
        if (!selectedCustomerId && data.customers && data.customers.length > 0) {
          selectCustomer(data.customers[0].customerId);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error searching customers.');
    } finally {
      setSearching(false);
    }
  };

  const selectCustomer = async (customerId) => {
    setSelectedCustomerId(customerId);
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

  // Open Purchase Modal
  const openPurchaseModal = () => {
    if (!customerDetails) return;
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
          `Subscription added successfully! ₹${selectedPlan.credit_amount} added. New Credit Balance: ₹${data.data.resultingBalance.toFixed(
            2
          )}.`
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

  // Open Credit Adjustment Modal
  const openAdjustModal = () => {
    if (!customerDetails) return;
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

  const selectedPlanObj = availablePlans.find((p) => p.id === selectedPlanId);
  const currentCreditNum = customerDetails?.activeSubscription?.creditBalance || 0;
  const newCreditPreview = selectedPlanObj ? currentCreditNum + parseFloat(selectedPlanObj.credit_amount) : currentCreditNum;

  const adjustAmountNum = parseFloat(adjustAmount) || 0;
  const adjustResultingPreview =
    adjustDirection === 'ADD'
      ? currentCreditNum + adjustAmountNum
      : Math.max(0, currentCreditNum - adjustAmountNum);
  const isAdjustNegative = adjustDirection === 'DEDUCT' && adjustAmountNum > currentCreditNum;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1440px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#F8FAFC' }}>
          👑 Customer Subscription Management
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>
          ADMIN-09 — Customer search, active subscription review, admin-assisted cash & Razorpay purchase, and traceable credit ledger
        </p>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #EF4444',
          color: '#FCA5A5',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid #10B981',
          color: '#6EE7B7',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Main 2-Column Split: Customer Search List (Left) & Customer Subscription Details (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Customer Search & Selection */}
        <div style={{
          background: '#1E293B',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 220px)',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #334155', background: '#0F172A' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Search Customer (Name or Mobile)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="input-customer-search"
                type="text"
                placeholder="e.g. Ramesh or 9876543210"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                id="btn-search-customers"
                onClick={() => handleSearch(searchQuery)}
                style={{
                  background: '#0284C7',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                🔍
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {searching ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                Searching customers...
              </div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                No customers found.
              </div>
            ) : (
              searchResults.map((cust) => {
                const isSelected = selectedCustomerId === cust.customerId;
                return (
                  <div
                    key={cust.customerId}
                    id={`customer-item-${cust.customerId}`}
                    onClick={() => selectCustomer(cust.customerId)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                      border: isSelected ? '1px solid #0284C7' : '1px solid transparent',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', color: isSelected ? '#38BDF8' : '#F8FAFC', fontSize: '14px' }}>
                        {cust.name}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background:
                          cust.status === 'ACTIVE'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : cust.status === 'EXPIRED'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(100, 116, 139, 0.2)',
                        color:
                          cust.status === 'ACTIVE'
                            ? '#10B981'
                            : cust.status === 'EXPIRED'
                            ? '#F59E0B'
                            : '#94A3B8',
                      }}>
                        {cust.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8' }}>
                      <span>📱 {cust.mobileNumber}</span>
                      <span style={{ color: cust.creditBalance > 0 ? '#10B981' : '#94A3B8', fontWeight: '600' }}>
                        ₹{Number(cust.creditBalance).toFixed(0)} credit
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer Details & Subscription Workflows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loadingDetails ? (
            <div style={{ background: '#1E293B', borderRadius: '12px', padding: '80px', textAlign: 'center', color: '#94A3B8', border: '1px solid #334155' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
              <div>Loading Customer Subscription Profile...</div>
            </div>
          ) : !customerDetails ? (
            <div style={{ background: '#1E293B', borderRadius: '12px', padding: '80px', textAlign: 'center', color: '#94A3B8', border: '1px solid #334155' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👈</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#E2E8F0', marginBottom: '4px' }}>
                Select a Customer
              </div>
              <div style={{ fontSize: '13px' }}>
                Choose a customer from the list on the left to view their active plan, balance, and ledger.
              </div>
            </div>
          ) : (
            <>
              {/* Customer Hero Card */}
              <div style={{
                background: '#1E293B',
                borderRadius: '14px',
                border: '1px solid #334155',
                padding: '24px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#F8FAFC' }}>
                        {customerDetails.customer.name}
                      </h2>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        background:
                          customerDetails.activeSubscription?.status === 'ACTIVE'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(100, 116, 139, 0.2)',
                        color:
                          customerDetails.activeSubscription?.status === 'ACTIVE'
                            ? '#10B981'
                            : '#94A3B8',
                      }}>
                        {customerDetails.activeSubscription?.status || 'NO ACTIVE PLAN'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                      📱 {customerDetails.customer.mobileNumber} {customerDetails.customer.area ? `• 📍 ${customerDetails.customer.area}` : ''}
                    </div>
                  </div>

                  {/* Actions: Add Subscription & Adjust Credit */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      id="btn-add-subscription"
                      onClick={openPurchaseModal}
                      style={{
                        background: '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                      }}
                    >
                      <span>➕</span>
                      <span>Add Subscription</span>
                    </button>
                    <button
                      id="btn-adjust-credit"
                      onClick={openAdjustModal}
                      style={{
                        background: '#0F172A',
                        color: '#38BDF8',
                        border: '1px solid #334155',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⚖️</span>
                      <span>Adjust Credit</span>
                    </button>
                  </div>
                </div>

                {/* Subscription Key Metrics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                  {/* Metric 1: Current Subscription Credit */}
                  <div style={{ background: '#0F172A', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', marginBottom: '6px' }}>
                      Current Credit
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>
                      ₹{Number(customerDetails.activeSubscription?.creditBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      Monetary balance
                    </div>
                  </div>

                  {/* Metric 2: Active Plan */}
                  <div style={{ background: '#0F172A', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', marginBottom: '6px' }}>
                      Active Plan
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#38BDF8' }}>
                      {customerDetails.activeSubscription?.planTitle || 'None'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      {customerDetails.activeSubscription?.planPrice ? `₹${customerDetails.activeSubscription.planPrice}` : 'No active tier'}
                    </div>
                  </div>

                  {/* Metric 3: Weekly Quota */}
                  <div style={{ background: '#0F172A', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', marginBottom: '6px' }}>
                      Weekly Allowance
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC' }}>
                      {customerDetails.activeSubscription ? `${customerDetails.activeSubscription.weeklyQtyUsed || 0} / ${customerDetails.activeSubscription.weeklyQtyLimitKg || 0} kg` : '0 kg'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      Used this week
                    </div>
                  </div>

                  {/* Metric 4: Expiry */}
                  <div style={{ background: '#0F172A', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700', marginBottom: '6px' }}>
                      Expiry Date
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#E2E8F0', marginTop: '4px' }}>
                      {customerDetails.activeSubscription?.expiresAt
                        ? new Date(customerDetails.activeSubscription.expiresAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      {customerDetails.activeSubscription?.expiresAt ? 'Valid until end of term' : 'Inactive'}
                    </div>
                  </div>
                </div>

                {/* Secondary Financial Summary Badges */}
                <div style={{ display: 'flex', gap: '20px', marginTop: '16px', borderTop: '1px solid #334155', paddingTop: '14px', fontSize: '12px', color: '#94A3B8' }}>
                  <span>💳 Total Purchased: <strong style={{ color: '#F8FAFC' }}>₹{customerDetails.metrics?.totalPurchasedCredit || 0}</strong></span>
                  <span>📉 Total Used: <strong style={{ color: '#F8FAFC' }}>₹{customerDetails.metrics?.totalUsedCredit || 0}</strong></span>
                  <span>🔄 Total Restored: <strong style={{ color: '#F8FAFC' }}>₹{customerDetails.metrics?.totalRestoredCredit || 0}</strong></span>
                  <span>⚖️ Adjustments: <strong style={{ color: '#F8FAFC' }}>₹{customerDetails.metrics?.totalAdjustedCredit || 0}</strong></span>
                </div>
              </div>

              {/* Sub-Navigation Tabs: History vs Ledger */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '2px' }}>
                <button
                  id="tab-history"
                  onClick={() => handleTabChange('HISTORY')}
                  style={{
                    background: activeTab === 'HISTORY' ? '#0F172A' : 'transparent',
                    color: activeTab === 'HISTORY' ? '#38BDF8' : '#94A3B8',
                    border: '1px solid',
                    borderColor: activeTab === 'HISTORY' ? '#334155' : 'transparent',
                    borderBottomColor: activeTab === 'HISTORY' ? '#0F172A' : 'transparent',
                    padding: '10px 18px',
                    borderRadius: '8px 8px 0 0',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  📜 Purchase & Plan History
                </button>
                <button
                  id="tab-ledger"
                  onClick={() => handleTabChange('LEDGER')}
                  style={{
                    background: activeTab === 'LEDGER' ? '#0F172A' : 'transparent',
                    color: activeTab === 'LEDGER' ? '#38BDF8' : '#94A3B8',
                    border: '1px solid',
                    borderColor: activeTab === 'LEDGER' ? '#334155' : 'transparent',
                    borderBottomColor: activeTab === 'LEDGER' ? '#0F172A' : 'transparent',
                    padding: '10px 18px',
                    borderRadius: '8px 8px 0 0',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  📊 Credit Movement Ledger
                </button>
              </div>

              {/* TAB 1: Subscription History */}
              {activeTab === 'HISTORY' && (
                <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0F172A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                      Subscription Purchase & Activation History
                    </span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {customerDetails.subscriptions?.length || 0} Records
                    </span>
                  </div>

                  {(!customerDetails.subscriptions || customerDetails.subscriptions.length === 0) ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      No subscriptions have been purchased yet for this customer.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#0B1120', borderBottom: '1px solid #334155', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
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
                          <tr key={sub.id} style={{ borderBottom: idx < customerDetails.subscriptions.length - 1 ? '1px solid #334155' : 'none' }}>
                            <td style={{ padding: '14px 18px', color: '#E2E8F0' }}>
                              {new Date(sub.created_at).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td style={{ padding: '14px 18px', fontWeight: '600', color: '#38BDF8' }}>
                              {sub.plan_title || 'Custom Plan'}
                            </td>
                            <td style={{ padding: '14px 18px', color: '#F8FAFC' }}>
                              ₹{Number(sub.plan_price || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '14px 18px', color: '#10B981', fontWeight: '600' }}>
                              ₹{Number(sub.plan_credit_amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '14px 18px', color: '#94A3B8' }}>
                              {new Date(sub.expires_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                background: sub.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                color: sub.status === 'ACTIVE' ? '#10B981' : '#94A3B8',
                              }}>
                                {sub.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 2: Credit Movement Ledger */}
              {activeTab === 'LEDGER' && (
                <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0F172A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                      Authoritative Credit Ledger (Opening, Movement, Closing)
                    </span>
                    <button
                      onClick={() => fetchLedger(selectedCustomerId)}
                      style={{ background: 'none', border: 'none', color: '#38BDF8', fontSize: '12px', cursor: 'pointer' }}
                    >
                      🔄 Refresh Ledger
                    </button>
                  </div>

                  {loadingLedger ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      Loading ledger entries...
                    </div>
                  ) : ledgerEntries.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      No ledger transactions found for this customer.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#0B1120', borderBottom: '1px solid #334155', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase' }}>
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
                            <tr key={entry.id} style={{ borderBottom: idx < ledgerEntries.length - 1 ? '1px solid #334155' : 'none' }}>
                              <td style={{ padding: '14px 16px', color: '#E2E8F0' }}>
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
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background:
                                    entry.type === 'PURCHASE'
                                      ? 'rgba(2, 132, 199, 0.2)'
                                      : entry.type === 'CREDIT_REFUND'
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : entry.type === 'ADJUSTMENT'
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : 'rgba(239, 68, 68, 0.2)',
                                  color:
                                    entry.type === 'PURCHASE'
                                      ? '#38BDF8'
                                      : entry.type === 'CREDIT_REFUND'
                                      ? '#10B981'
                                      : entry.type === 'ADJUSTMENT'
                                      ? '#F59E0B'
                                      : '#EF4444',
                                }}>
                                  {entry.type}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', color: '#94A3B8' }}>
                                {entry.openingBalance !== null ? `₹${entry.openingBalance.toFixed(2)}` : '—'}
                              </td>
                              <td style={{
                                padding: '14px 16px',
                                fontWeight: '700',
                                color: isCredit ? '#10B981' : isDebit ? '#EF4444' : '#F59E0B',
                              }}>
                                {isCredit ? `+₹${entry.amount.toFixed(2)}` : isDebit ? `-₹${entry.amount.toFixed(2)}` : `±₹${entry.amount.toFixed(2)}`}
                              </td>
                              <td style={{ padding: '14px 16px', fontWeight: '700', color: '#F8FAFC' }}>
                                ₹{entry.closingBalance.toFixed(2)}
                              </td>
                              <td style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '12px' }}>
                                {entry.reference}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD SUBSCRIPTION (ADMIN-09 FLOW) */}
      {isPurchaseModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 17, 32, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#1E293B',
            borderRadius: '16px',
            border: '1px solid #334155',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0F172A',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#F8FAFC' }}>
                👑 Add Subscription to Customer
              </h2>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* 1. Customer Summary */}
                <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: '700' }}>
                    Customer
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#F8FAFC', marginTop: '2px' }}>
                    {customerDetails?.customer?.name} ({customerDetails?.customer?.mobileNumber})
                  </div>
                </div>

                {/* 2. Select Plan */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Select Subscription Plan *
                  </label>
                  <select
                    id="select-purchase-plan"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} — ₹{p.price} (Adds ₹{p.credit_amount} Credit, {p.weekly_qty_limit_kg}kg/wk)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Review Authoritative Amount + Credit Summary (Section 73 & 74) */}
                {selectedPlanObj && (
                  <div style={{
                    background: 'rgba(2, 132, 199, 0.08)',
                    border: '1px solid #0284C7',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Authoritative Price:</span>
                      <strong style={{ color: '#F8FAFC' }}>₹{Number(selectedPlanObj.price).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Credit Added:</span>
                      <strong style={{ color: '#10B981' }}>+₹{Number(selectedPlanObj.credit_amount).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(2, 132, 199, 0.2)', paddingTop: '6px' }}>
                      <span style={{ color: '#94A3B8' }}>Existing Credit:</span>
                      <span style={{ color: '#E2E8F0' }}>₹{currentCreditNum.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#38BDF8', fontWeight: '700' }}>New Credit Balance:</span>
                      <strong style={{ color: '#38BDF8', fontSize: '15px' }}>₹{newCreditPreview.toFixed(2)}</strong>
                    </div>
                  </div>
                )}

                {/* 4. Select Payment Source (CASH vs RAZORPAY) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Payment Source *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      id="btn-source-cash"
                      onClick={() => setPaymentSource('CASH')}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: paymentSource === 'CASH' ? '#10B981' : '#334155',
                        background: paymentSource === 'CASH' ? 'rgba(16, 185, 129, 0.15)' : '#0F172A',
                        color: paymentSource === 'CASH' ? '#10B981' : '#94A3B8',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      💵 Cash Payment
                    </button>
                    <button
                      type="button"
                      id="btn-source-razorpay"
                      onClick={() => setPaymentSource('RAZORPAY')}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: paymentSource === 'RAZORPAY' ? '#0284C7' : '#334155',
                        background: paymentSource === 'RAZORPAY' ? 'rgba(2, 132, 199, 0.15)' : '#0F172A',
                        color: paymentSource === 'RAZORPAY' ? '#38BDF8' : '#94A3B8',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      💳 Razorpay Online
                    </button>
                  </div>
                </div>

                {/* Cash Explicit Confirmation */}
                {paymentSource === 'CASH' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid #F59E0B',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        id="checkbox-confirm-cash"
                        type="checkbox"
                        checked={confirmedCash}
                        onChange={(e) => setConfirmedCash(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: '#FDE68A', fontWeight: '500' }}>
                        I explicitly confirm that cash payment of ₹{selectedPlanObj?.price || 0} has been physically collected from the customer.
                      </span>
                    </label>
                  </div>
                )}

                {/* Razorpay Identifiers Input */}
                {paymentSource === 'RAZORPAY' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
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
                          padding: '8px 12px',
                          background: '#0F172A',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#F8FAFC',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
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
                          padding: '8px 12px',
                          background: '#0F172A',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#F8FAFC',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
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
                          padding: '8px 12px',
                          background: '#0F172A',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#F8FAFC',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #334155', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  style={{
                    background: '#0F172A',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
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
                    background: paymentSource === 'CASH' && !confirmedCash ? '#475569' : '#0284C7',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: paymentSource === 'CASH' && !confirmedCash ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                  }}
                >
                  {actionLoading ? 'Processing...' : 'Confirm & Activate Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL CREDIT ADJUSTMENT (SECTION 77 & 78) */}
      {isAdjustModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 17, 32, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#1E293B',
            borderRadius: '16px',
            border: '1px solid #334155',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0F172A',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#F8FAFC' }}>
                ⚖️ Manual Credit Adjustment
              </h2>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* Direction Selector: ADD or DEDUCT */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Adjustment Direction *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      id="btn-adjust-add"
                      onClick={() => setAdjustDirection('ADD')}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: adjustDirection === 'ADD' ? '#10B981' : '#334155',
                        background: adjustDirection === 'ADD' ? 'rgba(16, 185, 129, 0.15)' : '#0F172A',
                        color: adjustDirection === 'ADD' ? '#10B981' : '#94A3B8',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      ➕ Add Credit
                    </button>
                    <button
                      type="button"
                      id="btn-adjust-deduct"
                      onClick={() => setAdjustDirection('DEDUCT')}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: adjustDirection === 'DEDUCT' ? '#EF4444' : '#334155',
                        background: adjustDirection === 'DEDUCT' ? 'rgba(239, 68, 68, 0.15)' : '#0F172A',
                        color: adjustDirection === 'DEDUCT' ? '#EF4444' : '#94A3B8',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      ➖ Deduct Credit
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Amount (₹) *
                  </label>
                  <input
                    id="input-adjust-amount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Mandatory Reason Field */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Reason for Adjustment (Mandatory) *
                  </label>
                  <textarea
                    id="input-adjust-reason"
                    required
                    rows={3}
                    placeholder="e.g. Approved operational correction, gesture of goodwill, manual reconciliation"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>

                {/* Calculation Summary Preview (Section 78) */}
                <div style={{
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Current Credit:</span>
                    <span style={{ color: '#F8FAFC' }}>₹{currentCreditNum.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Adjustment:</span>
                    <strong style={{ color: adjustDirection === 'ADD' ? '#10B981' : '#EF4444' }}>
                      {adjustDirection === 'ADD' ? `+₹${adjustAmountNum.toFixed(2)}` : `-₹${adjustAmountNum.toFixed(2)}`}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '6px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: '700' }}>New Credit Balance:</span>
                    <strong style={{ color: isAdjustNegative ? '#EF4444' : '#38BDF8', fontSize: '15px' }}>
                      ₹{adjustResultingPreview.toFixed(2)}
                    </strong>
                  </div>
                  {isAdjustNegative && (
                    <div style={{ color: '#EF4444', fontSize: '11px', marginTop: '4px' }}>
                      ⚠️ Adjustment would result in a negative credit balance! Reductions cannot exceed current credit.
                    </div>
                  )}
                </div>

                {/* Confirmation Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="checkbox-confirm-adjust"
                    type="checkbox"
                    checked={confirmedAdjust}
                    onChange={(e) => setConfirmedAdjust(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="checkbox-confirm-adjust" style={{ fontSize: '13px', color: '#E2E8F0', cursor: 'pointer' }}>
                    Confirm administrative credit adjustment of {adjustDirection === 'ADD' ? `+₹${adjustAmountNum}` : `-₹${adjustAmountNum}`}
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #334155', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  style={{
                    background: '#0F172A',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-adjust"
                  type="submit"
                  disabled={actionLoading || !confirmedAdjust || isAdjustNegative || !adjustReason.trim() || adjustAmountNum <= 0}
                  style={{
                    background: (!confirmedAdjust || isAdjustNegative || !adjustReason.trim() || adjustAmountNum <= 0) ? '#475569' : '#0284C7',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: (!confirmedAdjust || isAdjustNegative || !adjustReason.trim() || adjustAmountNum <= 0) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Adjusting...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
