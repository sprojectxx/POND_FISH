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
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 4px 0' }}>
          Booking Lookup & Search
        </h1>
        <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
          Retrieve customer bookings by Booking Code, Customer Name, or Mobile Number
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by Booking Code (e.g. PF-BK-...), Customer Name, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '16px 16px 16px 50px',
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '12px',
              color: '#F8FAFC',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
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
                background: '#1E293B',
                border: 'none',
                color: '#94A3B8',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
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
            background: '#0284C7',
            border: 'none',
            borderRadius: '12px',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: '800',
            cursor: searching || !searchTerm.trim() ? 'not-allowed' : 'pointer',
            opacity: searching || !searchTerm.trim() ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {searching ? 'Searching...' : 'Search Bookings'}
        </button>
      </form>

      {/* Results Section */}
      <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B', fontWeight: '700', fontSize: '14px', color: '#CBD5E1' }}>
          {hasSearched ? `Search Results (${results.length})` : 'Recent Searches & Direct Lookup'}
        </div>

        {error && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#EF4444', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {!hasSearched && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔎</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F8FAFC', marginBottom: '4px' }}>
              Enter search query above
            </div>
            <div style={{ fontSize: '13px' }}>
              Type a customer name, phone number, or booking reference to retrieve an order.
            </div>
          </div>
        )}

        {hasSearched && !searching && results.length === 0 && !error && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>❌</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F8FAFC', marginBottom: '4px' }}>
              No bookings found matching &quot;{searchTerm}&quot;
            </div>
            <div style={{ fontSize: '13px' }}>
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
                  padding: '16px 20px',
                  borderBottom: '1px solid #1E293B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#F8FAFC' }}>
                      {booking.booking_code}
                    </span>
                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38BDF8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                      }}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>
                    <strong>{booking.customer_name}</strong> • {booking.customer_phone || 'Customer'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    {booking.item_count || 1} items ({booking.total_quantity_kg || 0} kg) • ₹{booking.total_amount}
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/worker/bookings/${booking.id}`)}
                  style={{
                    background: '#0284C7',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
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
