'use client';

import React from 'react';
import { Download, QrCode, Sparkles, ShieldCheck } from './Icons';

export default function MobileApp() {
  return (
    <section id="mobile-app" style={{ padding: '60px 0', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div className="pf-app-banner">
          <div style={{ display: 'grid', gap: '32px', alignItems: 'center' }} className="pf-app-grid">
            <div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(147, 204, 255, 0.3)',
                padding: '4px 14px',
                fontSize: '11px',
                fontWeight: '900',
                letterSpacing: '0.08em',
                color: '#93CCFF',
                textTransform: 'uppercase',
                marginBottom: '16px'
              }}>
                <Sparkles size={12} color="#93CCFF" />
                <span>PondFish Mobile Application</span>
              </span>

              <h2 style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-0.04em', lineHeight: '1.2', color: '#ffffff', marginBottom: '16px' }}>
                Book Fresh Catch Exclusively on the Mobile App
              </h2>

              <p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.7', maxWidth: '640px', marginBottom: '24px' }}>
                Browse today&apos;s morning pond harvest, reserve custom curry cut or fry steaks, and pick up with your instant QR Pass at our Bangalore store express counter.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '28px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <QrCode size={16} color="#93CCFF" />
                  <span>Instant QR Collection Pass</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="#93CCFF" />
                  <span>Live Stock &amp; Freshness Tiers</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#93CCFF" />
                  <span>Prepaid Wallet &amp; Subscriptions</span>
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <a
                  href="#mobile-app"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#0f2c59',
                    padding: '12px 20px',
                    fontSize: '13px',
                    fontWeight: '800',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  <Download size={16} color="#0f2c59" />
                  <span>Download for Android</span>
                </a>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#93CCFF'
                }}>
                  <span>iOS App Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
