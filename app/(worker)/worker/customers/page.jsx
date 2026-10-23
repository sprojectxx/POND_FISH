'use client';

/**
 * Screen: WP-06 — In-Store Customer Search & Counter Sales Initiation
 * Traceability: PondFish Worker Portal Spec (WP-06) & Master PRD v2 (Section 7)
 * Enables counter staff on tablets to look up walk-in customers by name or 10-digit mobile number,
 * view subscription status and credit balance, and initiate physical bill scanning.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function WorkerCustomerSearchPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length < 2) {
      setCustomers([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/worker/customers?search=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          router.replace('/worker/login');
          return;
        }
        setError(json.error?.message || 'Failed to search customers.');
        return;
      }

      setCustomers(json.data || []);
      setHasSearched(true);
    } catch {
      setError('Network communication failed. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Debounced live search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch(searchTerm);
      } else {
        setCustomers([]);
        setHasSearched(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, performSearch]);

  const handleSelectCustomer = (customer) => {
    const query = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || '',
      phone: customer.mobile_number || '',
      subActive: customer.subscription?.active ? '1' : '0',
      credit: String(customer.subscription?.creditBalance || 0),
      plan: customer.subscription?.planName || '',
    });
    router.push(`/worker/bills/capture?${query.toString()}`);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href="/worker"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              color: '#0F2C59',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '800',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            }}
          >
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 4px 0', color: '#0F2C59', letterSpacing: '-0.02em' }}>
              Customer Lookup & Sales
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
              Search customer by phone or name to begin counter bill capture (WP-06)
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Box */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', marginBottom: '24px', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div style={{ position: 'relative' }}>
          <input
            id="worker-customer-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter customer name or 10-digit mobile number (e.g. 9876543210)..."
            style={{
              width: '100%',
              padding: '16px 20px',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '12px',
              color: '#0F2C59',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#F1F5F9',
                border: 'none',
                color: '#64748B',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: '#64748B' }}>
          <span>Tip: Type at least 2 characters to search</span>
          {loading && <span style={{ color: '#1E56A0', fontWeight: '700' }}>Searching customer records...</span>}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px', color: '#DC2626', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results List */}
      <div>
        {customers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Matching Customers ({customers.length})
            </div>

            {customers.map((c) => (
              <div
                key={c.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: c.subscription?.active ? '#DCFCE7' : '#E0F2FE',
                      color: c.subscription?.active ? '#166534' : '#0369A1',
                      border: c.subscription?.active ? '1px solid #BBF7D0' : '1px solid #BAE6FD',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: '800',
                      flexShrink: 0,
                    }}
                  >
                    {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: '800', color: '#0F2C59' }}>
                        {c.name}
                      </span>
                      {c.subscription?.active ? (
                        <span
                          style={{
                            background: '#DCFCE7',
                            color: '#166534',
                            border: '1px solid #BBF7D0',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '0.04em',
                          }}
                        >
                          ACTIVE SUBSCRIBER
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#F1F5F9',
                            color: '#64748B',
                            border: '1px solid #CBD5E1',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                          }}
                        >
                          Standard Customer
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748B', flexWrap: 'wrap' }}>
                      <span>Phone: {c.mobile_number}</span>
                      <span>Area: {c.area || 'In-Store'}</span>
                      {c.subscription?.active && (
                        <span style={{ color: '#15803D', fontWeight: '700' }}>
                          Credit: ₹{c.subscription.creditBalance.toFixed(2)} ({c.subscription.planName})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    id={`btn-select-customer-${c.id}`}
                    onClick={() => handleSelectCustomer(c)}
                    style={{
                      background: '#1E56A0',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
                    }}
                  >
                    <span>Start Counter Sale</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched && !loading ? (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            }}
          >
            <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '12px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>
              No customer found
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5' }}>
              No registered customer matched &quot;{searchTerm}&quot;. Please verify the phone number or customer name.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '12px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '6px' }}>
              Search for a customer to begin
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
              Enter a customer mobile number or name above to verify subscription eligibility and capture physical store bills.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
