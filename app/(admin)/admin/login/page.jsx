'use client';

/**
 * ADMIN-01: Admin Login Page
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 23, 24, 25)
 * - Design System Specification (AP-01 Admin Login)
 */

import React, { useState, useEffect } from 'react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    // Check url search params for session expiry message
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === 'true') {
        setInfoMessage('Your session has expired. Please sign in again.');
      }
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || lockoutSeconds > 0) return;

    setErrorMessage('');
    setInfoMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error && data.error.code === 'RATE_LIMIT_EXCEEDED') {
          const secs = data.error.remainingSeconds || 300;
          setLockoutSeconds(secs);
          setErrorMessage(`Too many attempts. Please wait ${secs} seconds and try again.`);
        } else if (data.error && data.error.code === 'ACCOUNT_DISABLED') {
          setErrorMessage('This administrator account is disabled.');
        } else if (data.error && (data.error.code === 'INVALID_CREDENTIALS' || data.error.code === 'INVALID_INPUT')) {
          setErrorMessage('Invalid email or password.');
        } else {
          setErrorMessage(data.error?.message || 'Unable to sign in. Please verify your credentials.');
        }
        setLoading(false);
        return;
      }

      // Successful login: authoritative session is stored in secure HttpOnly cookie.
      // Cache non-sensitive user metadata strictly for UI hydration.
      if (typeof window !== 'undefined') {
        localStorage.setItem('pondfish_admin_user', JSON.stringify(data.admin));

        const params = new URLSearchParams(window.location.search);
        const destination = params.get('redirect') || '/admin';
        window.location.href = destination;
      }
    } catch (err) {
      setErrorMessage('Unable to connect. Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0B1120',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#1E293B',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
            color: '#FFFFFF',
            fontSize: '24px',
            marginBottom: '12px',
            boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.4)',
          }}>
            🐟
          </div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#F8FAFC',
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
          }}>
            PONDFISH ADMIN
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#94A3B8',
            margin: 0,
          }}>
            Operational Access Control & Security Center
          </p>
        </div>

        {/* Info Notification */}
        {infoMessage && (
          <div style={{
            background: '#0C4A6E',
            border: '1px solid #0284C7',
            color: '#E0F2FE',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>ℹ️</span>
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div style={{
            background: '#450A0A',
            border: '1px solid #991B1B',
            color: '#FECACA',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: '#CBD5E1',
              marginBottom: '6px',
            }}>
              Administrator Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@pondfish.in"
              required
              disabled={loading || lockoutSeconds > 0}
              autoComplete="username"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F8FAFC',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: '#CBD5E1',
              marginBottom: '6px',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={loading || lockoutSeconds > 0}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 42px 12px 14px',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '4px',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <button
            id="admin-signin-button"
            type="submit"
            disabled={loading || lockoutSeconds > 0}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: loading || lockoutSeconds > 0 ? '#334155' : '#0284C7',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || lockoutSeconds > 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Signing in...</span>
              </>
            ) : lockoutSeconds > 0 ? (
              <span>Locked ({lockoutSeconds}s)</span>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid #334155',
          textAlign: 'center',
          fontSize: '12px',
          color: '#64748B',
          lineHeight: '1.5',
        }}>
          🛡️ Authorized Store Personnel Only. All access attempts are recorded to the permanent audit trail.
        </div>
      </div>
    </div>
  );
}
