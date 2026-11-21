'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSubNav({ tabs = [] }) {
  const pathname = usePathname();

  return (
    <div
      className="pf-admin-subnav-container"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#FFFFFF',
        padding: '5px 6px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
        marginBottom: '24px',
        overflowX: 'auto',
        maxWidth: '100%',
        boxSizing: 'border-box',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
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
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: '700',
              color: isActive ? '#FFFFFF' : '#475569',
              background: isActive ? '#1E56A0' : 'transparent',
              borderRadius: '8px',
              textDecoration: 'none',
              boxShadow: isActive ? '0 2px 6px rgba(30, 86, 160, 0.25)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
