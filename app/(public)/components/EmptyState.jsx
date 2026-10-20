'use client';

import React from 'react';

export default function EmptyState({
  title = 'No Fish Available',
  message = 'No fish currently match this selection in our live catalogue.',
  actionLabel = 'View All Fish',
  onAction,
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px dashed #cbd5e1',
      maxWidth: '560px',
      margin: '0 auto',
      width: '100%',
      boxShadow: '0 4px 12px rgba(15, 44, 89, 0.04)'
    }}>
      <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f2c59', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
        {message}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: '10px 24px',
            background: '#1e56a0',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'background 0.2s',
            boxShadow: '0 2px 8px rgba(30, 86, 160, 0.2)'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
