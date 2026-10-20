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
        background: '#F0F5FA',
        padding: '24px',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '40px 36px',
          boxShadow: '0 10px 30px rgba(15, 44, 89, 0.08)',
        }}
      >
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
              WORKER
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
            Store Counter &amp; Order Fulfillment Terminal
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              color: '#DC2626',
              fontSize: '13px',
              lineHeight: 1.4,
              fontWeight: '500',
            }}
          >
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
              Worker Mobile Number
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '14px', color: '#64748B', fontSize: '13px', fontWeight: '600' }}>
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
                  padding: '12px 14px 12px 50px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  color: '#0F2C59',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F2C59', marginBottom: '6px' }}>
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
                  padding: '12px 54px 12px 14px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  color: '#0F2C59',
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
                  color: '#1E56A0',
                  fontSize: '11px',
                  fontWeight: '800',
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
              background: '#1E56A0',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '800',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'background 0.2s',
              boxShadow: '0 4px 12px rgba(30, 86, 160, 0.2)',
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
