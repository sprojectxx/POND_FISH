'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log safe error locally without exposing credentials or internal traces to user
    console.error('[PONDFISH SYSTEM ERROR]', error?.message || error);
  }, [error]);

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '520px',
        background: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '48px 32px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(220, 38, 38, 0.15)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '32px'
        }}>
          ⚠️
        </div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          500 — System Notice
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#F8FAFC', marginBottom: '12px' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '32px' }}>
          We encountered an unexpected issue while loading this page. Our technical team has been notified.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '12px 24px',
              background: '#0284C7',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
          <Link
            href="/"
            style={{
              padding: '12px 24px',
              background: '#1E293B',
              color: '#F8FAFC',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              textDecoration: 'none',
              border: '1px solid #334155'
            }}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
