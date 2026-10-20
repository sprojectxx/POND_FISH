'use client';

/**
 * WP-04 — Worker Booking Search Page
 * Traceability: PondFish Worker Portal Spec (Section 12)
 * Fast operational retrieval by Booking Code, Customer Name, or Phone Number.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkerBookingSearchPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setError(null);
    setSearching(true);
    setHasSearched(true);

    const token = localStorage.getItem('pondfish_worker_token');
    if (!token) {
      router.replace('/worker/login');
      return;
    }

    try {
      const res = await fetch(`/api/v1/worker/bookings/search?q=${encodeURIComponent(searchTerm.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Search failed.');
        return;
      }

      setResults(json.data || []);
    } catch {
      setError('Unable to reach server. Check network connection.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0F2C59', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
          Booking Lookup & Search
        </h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
          Retrieve customer bookings by Booking Code, Customer Name, or Mobile Number
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search by Booking Code (e.g. PF-BK-...), Customer Name, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '16px 16px 16px 48px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '12px',
              color: '#0F2C59',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)',
            }}
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setResults([]);
                setHasSearched(false);
              }}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#F1F5F9',
                border: 'none',
                color: '#64748B',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={searching || !searchTerm.trim()}
          style={{
            padding: '16px 28px',
            background: '#1E56A0',
            border: 'none',
            borderRadius: '12px',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: '800',
            cursor: searching || !searchTerm.trim() ? 'not-allowed' : 'pointer',
            opacity: searching || !searchTerm.trim() ? 0.6 : 1,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(30, 86, 160, 0.2)',
          }}
        >
          {searching ? 'Searching...' : 'Search Bookings'}
        </button>
      </form>

      {/* Results Section */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #E2E8F0', fontWeight: '800', fontSize: '14px', color: '#0F2C59', backgroundColor: '#F8FAFC' }}>
          {hasSearched ? `Search Results (${results.length})` : 'Recent Searches & Direct Lookup'}
        </div>

        {error && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#DC2626', fontSize: '14px', backgroundColor: '#FEF2F2' }}>
            {error}
          </div>
        )}

        {!hasSearched && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '12px', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
              Enter search query above
            </div>
            <div style={{ fontSize: '13px', color: '#64748B' }}>
              Type a customer name, phone number, or booking reference to retrieve an order.
            </div>
          </div>
        )}

        {hasSearched && !searching && results.length === 0 && !error && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '12px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>
              No bookings found matching &quot;{searchTerm}&quot;
            </div>
            <div style={{ fontSize: '13px', color: '#64748B' }}>
              Double check the spelling or ask the customer for their digital QR code.
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {results.map((booking) => (
              <div
                key={booking.id}
                style={{
                  padding: '18px 22px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '900', color: '#0F2C59', fontFamily: 'monospace' }}>
                      {booking.booking_code}
                    </span>
                    <span
                      style={{
                        background: '#E0F2FE',
                        color: '#0369A1',
                        border: '1px solid #BAE6FD',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '800',
                      }}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#425B73', marginBottom: '4px' }}>
                    <strong style={{ color: '#0F2C59' }}>{booking.customer_name}</strong> • {booking.customer_phone || 'Customer'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {booking.item_count || 1} items ({booking.total_quantity_kg || 0} kg) • ₹{booking.total_amount}
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/worker/bookings/${booking.id}`)}
                  style={{
                    background: '#1E56A0',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)',
                  }}
                >
                  Open Booking →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
