'use client';

/**
 * Global Admin Shell Layout & Authentication Guard
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 9–11, 23, 174–179)
 * - Slice 13 Scope: Admin Access Control, Security & Session Governance
 */

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  const [adminUser, setAdminUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(!isLoginPage);

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAuth(false);
      return;
    }

    async function verifyAuth() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('pondfish_admin_token') : null;
      if (!token) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(pathname || '/admin')}`;
        return;
      }

      try {
        const res = await fetch('/api/v1/admin/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          localStorage.removeItem('pondfish_admin_token');
          localStorage.removeItem('pondfish_admin_user');
          window.location.href = `/admin/login?expired=true&redirect=${encodeURIComponent(pathname || '/admin')}`;
          return;
        }

        const data = await res.json();
        if (data.success && data.admin) {
          setAdminUser(data.admin);
          localStorage.setItem('pondfish_admin_user', JSON.stringify(data.admin));
        }
      } catch (err) {
        // Fallback to cached user if network glitch
        const cached = localStorage.getItem('pondfish_admin_user');
        if (cached) {
          try { setAdminUser(JSON.parse(cached)); } catch {}
        }
      } finally {
        setCheckingAuth(false);
      }
    }

    verifyAuth();
  }, [pathname, isLoginPage]);

  const handleLogout = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('pondfish_admin_token') : null;
    try {
      if (token) {
        await fetch('/api/v1/admin/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch {}

    if (typeof window !== 'undefined') {
      localStorage.removeItem('pondfish_admin_token');
      localStorage.removeItem('pondfish_admin_user');
      window.location.href = '/admin/login';
    }
  };

  // If on login page, render without admin shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If checking authentication, show loading shell
  if (checkingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B1120',
        color: '#94A3B8',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>Verifying Administrator Credentials...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0B1120', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar Navigation */}
      <aside style={{ width: '260px', background: '#1E293B', borderRight: '1px solid #334155', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
          <span style={{ fontSize: '20px' }}>🐟</span>
          <span style={{ fontSize: '17px', fontWeight: '700', color: '#38BDF8', letterSpacing: '-0.02em' }}>
            PONDFISH ADMIN
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#94A3B8', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', margin: '8px 8px 4px' }}>
            Operations
          </div>
          <a
            href="/admin"
            style={{
              color: pathname === '/admin' ? '#38BDF8' : '#F8FAFC',
              background: pathname === '/admin' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontWeight: pathname === '/admin' ? '600' : '400',
            }}
          >
            📊 Executive Dashboard
          </a>
          <a
            href="/admin/journeys"
            style={{
              color: pathname?.startsWith('/admin/journeys') ? '#38BDF8' : '#94A3B8',
              background: pathname?.startsWith('/admin/journeys') ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            🚛 GPS Truck Journey
          </a>
          <a
            href="/admin/settings"
            style={{
              color: pathname === '/admin/settings' ? '#38BDF8' : '#94A3B8',
              background: pathname === '/admin/settings' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            ⚙️ Business Settings
          </a>
          <a
            href="/admin/reports"
            style={{
              color: pathname === '/admin/reports' || pathname === '/admin/exports' ? '#38BDF8' : '#94A3B8',
              background: pathname === '/admin/reports' || pathname === '/admin/exports' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            📈 Reports & Exports
          </a>

          <div style={{ margin: '14px 0 4px', borderTop: '1px solid #334155', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', paddingLeft: '8px' }}>
            Governance
          </div>
          <a
            href="/admin/audit"
            style={{
              color: pathname === '/admin/audit' || pathname === '/admin/audit-logs' ? '#38BDF8' : '#94A3B8',
              background: pathname === '/admin/audit' || pathname === '/admin/audit-logs' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            📋 Audit Trail
          </a>
          <a
            href="/admin/exceptions"
            style={{
              color: pathname === '/admin/exceptions' ? '#38BDF8' : '#94A3B8',
              background: pathname === '/admin/exceptions' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            ⚠️ Exceptions Center
          </a>
          <a
            id="nav-admin-security"
            href="/admin/security"
            style={{
              color: pathname === '/admin/security' ? '#38BDF8' : '#F8FAFC',
              background: pathname === '/admin/security' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontWeight: pathname === '/admin/security' ? '600' : '400',
            }}
          >
            🛡️ Admin Security
          </a>

          <div style={{ margin: '14px 0 4px', borderTop: '1px solid #334155', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', paddingLeft: '8px' }}>
            Account
          </div>
          <a
            id="nav-admin-profile"
            href="/admin/profile"
            style={{
              color: pathname === '/admin/profile' ? '#38BDF8' : '#F8FAFC',
              background: pathname === '/admin/profile' ? '#0F172A' : 'transparent',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontWeight: pathname === '/admin/profile' ? '600' : '400',
            }}
          >
            👤 Profile & Identity
          </a>
          <button
            id="nav-admin-logout"
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#EF4444',
              textAlign: 'left',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🚪 Sign Out
          </button>
        </nav>

        {/* User Mini Card at bottom of sidebar */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#0284C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#FFFFFF',
            fontWeight: 'bold',
          }}>
            {adminUser?.name?.charAt(0) || 'A'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminUser?.name || 'Administrator'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminUser?.email || 'admin@pondfish.in'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header style={{
          padding: '14px 32px',
          background: '#0F172A',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#64748B' }}>PondFish Enterprise Operations</span>
            <span style={{ fontSize: '11px', color: '#334155' }}>|</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#10B981',
              background: '#064E3B',
              padding: '2px 8px',
              borderRadius: '10px',
            }}>
              ● ACTIVE SESSION
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#CBD5E1' }}>
              {adminUser ? `${adminUser.name} (${adminUser.email})` : 'Administrator'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: '#334155',
                border: 'none',
                color: '#F8FAFC',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
