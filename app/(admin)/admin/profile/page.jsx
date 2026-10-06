'use client';

/**
 * ADMIN-22: Admin Profile Page
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Section 178)
 * - Master PRD v2 (Section 4.4 Admin User Persona)
 */

import React, { useState, useEffect } from 'react';

export default function AdminProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('pondfish_admin_token') : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

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
      <div style={{ color: '#94A3B8', fontSize: '14px', padding: '24px' }}>
        ⏳ Loading administrator profile...
      </div>
    );
  }

  return (
    <div style={{ color: '#F8FAFC', maxWidth: '900px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>
          Account / Profile
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>
          Administrator Profile
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
          Operational profile details, verified credentials, and administrative activity footprint.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#450A0A',
          border: '1px solid #991B1B',
          color: '#FECACA',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {profile && (
        <>
          {/* Identity Card */}
          <div style={{
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '28px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: '#FFFFFF',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
            }}>
              👤
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
                  {profile.name || 'Store Administrator'}
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: profile.is_super_admin ? '#0369A1' : '#334155',
                  color: '#E0F2FE',
                }}>
                  {profile.is_super_admin ? 'SUPER ADMIN' : 'STORE ADMIN'}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#064E3B',
                  color: '#A7F3D0',
                }}>
                  ACTIVE
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#94A3B8' }}>
                {profile.email}
              </div>
            </div>

            <div>
              <a
                href="/admin/security"
                style={{
                  display: 'inline-block',
                  background: '#334155',
                  color: '#F8FAFC',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                }}
              >
                🛡️ Manage Credentials
              </a>
            </div>
          </div>

          {/* Account Details Metadata */}
          <div style={{
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '28px',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
              Account Metadata & Timestamps
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '2px' }}>Account ID</div>
                <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#CBD5E1' }}>
                  {profile.id}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '2px' }}>Role Authorization</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1' }}>
                  {profile.role} (Unrestricted Operations)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '2px' }}>Provisioned Date</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1' }}>
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleString() : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '2px' }}>Last Updated / Login</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1' }}>
                  {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Security Action Footprint */}
          <div style={{
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 6px 0' }}>
              Recent Security Audit Footprint
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 16px 0' }}>
              Immutable audit log of authentication and credential events related to this account.
            </p>

            {(!profile.securityFootprint || profile.securityFootprint.length === 0) ? (
              <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', padding: '16px' }}>
                No recent security actions logged for this account.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {profile.securityFootprint.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: log.action.includes('FAILURE') ? '#EF4444' : '#10B981',
                        marginRight: '12px',
                      }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                        {log.metadata ? JSON.stringify(log.metadata) : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
