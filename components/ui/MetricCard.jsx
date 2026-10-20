'use client';

import React from 'react';

const VARIANT_ACCENTS = {
  primary: { border: '#1E56A0', bg: '#F0F5FA', iconColor: '#1E56A0' },
  success: { border: '#059669', bg: '#ECFDF5', iconColor: '#059669' },
  warning: { border: '#D97706', bg: '#FFFBEB', iconColor: '#D97706' },
  danger: { border: '#DC2626', bg: '#FEF2F2', iconColor: '#DC2626' },
  info: { border: '#0284C7', bg: '#F0F9FF', iconColor: '#0284C7' },
  default: { border: '#CBD5E1', bg: '#F8FAFC', iconColor: '#475569' },
};

/**
 * MetricCard: Premium KPI metric card for administrative & operational dashboards.
 */
export default function MetricCard({
  title,
  value,
  subtext,
  icon,
  trend,
  trendLabel,
  variant = 'default',
  onClick,
  loading = false,
  className = '',
  style = {},
}) {
  const accent = VARIANT_ACCENTS[variant] || VARIANT_ACCENTS.default;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderTop: `3px solid ${accent.border}`,
        borderRadius: '12px',
        padding: '20px 24px',
        boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
      className={className}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59', marginTop: '4px', letterSpacing: '-0.02em', minHeight: '34px' }}>
            {loading ? (
              <span style={{ display: 'inline-block', width: '80px', height: '24px', background: '#E2E8F0', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            ) : (
              value
            )}
          </div>
        </div>

        {icon && (
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: accent.bg,
              color: accent.iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtext || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
          {trend !== undefined && (
            <span
              style={{
                fontWeight: '700',
                color: typeof trend === 'number' && trend >= 0 ? '#059669' : typeof trend === 'number' && trend < 0 ? '#DC2626' : '#1E56A0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {typeof trend === 'number' && trend > 0 ? `+${trend}%` : `${trend}`}
            </span>
          )}
          {trendLabel && <span>{trendLabel}</span>}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
