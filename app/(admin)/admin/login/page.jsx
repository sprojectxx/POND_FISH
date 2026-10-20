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
      background: '#F0F5FA',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px 20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '38px 32px',
        boxShadow: '0 20px 40px rgba(15, 44, 89, 0.08)',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '34px', fontWeight: '900', letterSpacing: '-0.06em', lineHeight: 1 }}>
              <span style={{ color: '#0f2c59' }}>Pond</span>
              <span style={{ color: '#2670b7' }}>Fish</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                background: '#E0F2FE',
                color: '#0369A1',
                padding: '3px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              ADMIN
            </span>
          </div>
          <p style={{
            fontSize: '13px',
            color: '#64748B',
            margin: 0,
            fontWeight: '500',
          }}>
            Operational Access Control &amp; Security Center
          </p>
        </div>

        {/* Info Notification */}
        {infoMessage && (
          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            color: '#0369A1',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FEE2E2',
            color: '#DC2626',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: '#425B73',
              marginBottom: '6px',
              letterSpacing: '0.04em',
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
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                color: '#0F2C59',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: '#425B73',
              marginBottom: '6px',
              letterSpacing: '0.04em',
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
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  color: '#0F2C59',
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
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
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
              padding: '14px',
              borderRadius: '10px',
              background: loading || lockoutSeconds > 0 ? '#CBD5E1' : 'linear-gradient(135deg, #1E56A0 0%, #0F2C59 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading || lockoutSeconds > 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(30, 86, 160, 0.25)',
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Signing in...</span>
              </>
            ) : lockoutSeconds > 0 ? (
              <span>Locked ({lockoutSeconds}s)</span>
            ) : (
              <span>Sign In to Admin Portal</span>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid #E2E8F0',
          textAlign: 'center',
          fontSize: '12px',
          color: '#64748B',
          lineHeight: '1.5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Authorized Store Personnel Only. Session logged to audit trail.</span>
        </div>
      </div>
    </div>
  );
}
