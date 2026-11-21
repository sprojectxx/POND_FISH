'use client';

/**
 * ADMIN-21: Admin Security & Credential Governance Page
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 174, 175, 176, 177, 270)
 * - Master PRD v2 (Section 26: Security & Privacy)
 */

import React, { useState, useEffect } from 'react';
import { AdminSubNav } from '@/components/ui';

export default function AdminSecurityPage() {
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Terminate sessions state
  const [terminating, setTerminating] = useState(false);

  const fetchSecurityData = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // 1. Fetch profile
      const profRes = await fetch('/api/v1/admin/auth/me', { headers });
      if (profRes.status === 401) {
        window.location.href = '/admin/login?expired=true';
        return;
      }
      const profData = await profRes.json();
      if (profData.success) {
        setProfile(profData.admin);
      }

      // 2. Fetch active sessions
      const sessRes = await fetch('/api/v1/admin/auth/sessions', { headers });
      if (sessRes.status === 401) {
        window.location.href = '/admin/login?expired=true';
        return;
      }
      const sessData = await sessRes.json();
      if (sessData.success) {
        setSessions(sessData.sessions || []);
      }
    } catch (err) {
      setError('Unable to load security configuration. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setSubmittingPassword(true);

    try {
      const headers = { 'Content-Type': 'application/json' };

      const res = await fetch('/api/v1/admin/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401 && data.error?.code === 'SESSION_EXPIRED') {
          window.location.href = '/admin/login?expired=true';
          return;
        }
        setPasswordError(data.error?.message || 'Failed to change password. Verify your current password.');
        setSubmittingPassword(false);
        return;
      }

      setPasswordSuccess('Password successfully updated. All other active sessions have been terminated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      fetchSecurityData();
    } catch (err) {
      setPasswordError('Network error while updating password. Please try again.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleTerminateOtherSessions = async () => {
    if (!confirm('Are you sure you want to terminate all other active administrator sessions?')) return;

    setTerminating(true);
    setError('');
    setSuccessMessage('');

    try {
      const headers = { 'Content-Type': 'application/json' };

      const res = await fetch('/api/v1/admin/auth/sessions', {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          window.location.href = '/admin/login?expired=true';
          return;
        }
        setError(data.error?.message || 'Failed to terminate other sessions.');
        setTerminating(false);
        return;
      }

      setSuccessMessage(data.message || 'All other active sessions have been terminated.');
      fetchSecurityData();
    } catch (err) {
      setError('Network error while terminating sessions.');
    } finally {
      setTerminating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#64748B', fontSize: '14px', padding: '36px', textAlign: 'center' }}>
        Loading administrative security posture...
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
            Security &amp; Passwords
          </h1>
        </div>

        <button
          onClick={fetchSecurityData}
          disabled={loading}
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#0F2C59',
            height: '36px',
            padding: '0 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <svg
            className={loading ? 'pf-animate-spin' : ''}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Alerts */}
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

      {successMessage && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '13px',
          fontWeight: '600',
        }}>
          {successMessage}
        </div>
      )}

      {/* Security Posture Summary Cards */}
      <div
        className="pf-admin-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '6px' }}>Account Status</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
            {profile?.status || 'ACTIVE'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '6px' }}>Privilege Level</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#1E56A0' }}>
            {profile?.is_super_admin ? 'SUPER ADMIN' : 'STORE ADMIN'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '6px' }}>Current Session</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59' }}>
            Active Session
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '6px' }}>Last Updated / Login</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569', marginTop: '4px' }}>
            {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Current Session'}
          </div>
        </div>
      </div>

      <div
        className="pf-admin-twin-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
      >
        {/* Change Password Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px 0', color: '#0F2C59' }}>
            Change Password
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0', lineHeight: '1.4' }}>
            Updating credentials immediately secures your account and terminates all other active sessions.
          </p>

          {passwordError && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '16px',
            }}>
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '16px',
            }}>
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Current Password
              </label>
              <input
                id="current-password-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                disabled={submittingPassword}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  color: '#0F2C59',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                New Password (minimum 8 characters)
              </label>
              <input
                id="new-password-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                required
                disabled={submittingPassword}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  color: '#0F2C59',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                disabled={submittingPassword}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  color: '#0F2C59',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              id="update-password-button"
              type="submit"
              disabled={submittingPassword}
              style={{
                width: '100%',
                padding: '10px 18px',
                borderRadius: '8px',
                background: submittingPassword ? '#CBD5E1' : '#1E56A0',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '700',
                cursor: submittingPassword ? 'not-allowed' : 'pointer',
                boxShadow: submittingPassword ? 'none' : '0 2px 6px rgba(30, 86, 160, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              {submittingPassword ? 'Verifying & Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Active Sessions Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
              Active Sessions
            </h2>
            <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#1E56A0', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: '9999px', fontWeight: '700' }}>
              {sessions.length} Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0', lineHeight: '1.4' }}>
            Review sessions authorized to perform administrative operations across browsers and devices.
          </p>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px', marginBottom: '20px' }}>
            {sessions.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', padding: '24px' }}>
                No active session records found in registry.
              </div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.sessionId}
                  style={{
                    background: sess.isCurrent ? '#EFF6FF' : '#F8FAFC',
                    border: sess.isCurrent ? '1px solid #BFDBFE' : '1px solid #CBD5E1',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: sess.isCurrent ? '#1E56A0' : '#0F2C59' }}>
                      {sess.isCurrent ? 'This Browser (Current Session)' : 'External Device'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                      IP: {sess.ip}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    Client: {sess.userAgent}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                    Signed in: {new Date(sess.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            id="terminate-other-sessions-button"
            type="button"
            onClick={handleTerminateOtherSessions}
            disabled={terminating || sessions.length <= 1}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: sessions.length <= 1 || terminating ? '#CBD5E1' : '#DC2626',
              border: 'none',
              color: sessions.length <= 1 || terminating ? '#64748B' : '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: sessions.length <= 1 || terminating ? 'not-allowed' : 'pointer',
              marginTop: 'auto',
              boxShadow: sessions.length > 1 && !terminating ? '0 2px 6px rgba(220, 38, 38, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {terminating ? 'Terminating...' : 'Terminate All Other Sessions'}
          </button>
        </div>
      </div>
    </div>
  );
}
