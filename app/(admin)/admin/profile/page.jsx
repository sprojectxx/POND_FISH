'use client';

/**
 * ADMIN-22: Admin Profile Page
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Section 178)
 * - Master PRD v2 (Section 4.4 Admin User Persona)
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminSubNav } from '@/components/ui';

export default function AdminProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const headers = { 'Content-Type': 'application/json' };

        const res = await fetch('/api/v1/admin/auth/me', { headers });
        if (res.status === 401) {
          window.location.href = '/admin/login?expired=true';
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error?.message || 'Failed to fetch administrator profile.');
          return;
        }

        setProfile(data.admin);
      } catch (err) {
        setError('Network error fetching administrator profile.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#64748B', fontSize: '13px', padding: '36px', textAlign: 'center' }}>
        Loading administrator profile...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Store Operations', href: '/admin/settings', exact: true },
          { label: 'Reports & Exports', href: '/admin/reports' },
          { label: 'Activity Log', href: '/admin/audit' },
          { label: 'Order Alerts', href: '/admin/exceptions' },
          { label: 'Security & Passwords', href: '/admin/security' },
          { label: 'My Profile', href: '/admin/profile' },
        ]}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Administrator Profile
          </h1>
        </div>
        <div>
          <Link
            href="/admin/security"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#1E56A0',
              color: '#FFFFFF',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Manage Credentials</span>
          </Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '13px',
          fontWeight: '600',
        }}>
          {error}
        </div>
      )}

      {profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Identity & Status Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1E56A0 0%, #0284C7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: '800',
                color: '#FFFFFF',
                boxShadow: '0 4px 10px rgba(30, 86, 160, 0.25)',
                flexShrink: 0,
              }}>
                {(profile.name || 'A')[0].toUpperCase()}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                    {profile.name || 'Store Administrator'}
                  </h2>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: profile.is_super_admin ? '#EFF6FF' : '#F1F5F9',
                    color: profile.is_super_admin ? '#1E56A0' : '#475569',
                    border: `1px solid ${profile.is_super_admin ? '#BFDBFE' : '#CBD5E1'}`,
                  }}>
                    {profile.is_super_admin ? 'SUPER ADMIN' : 'STORE ADMIN'}
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: '#ECFDF5',
                    color: '#065F46',
                    border: '1px solid #A7F3D0',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>
                  {profile.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href="/admin/audit"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  color: '#1E56A0',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span>View Full Activity Log</span>
              </Link>
            </div>
          </div>

          {/* Account Details & Role Authority */}
          <div
            className="pf-admin-metrics-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}
          >
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '8px' }}>
                Admin Account ID
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0F2C59', fontWeight: '600', wordBreak: 'break-all' }}>
                {profile.id}
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '8px' }}>
                Role Authorization
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E56A0' }}>
                {profile.role || 'ADMIN'} <span style={{ fontWeight: '500', color: '#64748B', fontSize: '12px' }}>(Store &amp; Operations Governance)</span>
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '8px' }}>
                Account Provisioned
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F2C59' }}>
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Established'}
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '8px' }}>
                Last Login Session
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F2C59' }}>
                {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Current Session'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
