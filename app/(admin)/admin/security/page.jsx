'use client';

/**
 * ADMIN-21: Admin Security & Credential Governance Page
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 174, 175, 176, 177, 270)
 * - Master PRD v2 (Section 26: Security & Privacy)
 */

import React, { useState, useEffect } from 'react';

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
      <div style={{ color: '#94A3B8', fontSize: '14px', padding: '24px' }}>
        ⏳ Loading administrative security posture...
      </div>
    );
  }

  return (
    <div style={{ color: '#F8FAFC', maxWidth: '1000px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>
          Governance / Admin Security
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>
          Admin Security & Session Governance
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
          Manage your account credential security, active session tokens, and access policy.
        </p>
      </div>

      {/* Global Alerts */}
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

      {successMessage && (
        <div style={{
          background: '#064E3B',
          border: '1px solid #059669',
          color: '#A7F3D0',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '14px',
        }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Security Posture Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Account Status</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
            {profile?.status || 'ACTIVE'}
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Privilege Level</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#38BDF8' }}>
            {profile?.is_super_admin ? 'SUPER ADMINISTRATOR' : 'ADMINISTRATOR'}
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Current Session</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#F8FAFC' }}>
            AUTHENTICATED (JWT 12h)
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Last Profile Touch</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#CBD5E1' }}>
            {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'N/A'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* Change Password Card */}
        <div style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>
            Change Password
          </h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px 0' }}>
            Updating credentials terminates all existing active sessions immediately.
          </p>

          {passwordError && (
            <div style={{
              background: '#450A0A',
              border: '1px solid #991B1B',
              color: '#FECACA',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              ⚠️ {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div style={{
              background: '#064E3B',
              border: '1px solid #059669',
              color: '#A7F3D0',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              ✓ {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
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
                  padding: '10px 12px',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
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
                  padding: '10px 12px',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
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
                  padding: '10px 12px',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  fontSize: '14px',
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
                padding: '10px 16px',
                borderRadius: '6px',
                background: submittingPassword ? '#334155' : '#0284C7',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: '600',
                cursor: submittingPassword ? 'not-allowed' : 'pointer',
              }}
            >
              {submittingPassword ? 'Verifying & Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Active Sessions Card */}
        <div style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Active Sessions
            </h2>
            <span style={{ fontSize: '12px', background: '#334155', color: '#CBD5E1', padding: '2px 8px', borderRadius: '12px' }}>
              {sessions.length} Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px 0' }}>
            Review sessions authorized to perform administrative operations.
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
                    background: sess.isCurrent ? '#0F172A' : '#1E293B',
                    border: sess.isCurrent ? '1px solid #0284C7' : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: sess.isCurrent ? '#38BDF8' : '#F8FAFC' }}>
                      {sess.isCurrent ? '📍 This Browser (Current Session)' : '💻 External Administrator Device'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
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
              borderRadius: '6px',
              background: sessions.length <= 1 || terminating ? '#334155' : '#EF4444',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '600',
              cursor: sessions.length <= 1 || terminating ? 'not-allowed' : 'pointer',
              marginTop: 'auto',
            }}
          >
            {terminating ? 'Terminating...' : 'Terminate All Other Sessions'}
          </button>
        </div>
      </div>
    </div>
  );
}
