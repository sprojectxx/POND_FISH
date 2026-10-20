'use client';

import React from 'react';
import { ShieldCheck, Truck, QrCode, Sparkles } from './Icons';

const steps = [
  {
    icon: ShieldCheck,
    title: 'Harvested',
    text: 'Harvested fresh every morning from controlled inland freshwater ponds.'
  },
  {
    icon: Truck,
    title: 'In transit',
    text: 'Transported under monitored 2°C–4°C cold chain in our dedicated truck.'
  },
  {
    icon: QrCode,
    title: 'At the counter',
    text: 'Weighed on digital scales, custom cut to your style, and confirmed via QR pass.'
  },
  {
    icon: Sparkles,
    title: 'Credited',
    text: 'Subscription balance and flash discount applied automatically at checkout.'
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" style={{ padding: '70px 0', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div style={{ display: 'grid', gap: '20px', marginBottom: '36px' }} className="pf-how-head">
          <div>
            <p className="pf-eyebrow">HOW IT MOVES</p>
            <h2 className="pf-section-title">From pond to counter, without a mystery in between.</h2>
          </div>
          <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '680px', lineHeight: '1.6' }}>
            PondFish is built around useful, visible information—not noise. This is the path each catch takes before it reaches your kitchen.
          </p>
        </div>

        <div className="pf-how-grid">
          {steps.map((st, i) => {
            const IconComponent = st.icon;
            return (
              <div key={st.title} className="pf-how-step">
                <span className="pf-step-number">0{i + 1}</span>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: '#e8f1f5',
                  color: '#1e56a0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  position: 'relative'
                }}>
                  <IconComponent size={20} color="#1e56a0" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f2c59', marginBottom: '8px', position: 'relative' }}>
                  {st.title}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', position: 'relative' }}>
                  {st.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
