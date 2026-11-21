import React from 'react';

/**
 * Admin Route Loading State — displays instant branded animation during page transitions
 * (e.g. switching between Online Bookings, Counter POS Bills, Fish Catalog, etc.)
 */
export default function AdminLoading() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}
    >
      {/* Top Sliding Progress Line */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: '#E2E8F0',
          overflow: 'hidden',
          zIndex: 9999,
        }}
      >
        <div
          className="pf-animate-indeterminate"
          style={{
            width: '40%',
            height: '100%',
            background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Floating Center Card */}
      <div
        style={{
          background: '#FFFFFF',
          padding: '28px 36px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 12px 30px rgba(15, 44, 89, 0.08), 0 2px 8px rgba(15, 44, 89, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          maxWidth: '360px',
          textAlign: 'center',
        }}
      >
        {/* Spinner */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1E56A0"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pf-animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>

        <div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59' }}>
            Loading Admin Section...
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Synchronizing live records from database
          </div>
        </div>
      </div>
    </div>
  );
}
