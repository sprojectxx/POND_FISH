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
import { getAdminLoginUrl, isPortalSubdomain } from '@/lib/portal-routing';
import './admin.css';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = Boolean(
    pathname === '/admin/login' ||
    pathname?.startsWith('/admin/login') ||
    pathname === '/login' ||
    pathname?.startsWith('/login')
  );

  const [mounted, setMounted] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(!isLoginPage);
  const [networkError, setNetworkError] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    try {
      const cached = localStorage.getItem('pondfish_admin_user');
      if (cached) {
        setAdminUser(JSON.parse(cached));
        setCheckingAuth(false);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const verifyAuth = useCallback(async () => {
    const isLogin = Boolean(
      isLoginPage ||
      (typeof window !== 'undefined' && (
        window.location.pathname === '/login' ||
        window.location.pathname.startsWith('/login') ||
        window.location.pathname === '/admin/login' ||
        window.location.pathname.startsWith('/admin/login')
      ))
    );

    if (isLogin) {
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

    const hasCachedUser = Boolean(adminUser || (typeof window !== 'undefined' && localStorage.getItem('pondfish_admin_user')));
    if (!hasCachedUser) {
      setCheckingAuth(true);
    }
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
          setAdminUser(null);
          setCheckingAuth(false);

          const currentPath = window.location.pathname || '';
          const alreadyOnLogin =
            currentPath === '/login' ||
            currentPath.startsWith('/login') ||
            currentPath === '/admin/login' ||
            currentPath.startsWith('/admin/login');

          // Circuit breaker: NEVER redirect if already on login page to prevent freeze loops
          if (!alreadyOnLogin) {
            const isSub = isPortalSubdomain('admin');
            const targetPath = currentPath || (isSub ? '/' : '/admin');
            window.location.href = getAdminLoginUrl(`expired=true&redirect=${encodeURIComponent(targetPath)}`);
          }
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
      setAdminUser(null);
      setCheckingAuth(false);
      window.location.href = getAdminLoginUrl();
    }
  };

  // If on login page, render without admin shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Also if mounted and window.location is on login page, render children directly
  if (mounted && typeof window !== 'undefined') {
    const curPath = window.location.pathname || '';
    if (
      curPath === '/login' ||
      curPath.startsWith('/login') ||
      curPath === '/admin/login' ||
      curPath.startsWith('/admin/login')
    ) {
      return <>{children}</>;
    }
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
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59', marginBottom: '4px' }}>Loading Dashboard...</div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>Connecting to secure session</div>
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
        Core Operations
      </div>
      <Link
        href="/admin"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>Dashboard</span>
      </Link>
      <Link
        id="nav-admin-bookings"
        href="/admin/bookings"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/bookings') || pathname?.startsWith('/admin/transactions'))}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span>Orders &amp; Sales</span>
      </Link>
      <Link
        id="nav-admin-fish"
        href="/admin/fish"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname === '/admin/fish' || pathname === '/admin/categories' || pathname === '/admin/discounts')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <span>Fish &amp; Inventory</span>
      </Link>
      <Link
        id="nav-admin-journeys"
        href="/admin/journeys"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/journeys'))}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        <span>Live Delivery Truck</span>
      </Link>
      <Link
        id="nav-admin-subscriptions"
        href="/admin/subscriptions"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/subscriptions'))}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <span>Subscriptions</span>
      </Link>

      <div style={{ margin: '14px 0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.4)', paddingLeft: '8px', fontWeight: '700' }}>
        Store Management
      </div>
      <Link
        id="nav-admin-customers"
        href="/admin/customers"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/customers') || pathname?.startsWith('/admin/notifications'))}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Customers &amp; Alerts</span>
      </Link>
      <Link
        id="nav-admin-workers"
        href="/admin/workers"
        onClick={onLinkClick}
        style={getNavLinkStyle(pathname?.startsWith('/admin/workers'))}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <span>Staff &amp; Shifts</span>
      </Link>
      <Link
        id="nav-admin-settings"
        href="/admin/settings"
        onClick={onLinkClick}
        style={getNavLinkStyle(
          pathname === '/admin/settings' ||
          pathname?.startsWith('/admin/reports') ||
          pathname?.startsWith('/admin/exports') ||
          pathname?.startsWith('/admin/audit') ||
          pathname?.startsWith('/admin/exceptions') ||
          pathname?.startsWith('/admin/security') ||
          pathname?.startsWith('/admin/profile')
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span>Store Settings</span>
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
      {/* Invisible hover-sensor on the left screen edge to smoothly reveal sidebar on mouse hover */}
      <div
        className="pf-admin-sidebar-hover-trigger"
        onMouseEnter={() => setSidebarHovered(true)}
      />

      {/* Desktop Sidebar Navigation - Disappearing / Hover-Reveal */}
      <aside
        className={`pf-admin-sidebar ${(sidebarHovered || sidebarOpen) ? 'visible' : ''}`}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
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
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#CBD5E1', flex: 1, overflowY: 'auto' }}>
          {renderNavItems(() => {
            setSidebarHovered(false);
            setSidebarOpen(false);
            setMobileMenuOpen(false);
          })}
        </nav>

        {/* User Mini Card at bottom of sidebar */}
        {renderUserCard()}
      </aside>

      {/* Main Content Area - Always 100% full-width stable layout */}
      <div className="pf-admin-content-wrapper">
        {/* Top Header */}
        <header className="pf-admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Menu Toggle Button (Hover or Click to open navigation) */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              onMouseEnter={() => setSidebarHovered(true)}
              aria-label="Toggle navigation menu"
              title="Navigation Menu"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: (sidebarHovered || sidebarOpen) ? '#0F2C59' : '#FFFFFF',
                color: (sidebarHovered || sidebarOpen) ? '#FFFFFF' : '#0F2C59',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Logo on header - No Admin badge, No | Operations */}
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
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="pf-admin-session-badge" style={{
              fontSize: '11px',
              fontWeight: '800',
              color: '#166534',
              background: '#DCFCE7',
              padding: '4px 10px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }}></span>
              ACTIVE
            </span>

            <button
              onClick={handleLogout}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#DC2626',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
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
