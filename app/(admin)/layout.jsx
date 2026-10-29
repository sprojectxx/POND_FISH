'use client';

/**
 * Global Admin Shell Layout & Authentication Guard
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 9–11, 23, 174–179)
 * - Slice 13 Scope: Admin Access Control, Security & Session Governance
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './admin.css';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login' || pathname?.startsWith('/admin/login') || pathname === '/login' || pathname?.startsWith('/login');

  const [adminUser, setAdminUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(!isLoginPage);
  const [networkError, setNetworkError] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('pondfish_admin_sidebar_collapsed');
      if (saved === 'true') setSidebarCollapsed(true);
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pondfish_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const verifyAuth = useCallback(async () => {
    if (isLoginPage) {
      setCheckingAuth(false);
      setNetworkError(false);
      setServiceError(null);
      setPermissionError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setCheckingAuth(true);
    setNetworkError(false);
    setServiceError(null);
    setPermissionError(null);

    try {
      const res = await fetch('/api/v1/admin/auth/me', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        signal: controller.signal,
      });

      // 401: Confirmed unauthenticated / expired / revoked session -> redirect to login
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pondfish_admin_user');
          const currentPath = window.location.pathname || '/admin';
          window.location.href = `/admin/login?expired=true&redirect=${encodeURIComponent(currentPath)}`;
        }
        return;
      }

      // 403: Role / permission denial -> show access denied, do NOT redirect-loop to login
      if (res.status === 403) {
        setPermissionError('Administrative privileges required to access this portal.');
        setAdminUser(null);
        return;
      }

      // Handle server/database infrastructure errors (500, 502, 503, etc.) without redirecting or clearing session
      if (!res.ok) {
        let errorMsg = 'Session verification temporarily unavailable. Please retry.';
        try {
          const errJson = await res.json();
          if (errJson?.error?.message) {
            errorMsg = errJson.error.message;
          }
        } catch {}
        console.warn(`[AdminLayout] Server returned status ${res.status}: ${errorMsg}`);
        setServiceError({ status: res.status, message: errorMsg });
        setAdminUser(null);
        return;
      }

      const data = await res.json();
      if (data.success && data.admin) {
        setAdminUser(data.admin);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pondfish_admin_user', JSON.stringify(data.admin));
        }
      } else {
        console.warn('[AdminLayout] Incomplete auth response:', data);
        setServiceError({ status: 200, message: 'Invalid session profile data received.' });
        setAdminUser(null);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('[AdminLayout] Session verification error:', err);
      setNetworkError(true);
      setAdminUser(null);
    } finally {
      if (!controller.signal.aborted) {
        setCheckingAuth(false);
      }
    }
  }, [isLoginPage]);

  // Verify administrative credentials on mount or when navigating to/from login page
  // Does NOT re-verify on every internal route navigation to prevent redundant latency and connection pool spikes
  useEffect(() => {
    verifyAuth();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [verifyAuth]);

  // Handle ESC key and scroll lock for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/admin/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {}

    if (typeof window !== 'undefined') {
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
        background: '#F0F5FA',
        color: '#0F2C59',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#E0F2FE', color: '#1E56A0', marginBottom: '16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>Verifying Administrator Credentials...</div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>Connecting to secure enterprise session</div>
        </div>
      </div>
    );
  }

  // If network connection failed or server is temporarily unavailable during authentication check, display clear retry screen rather than misleading authenticated shell
  if ((networkError || serviceError) && !adminUser) {
    const is503 = serviceError?.status === 503;
    const title = serviceError
      ? (is503 ? 'Service Temporarily Unavailable' : 'Server Connection Issue')
      : 'Connection Failure';
    const message = serviceError
      ? (serviceError.message || 'The database is temporarily busy. Your session is preserved. Please click retry.')
      : 'Unable to verify administrative credentials due to a transient network error. Please check your internet connection and retry.';

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F0F5FA',
        color: '#0F2C59',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(15, 44, 89, 0.08)',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', marginBottom: '16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginBottom: '8px' }}>{title}</div>
          <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', margin: '0 0 24px' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => verifyAuth()}
              style={{
                padding: '10px 20px',
                background: '#1E56A0',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Retry Connection
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 16px',
                background: '#F1F5F9',
                color: '#475569',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
              }}
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If authorization was denied (HTTP 403), display clear permission error rather than redirect loop to login
  if (permissionError && !adminUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F0F5FA',
        color: '#0F2C59',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(15, 44, 89, 0.08)',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#FEF3C7', color: '#D97706', marginBottom: '16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', marginBottom: '8px' }}>Access Denied</div>
          <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', margin: '0 0 24px' }}>
            {permissionError}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                background: '#1E56A0',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sign In with Different Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getNavLinkStyle = (isActive) => ({
    color: isActive ? '#FFFFFF' : '#CBD5E1',
    background: isActive ? '#1E56A0' : 'transparent',
    textDecoration: 'none',
    padding: '9px 12px',
    borderRadius: '8px',
    fontWeight: isActive ? '700' : '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    transition: 'all 0.15s ease',
  });

  const renderNavItems = (onLinkClick) => (
    <>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', margin: '8px 8px 4px', fontWeight: '700' }}>
        Operations
      </div>
      <Link
        href="/admin"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin')}
      >
        Executive Dashboard
      </Link>
      <Link
        id="nav-admin-bookings"
        href="/admin/bookings"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/bookings'))}
      >
        Bookings
      </Link>
      <Link
        id="nav-admin-transactions"
        href="/admin/transactions"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/transactions'))}
      >
        Transactions
      </Link>
      <Link
        id="nav-admin-notifications"
        href="/admin/notifications"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/notifications'))}
      >
        Notifications
      </Link>
      <Link
        href="/admin/journeys"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/journeys'))}
      >
        GPS Truck Journey
      </Link>
      <Link
        href="/admin/settings"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/settings')}
      >
        Business Settings
      </Link>
      <Link
        href="/admin/reports"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/reports' || pathname === '/admin/exports')}
      >
        Reports & Exports
      </Link>

      <div style={{ margin: '14px 0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', paddingLeft: '8px', fontWeight: '700' }}>
        Catalog & Sales
      </div>
      <Link
        id="nav-admin-fish"
        href="/admin/fish"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/fish')}
      >
        Fish Management
      </Link>
      <Link
        id="nav-admin-categories"
        href="/admin/categories"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/categories')}
      >
        Categories
      </Link>
      <Link
        id="nav-admin-discounts"
        href="/admin/discounts"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/discounts')}
      >
        Discounts
      </Link>

      <div style={{ margin: '14px 0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', paddingLeft: '8px', fontWeight: '700' }}>
        Subscriptions
      </div>
      <Link
        id="nav-admin-subscription-plans"
        href="/admin/subscriptions/plans"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/subscriptions/plans')}
      >
        Subscription Plans
      </Link>
      <Link
        id="nav-admin-customer-subscriptions"
        href="/admin/subscriptions"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/subscriptions')}
      >
        Customer Subscriptions
      </Link>

      <div style={{ margin: '14px 0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', paddingLeft: '8px', fontWeight: '700' }}>
        People & Teams
      </div>
      <Link
        id="nav-admin-customers"
        href="/admin/customers"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/customers')}
      >
        Customers
      </Link>
      <Link
        id="nav-admin-workers"
        href="/admin/workers"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/workers')}
      >
        Workers
      </Link>

      <div style={{ margin: '14px 0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', paddingLeft: '8px', fontWeight: '700' }}>
        Governance
      </div>
      <Link
        href="/admin/audit"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/audit' || pathname === '/admin/audit-logs')}
      >
        Audit Trail
      </Link>
      <Link
        href="/admin/exceptions"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/exceptions')}
      >
        Exceptions Center
      </Link>
      <Link
        id="nav-admin-security"
        href="/admin/security"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/security')}
      >
        Admin Security
      </Link>

      <div style={{ margin: '14px 0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', paddingLeft: '8px', fontWeight: '700' }}>
        Account
      </div>
      <Link
        id="nav-admin-profile"
        href="/admin/profile"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/profile')}
      >
        Profile & Identity
      </Link>
      <button
        id="nav-admin-logout"
        onClick={() => {
          if (onLinkClick) onLinkClick();
          handleLogout();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#F87171',
          textAlign: 'left',
          padding: '9px 12px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: '600',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Sign Out</span>
      </button>
    </>
  );

  const renderUserCard = () => (
    <div style={{
      marginTop: 'auto',
      paddingTop: '16px',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1E56A0, #0284C7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        color: '#FFFFFF',
        fontWeight: '800',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
      }}>
        {adminUser?.name?.charAt(0) || 'A'}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {adminUser?.name || 'Administrator'}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {adminUser?.email || 'admin@pondfish.in'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pf-admin-shell">
      {/* Desktop Sidebar Navigation */}
      <aside className={`pf-admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingLeft: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '2px',
            }}>
              <img
                src="/logo.png"
                alt="PondFish"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', letterSpacing: '-0.06em', lineHeight: 1 }}>
              Pond<span style={{ color: '#38BDF8' }}>Fish</span>
            </span>
            <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Admin
            </span>
          </div>

          <button
            type="button"
            className="pf-admin-sidebar-collapse-btn"
            onClick={toggleSidebar}
            title="Minimize Sidebar"
            aria-label="Minimize Sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#CBD5E1', flex: 1, overflowY: 'auto' }}>
          {renderNavItems()}
        </nav>

        {/* User Mini Card at bottom of sidebar */}
        {renderUserCard()}
      </aside>

      {/* Main Content Area */}
      <div className={`pf-admin-content-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Header */}
        <header className="pf-admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Hamburger Button on mobile */}
            <button
              type="button"
              className="pf-admin-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle admin navigation"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F2C59" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Desktop Sidebar Toggle / Minimize Button */}
            <button
              type="button"
              className="pf-admin-desktop-sidebar-toggle"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Expand Sidebar" : "Minimize Sidebar"}
              aria-label={sidebarCollapsed ? "Expand Sidebar" : "Minimize Sidebar"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                {sidebarCollapsed ? (
                  <path d="M13 15l3-3-3-3" />
                ) : (
                  <path d="M16 15l-3-3 3-3" />
                )}
              </svg>
              <span>{sidebarCollapsed ? 'Expand Menu' : 'Minimize'}</span>
            </button>

            {/* Logo on header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '2px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(15, 44, 89, 0.08)'
              }}>
                <img
                  src="/logo.png"
                  alt="PondFish"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#0F2C59', letterSpacing: '-0.06em', lineHeight: 1 }}>
                Pond<span style={{ color: '#2670B7' }}>Fish</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: '800', background: '#E0F2FE', color: '#0369A1', padding: '2px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                Admin
              </span>
            </div>

            <span className="pf-admin-header-subtitle" style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
              | Operations
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="pf-admin-session-badge" style={{
              fontSize: '11px',
              fontWeight: '800',
              color: '#166534',
              background: '#DCFCE7',
              padding: '3px 10px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }}></span>
              ACTIVE
            </span>

            <span className="pf-admin-header-userinfo" style={{ fontSize: '13px', color: '#0F2C59', fontWeight: '600' }}>
              {adminUser ? `${adminUser.name}` : 'Administrator'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#DC2626',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="pf-admin-main">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Backdrop & Drawer mounted to body */}
      {mounted && mobileMenuOpen && createPortal(
        <div className="pf-admin-mobile-overlay" onClick={closeMenu}>
          <div className="pf-admin-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingLeft: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '2px',
                }}>
                  <img
                    src="/logo.png"
                    alt="PondFish"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  Pond<span style={{ color: '#38BDF8' }}>Fish</span>
                </span>
                <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  Admin
                </span>
              </div>
              <button
                type="button"
                className="pf-admin-mobile-close-btn"
                onClick={closeMenu}
                aria-label="Close admin menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#CBD5E1', flex: 1, overflowY: 'auto' }}>
              {renderNavItems(closeMenu)}
            </nav>

            {renderUserCard()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
