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

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const res = await fetch(`/api/v1/worker/customers?search=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/worker"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#F8FAFC',
              textDecoration: 'none',
              fontSize: '16px',
            }}
          >
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#F8FAFC' }}>
              Customer Lookup & Sales
            </h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              Search customer by phone or name to begin counter bill capture (WP-06)
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Box */}
      <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
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
              background: '#0B1120',
              border: '1px solid #334155',
              borderRadius: '10px',
              color: '#F8FAFC',
              fontSize: '16px',
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
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: '#64748B' }}>
          <span>Tip: Type at least 2 characters to search</span>
          {loading && <span style={{ color: '#38BDF8', fontWeight: '600' }}>Searching customer records...</span>}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '12px', padding: '16px', color: '#EF4444', marginBottom: '24px', fontSize: '14px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results List */}
      <div>
        {customers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Matching Customers ({customers.length})
            </div>

            {customers.map((c) => (
              <div
                key={c.id}
                style={{
                  background: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: c.subscription?.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                      color: c.subscription?.active ? '#22C55E' : '#38BDF8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: '800',
                      flexShrink: 0,
                    }}
                  >
                    {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: '800', color: '#F8FAFC' }}>
                        {c.name}
                      </span>
                      {c.subscription?.active ? (
                        <span
                          style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22C55E',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '0.04em',
                          }}
                        >
                          ★ ACTIVE SUBSCRIBER
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(148, 163, 184, 0.12)',
                            color: '#94A3B8',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        >
                          Standard Customer
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#94A3B8' }}>
                      <span>📱 {c.mobile_number}</span>
                      <span>📍 {c.area || 'In-Store'}</span>
                      {c.subscription?.active && (
                        <span style={{ color: '#22C55E', fontWeight: '700' }}>
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
                      background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
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
              background: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
              No customer found
            </div>
            <p style={{ fontSize: '14px', color: '#94A3B8', maxWidth: '420px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
              No registered customer matched &quot;{searchTerm}&quot;. Please verify the phone number or customer name.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: '#0F172A',
              border: '1px dashed #334155',
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '38px', marginBottom: '12px' }}>👤</div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#F8FAFC', marginBottom: '6px' }}>
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
