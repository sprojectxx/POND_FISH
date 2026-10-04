'use client';

/**
 * Worker Tablet Portal Shell Layout
 * Traceability: PondFish Worker Portal Spec (Sections 5, 6, WP-01, WP-02)
 * Tablet-first responsive navigation, session monitoring, and operational header.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function WorkerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/worker/login';

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('pondfish_worker_token') : null;
    const cachedWorker = typeof window !== 'undefined' ? localStorage.getItem('pondfish_worker_info') : null;

    if (!token) {
      setWorker(null);
      setLoading(false);
      if (!isLoginPage) {
        router.replace('/worker/login');
      }
      return;
    }

    if (cachedWorker) {
      try {
        setWorker(JSON.parse(cachedWorker));
      } catch {
        // invalid cache
      }
    }

    // Verify token with backend
    fetch('/api/v1/worker/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.worker) {
          setWorker(json.data.worker);
          localStorage.setItem('pondfish_worker_info', JSON.stringify(json.data.worker));
        } else {
          localStorage.removeItem('pondfish_worker_token');
          localStorage.removeItem('pondfish_worker_info');
          setWorker(null);
          if (!isLoginPage) {
            router.replace('/worker/login');
          }
        }
      })
      .catch(() => {
        // network issue, keep cached if present
      })
      .finally(() => {
        setLoading(false);
      });
  }, [pathname, isLoginPage, router]);

  function handleLogout() {
    const token = localStorage.getItem('pondfish_worker_token');
    if (token) {
      fetch('/api/v1/worker/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('pondfish_worker_token');
    localStorage.removeItem('pondfish_worker_info');
    setWorker(null);
    router.replace('/worker/login');
  }

  if (isLoginPage) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F8FAFC' }}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0B1120', color: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Tablet-First Operational Header */}
      <header
        style={{
          background: '#0F172A',
          borderBottom: '1px solid #1E293B',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/worker" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🐟</span>
            <div>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                PONDFISH
              </span>
              <span style={{ fontSize: '11px', color: '#0EA5E9', fontWeight: '700', marginLeft: '6px', textTransform: 'uppercase' }}>
                Worker Tablet
              </span>
            </div>
          </Link>
          <span
            style={{
              fontSize: '11px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22C55E',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: '700',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            ● STORE COUNTER ACTIVE
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link
            href="/worker"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              textDecoration: 'none',
              background: pathname === '/worker' ? '#0284C7' : '#1E293B',
              color: pathname === '/worker' ? '#FFFFFF' : '#94A3B8',
              border: '1px solid',
              borderColor: pathname === '/worker' ? '#0284C7' : '#334155',
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/worker/bookings"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              textDecoration: 'none',
              background: pathname === '/worker/bookings' ? '#0284C7' : '#1E293B',
              color: pathname === '/worker/bookings' ? '#FFFFFF' : '#94A3B8',
              border: '1px solid',
              borderColor: pathname === '/worker/bookings' ? '#0284C7' : '#334155',
            }}
          >
            Booking Queue
          </Link>
          <Link
            href="/worker/bookings/scan"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              textDecoration: 'none',
              background: pathname.includes('/scan') ? '#0284C7' : '#1E293B',
              color: pathname.includes('/scan') ? '#FFFFFF' : '#94A3B8',
              border: '1px solid',
              borderColor: pathname.includes('/scan') ? '#0284C7' : '#334155',
            }}
          >
            📷 Scan QR
          </Link>
          <Link
            href="/worker/bookings/search"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              textDecoration: 'none',
              background: pathname.includes('/search') ? '#0284C7' : '#1E293B',
              color: pathname.includes('/search') ? '#FFFFFF' : '#94A3B8',
              border: '1px solid',
              borderColor: pathname.includes('/search') ? '#0284C7' : '#334155',
            }}
          >
            🔍 Search
          </Link>
        </nav>

        {/* Worker Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {worker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#0284C7',
                  color: '#FFFFFF',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                }}
              >
                {worker.name ? worker.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>{worker.name || 'Store Worker'}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{worker.mobileNumber || ''}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              padding: '7px 12px',
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

      {/* Main Tablet Workspace */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  );
}
