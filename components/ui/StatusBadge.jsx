'use client';

import React from 'react';

const STATUS_MAP = {
  // Positive / Active / Completed
  ACTIVE: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  COMPLETED: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  DELIVERED: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  RESOLVED: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  VERIFIED: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  SUCCESS: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  FRESH: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },

  // Warnings / Pending / In-Transit
  PENDING: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', dot: '#F59E0B' },
  CONFIRMED: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  IN_TRANSIT: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  WARNING: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', dot: '#F59E0B' },
  PROCESSING: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE', dot: '#8B5CF6' },

  // Negative / Cancelled / Critical / Expired
  CANCELLED: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  FAILED: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  CRITICAL: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  EXPIRED: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', dot: '#64748B' },
  DISABLED: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', dot: '#64748B' },
};

/**
 * StatusBadge: Unified status indicator badge.
 */
export default function StatusBadge({
  status = 'INFO',
  label,
  size = 'md',
  showDot = true,
  className = '',
  style = {},
}) {
  const normalizedKey = String(status).toUpperCase().replace(/[\s-]/g, '_');
  const palette = STATUS_MAP[normalizedKey] || {
    bg: '#F8FAFC',
    text: '#334155',
    border: '#E2E8F0',
    dot: '#64748B',
  };

  const isSmall = size === 'sm';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '4px' : '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        borderRadius: '9999px',
        fontSize: isSmall ? '11px' : '12px',
        fontWeight: '600',
        lineHeight: 1.2,
        backgroundColor: palette.bg,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {showDot && (
        <span
          style={{
            width: isSmall ? '6px' : '7px',
            height: isSmall ? '6px' : '7px',
            borderRadius: '50%',
            backgroundColor: palette.dot,
            flexShrink: 0,
          }}
        />
      )}
      {label || status}
    </span>
  );
}
