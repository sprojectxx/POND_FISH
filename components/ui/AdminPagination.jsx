'use client';

import React, { useState, useEffect } from 'react';
import AdminSelect from './AdminSelect';

/**
 * AdminPagination: Standardized table pagination with direct page jump input and page size selector.
 * Default page size: 25 items per page across all admin dashboard tables.
 */
export default function AdminPagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 25,
  onPageChange,
  onLimitChange,
  itemName = 'records',
  loading = false,
  limitOptions = [25, 50, 100],
}) {
  const [jumpInput, setJumpInput] = useState(String(page));

  useEffect(() => {
    setJumpInput(String(page));
  }, [page]);

  const maxPages = Math.max(1, totalPages || 1);

  const handleJumpCommit = () => {
    const parsed = parseInt(jumpInput, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(parsed, maxPages));
      setJumpInput(String(clamped));
      if (clamped !== page && onPageChange) {
        onPageChange(clamped);
      }
    } else {
      setJumpInput(String(page));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleJumpCommit();
      e.target.blur();
    }
  };

  const startRecord = total > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = total > 0 ? Math.min(page * limit, total) : 0;

  return (
    <div
      className="pf-admin-pagination-bar"
      style={{
        padding: '12px 18px',
        background: '#F8FAFC',
        borderTop: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '12px',
        color: '#64748B',
        overflow: 'visible',
        position: 'relative',
        zIndex: 25,
      }}
    >
      {/* Left: Record summary & Rows per page selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          Showing{' '}
          <strong style={{ color: '#0F2C59', fontWeight: '700' }}>{startRecord}</strong>{' '}
          to{' '}
          <strong style={{ color: '#0F2C59', fontWeight: '700' }}>{endRecord}</strong>{' '}
          of{' '}
          <strong style={{ color: '#0F2C59', fontWeight: '700' }}>{total}</strong>{' '}
          {itemName}
        </div>

        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span style={{ color: '#64748B', fontWeight: '500' }}>Show:</span>
            <AdminSelect
              id="pf-pagination-limit"
              size="sm"
              placement="top"
              value={limit}
              onChange={(newLim) => {
                const parsed = parseInt(newLim, 10);
                if (onLimitChange) onLimitChange(parsed);
              }}
              options={limitOptions.map((opt) => ({
                value: opt,
                label: `${opt} / page`,
              }))}
              disabled={loading}
              style={{ minWidth: '105px' }}
              buttonStyle={{ padding: '3px 8px', fontSize: '12px', fontWeight: '700' }}
            />
          </div>
        )}
      </div>

      {/* Right: Page Navigation & Direct Jump Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: page <= 1 || loading ? '#94A3B8' : '#0F2C59',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 1px 2px rgba(15, 44, 89, 0.03)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Previous</span>
        </button>

        {/* Page Jump Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '600', fontSize: '12px' }}>
          <span>Page</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={jumpInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setJumpInput(val);
            }}
            onBlur={handleJumpCommit}
            onKeyDown={handleKeyDown}
            disabled={loading}
            aria-label="Jump to page number"
            title="Type a page number and press Enter to jump"
            style={{
              width: '48px',
              height: '28px',
              textAlign: 'center',
              fontWeight: '700',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              color: '#0F2C59',
              background: '#FFFFFF',
              outline: 'none',
              padding: '0 4px',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#1E56A0';
              e.target.style.boxShadow = '0 0 0 2px rgba(30, 86, 160, 0.15)';
              e.target.select();
            }}
            onBlurCapture={(e) => {
              e.target.style.borderColor = '#CBD5E1';
              e.target.style.boxShadow = 'none';
            }}
          />
          <span>of {maxPages}</span>
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(page + 1)}
          disabled={page >= maxPages || loading}
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: page >= maxPages || loading ? '#94A3B8' : '#0F2C59',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: page >= maxPages || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 1px 2px rgba(15, 44, 89, 0.03)',
          }}
        >
          <span>Next</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
