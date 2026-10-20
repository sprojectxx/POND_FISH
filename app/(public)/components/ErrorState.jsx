'use client';

import React from 'react';

export default function ErrorState({
  title = 'Catalogue Loading Error',
  message = "We couldn't connect to the live fish inventory right now.",
  onRetry,
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      background: '#fff1f2',
      borderRadius: '16px',
      border: '1px solid #fecdd3',
      maxWidth: '560px',
      margin: '0 auto',
      width: '100%',
      boxShadow: '0 4px 12px rgba(225, 29, 72, 0.05)'
    }}>
      <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#be123c', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#9f1239', marginBottom: '24px', lineHeight: '1.6' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '10px 24px',
            background: '#e11d48',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'background 0.2s',
            boxShadow: '0 2px 8px rgba(225, 29, 72, 0.2)'
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
