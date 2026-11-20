'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSubNav({ tabs = [] }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#FFFFFF',
        padding: '5px 8px',
        borderRadius: '10px',
        border: '1px solid #CBD5E1',
        boxShadow: '0 2px 6px rgba(15, 44, 89, 0.04)',
        marginBottom: '24px',
        overflowX: 'auto',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : (pathname === tab.href || (tab.href !== '/admin' && pathname?.startsWith(tab.href)));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: isActive ? '700' : '600',
              color: isActive ? '#FFFFFF' : '#475569',
              background: isActive ? '#1E56A0' : 'transparent',
              borderRadius: '7px',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
