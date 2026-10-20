'use client';

import React from 'react';

/**
 * DataTable: Premium responsive table with column configuration, loading state, and empty handling.
 */
export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  emptyMessage = 'No records found.',
  onRowClick,
  className = '',
  style = {},
}) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
      className={className}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '13px',
          fontFamily: 'inherit',
        }}
      >
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: '12px 16px',
                  fontWeight: '700',
                  color: '#475569',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.05em',
                  textAlign: col.align || 'left',
                  width: col.width || 'auto',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '36px',
                  textAlign: 'center',
                  color: '#64748B',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid #CBD5E1',
                      borderTopColor: '#1E56A0',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Loading records...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#94A3B8',
                  fontSize: '14px',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => {
              const rowKey = row[keyField] || rowIdx;
              return (
                <tr
                  key={rowKey}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    borderBottom: rowIdx === data.length - 1 ? 'none' : '1px solid #F1F5F9',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {columns.map((col, colIdx) => {
                    const value = row[col.key];
                    return (
                      <td
                        key={col.key || colIdx}
                        style={{
                          padding: '14px 16px',
                          color: '#1E293B',
                          textAlign: col.align || 'left',
                          verticalAlign: 'middle',
                        }}
                      >
                        {col.render ? col.render(value, row, rowIdx) : value ?? '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
