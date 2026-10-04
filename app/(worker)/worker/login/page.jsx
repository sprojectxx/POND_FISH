'use client';

/**
 * WP-01 — Worker Login Page
 * Traceability: PondFish Worker Portal Spec (Section 9)
 * Authenticates store worker via mobile number and password.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkerLoginPage() {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);

    const cleaned = mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleaned.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/worker/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: cleaned, password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error?.code === 'WORKER_ACCOUNT_DISABLED') {
          setError('Your worker account is currently disabled. Please contact the store administrator.');
        } else {
          setError(json.error?.message || 'Unable to sign in. Please check your credentials.');
        }
        return;
      }

      // Store token and worker profile
      localStorage.setItem('pondfish_worker_token', json.data.token);
      localStorage.setItem('pondfish_worker_info', JSON.stringify(json.data.worker));

      router.replace('/worker');
    } catch {
      setError('Unable to connect. Check your internet connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B1120',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '36px 32px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🐟</div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            PONDFISH WORKER PORTAL
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Store Counter & Order Fulfillment Terminal
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              color: '#F87171',
              fontSize: '13px',
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
              Worker Mobile Number
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '12px', color: '#64748B', fontSize: '13px', fontWeight: '600' }}>
                +91
              </span>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                maxLength={10}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 48px',
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 14px',
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                disabled={submitting}
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
                  color: '#94A3B8',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '6px',
              padding: '14px',
              background: '#0284C7',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '800',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Signing in...' : 'Sign In to Store Terminal →'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
          Authorized store staff only. Need access? Contact your store administrator.
        </div>
      </div>
    </div>
  );
}
