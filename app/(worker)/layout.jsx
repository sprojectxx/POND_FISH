'use client';

/**
 * Worker Tablet & Mobile Portal Shell Layout
 * Traceability: PondFish Worker Portal Spec (Sections 5, 6, WP-01, WP-02)
 * Mobile-first responsive navigation, session monitoring, mobile drawer, and operational header.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import './worker.css';

export default function WorkerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [worker, setWorker] = useState(null);
  const [cachedProfile, setCachedProfile] = useState(null);
  const [sessionState, setSessionState] = useState('VERIFYING'); // 'VERIFYING' | 'AUTHENTICATED' | 'OFFLINE' | 'UNAUTHENTICATED'
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoginPage = pathname === '/worker/login' || pathname?.startsWith('/worker/login') || pathname === '/login' || pathname?.startsWith('/login');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    // Load cached profile display metadata only (never establishes authenticated session)
    const cached = typeof window !== 'undefined' ? localStorage.getItem('pondfish_worker_info') : null;
    if (cached) {
      try {
        setCachedProfile(JSON.parse(cached));
      } catch {}
    }

    // Purge any legacy token from browser storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pondfish_worker_token');
    }

    // Verify session with backend via secure HttpOnly cookie
    fetch('/api/v1/worker/auth/me', {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            // Explicit server authentication rejection:
            // Purge cached metadata and redirect to login
            localStorage.removeItem('pondfish_worker_token');
            localStorage.removeItem('pondfish_worker_info');
            setWorker(null);
            setCachedProfile(null);
            setSessionState('UNAUTHENTICATED');
            router.replace('/worker/login');
            return null;
          }
          // Server error (e.g. 500, 503)
          setWorker(null);
          setSessionState('OFFLINE');
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json && json.success && json.data?.worker) {
          setWorker(json.data.worker);
          setCachedProfile(json.data.worker);
          setSessionState('AUTHENTICATED');
          localStorage.setItem('pondfish_worker_info', JSON.stringify(json.data.worker));
        } else if (json) {
          setWorker(null);
          setSessionState('UNAUTHENTICATED');
          router.replace('/worker/login');
        }
      })
      .catch((err) => {
        // Transient network issue: preserve cached metadata for display without treating as verified
        console.warn('[WorkerLayout] Network issue during session verification:', err.message);
        setSessionState('OFFLINE');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isLoginPage, router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const res = await fetch('/api/v1/worker/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      const json = await res.json().catch(() => ({}));

      // Distinguish confirmed server-side revocation from failed logout
      if (!res.ok || !json.success) {
        // If session was already expired or revoked at route level (401/403), treat as terminated
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          setWorker(null);
          setCachedProfile(null);
          setSessionState('UNAUTHENTICATED');
          window.location.href = '/worker/login';
          return;
        }

        // Server-side revocation failed (e.g. 500 error):
        // Never report logout as successfully revoked when the server returned an error.
        // Keep authenticated session state and credentials intact to allow safe retry.
        const errMsg = json.error?.message || 'Server failed to revoke session. Please retry.';
        setLogoutError(errMsg);
        return;
      }

      // Confirmed server-side revocation: clear local state and redirect to login
      localStorage.removeItem('pondfish_worker_token');
      localStorage.removeItem('pondfish_worker_info');
      setWorker(null);
      setCachedProfile(null);
      setSessionState('UNAUTHENTICATED');
      window.location.href = '/worker/login';
    } catch {
      // Network failure during logout: do not claim session is revoked
      setLogoutError('Network error prevented session revocation. Check your connection and retry.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isLoginPage) {
    return (
      <div style={{ minHeight: '100vh', background: '#F0F5FA', color: '#0F2C59', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}>
        {children}
      </div>
    );
  }

  const navLinks = [
    { href: '/worker', label: 'Dashboard', exact: true },
    { href: '/worker/bookings', label: 'Booking Queue', exact: true },
    { href: '/worker/bookings/scan', label: 'Scan QR', exact: false },
    { href: '/worker/bookings/search', label: 'Search', exact: false },
    { href: '/worker/customers', label: 'Customers', exact: false },
  ];

  const isLinkActive = (item) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <div className="pf-worker-shell">
      {/* Tablet & Mobile Operational Header */}
      <header className="pf-worker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className="pf-worker-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle worker navigation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F2C59" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <Link href="/worker" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.06em', lineHeight: 1 }}>
              <span style={{ color: '#0f2c59' }}>Pond</span>
              <span style={{ color: '#2670b7' }}>Fish</span>
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '800',
                background: '#E0F2FE',
                color: '#0369A1',
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Worker
            </span>
          </Link>

          {sessionState === 'AUTHENTICATED' ? (
            <span
              className="pf-worker-active-badge"
              style={{
                fontSize: '11px',
                background: '#DCFCE7',
                color: '#166534',
                padding: '3px 9px',
                borderRadius: '20px',
                fontWeight: '800',
                border: '1px solid #BBF7D0',
              }}
            >
              ● STORE ACTIVE
            </span>
          ) : sessionState === 'OFFLINE' ? (
            <span
              className="pf-worker-active-badge"
              style={{
                fontSize: '11px',
                background: '#FEF3C7',
                color: '#92400E',
                padding: '3px 9px',
                borderRadius: '20px',
                fontWeight: '800',
                border: '1px solid #FDE68A',
              }}
            >
              ⚠️ OFFLINE / UNVERIFIED
            </span>
          ) : (
            <span
              className="pf-worker-active-badge"
              style={{
                fontSize: '11px',
                background: '#F1F5F9',
                color: '#475569',
                padding: '3px 9px',
                borderRadius: '20px',
                fontWeight: '800',
                border: '1px solid #E2E8F0',
              }}
            >
              VERIFYING...
            </span>
          )}
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="pf-worker-desktop-nav">
          {navLinks.map((item) => {
            const active = isLinkActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  background: active ? '#1E56A0' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#425B73',
                  border: '1px solid',
                  borderColor: active ? '#1E56A0' : '#CBD5E1',
                  boxShadow: active ? '0 2px 8px rgba(30, 86, 160, 0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Worker Badge & Logout */}
        <div className="pf-worker-user-section">
          {worker ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: '#E0F2FE',
                  color: '#0369A1',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  border: '1px solid #BAE6FD',
                  flexShrink: 0,
                }}
              >
                {worker.name ? worker.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="pf-worker-user-details" style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F2C59' }}>{worker.name || 'Store Worker'}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{worker.mobileNumber || ''}</div>
              </div>
            </div>
          ) : cachedProfile && sessionState === 'OFFLINE' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.85 }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  border: '1px solid #FDE68A',
                  flexShrink: 0,
                }}
              >
                {cachedProfile.name ? cachedProfile.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="pf-worker-user-details" style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400E' }}>{cachedProfile.name}</div>
                <div style={{ fontSize: '11px', color: '#B45309' }}>Offline / Unverified</div>
              </div>
            </div>
          ) : null}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: isLoggingOut ? 0.6 : 1,
            }}
          >
            {isLoggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* Explicit Revocation Failure Banner when Logout Fails */}
      {logoutError && (
        <div
          role="alert"
          style={{
            background: '#FEF2F2',
            borderBottom: '1px solid #F87171',
            padding: '12px 16px',
            color: '#991B1B',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              <strong>Sign Out Failed:</strong> {logoutError} Your server session has not been revoked.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogout}
              style={{
                background: '#DC2626',
                border: '1px solid #B91C1C',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoggingOut ? 'Retrying...' : 'Retry Sign Out'}
            </button>
            <button
              type="button"
              onClick={() => setLogoutError(null)}
              style={{
                background: '#FFFFFF',
                border: '1px solid #D1D5DB',
                color: '#4B5563',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Explicit Offline Banner when Session Cannot Be Verified */}
      {sessionState === 'OFFLINE' && (
        <div
          role="alert"
          style={{
            background: '#FFFBEB',
            borderBottom: '1px solid #FDE68A',
            padding: '10px 16px',
            color: '#92400E',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textAlign: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Live worker session unverified (network connection offline). Protected operations require active server verification.
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginLeft: '8px',
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '700',
              color: '#92400E',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="pf-worker-main">
        {children}
      </main>

      {/* Sticky Mobile Bottom Navigation Bar (Phones) */}
      <nav className="pf-worker-bottom-nav">
        <Link
          href="/worker"
          className={`pf-worker-bottom-nav-item ${pathname === '/worker' ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
          </svg>
          <span>Dashboard</span>
        </Link>
        <Link
          href="/worker/bookings"
          className={`pf-worker-bottom-nav-item ${pathname === '/worker/bookings' ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <span>Queue</span>
        </Link>
        <Link
          href="/worker/bookings/scan"
          className={`pf-worker-bottom-nav-item ${pathname.includes('/scan') ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>Scan QR</span>
        </Link>
        <Link
          href="/worker/customers"
          className={`pf-worker-bottom-nav-item ${pathname.includes('/customers') ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Lookup</span>
        </Link>
      </nav>

      {/* Slide-in Mobile Drawer */}
      {mounted && mobileMenuOpen && createPortal(
        <div
          className="pf-worker-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="pf-worker-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.06em', lineHeight: 1 }}>
                  <span style={{ color: '#FFFFFF' }}>Pond</span>
                  <span style={{ color: '#38BDF8' }}>Fish</span>
                </span>
                <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', padding: '2px 6px', borderRadius: '4px' }}>
                  Worker
                </span>
              </div>
              <button
                type="button"
                className="pf-worker-mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>

            {/* Worker Profile Mini Card */}
            {worker ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1E56A0, #0284C7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: '800',
                  color: '#FFFFFF',
                }}>
                  {worker.name ? worker.name.charAt(0).toUpperCase() : 'W'}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>{worker.name || 'Store Worker'}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{worker.mobileNumber || ''}</div>
                </div>
              </div>
            ) : cachedProfile && sessionState === 'OFFLINE' ? (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: '800',
                  color: '#FFFFFF',
                }}>
                  {cachedProfile.name ? cachedProfile.name.charAt(0).toUpperCase() : 'W'}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#FDE68A' }}>{cachedProfile.name}</div>
                  <div style={{ fontSize: '11px', color: '#FCD34D' }}>Offline / Unverified</div>
                </div>
              </div>
            ) : null}

            {/* Navigation Links */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {navLinks.map((item) => {
                const active = isLinkActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: active ? '800' : '600',
                      textDecoration: 'none',
                      color: active ? '#FFFFFF' : '#CBD5E1',
                      background: active ? '#1E56A0' : 'transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Logout button at bottom of drawer */}
            <button
              disabled={isLoggingOut}
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              style={{
                marginTop: 'auto',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#F87171',
                padding: '12px 14px',
                borderRadius: '8px',
                cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isLoggingOut ? 0.6 : 1,
              }}
            >
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
