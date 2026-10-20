'use client';

import React from 'react';
import { Droplets, Warehouse, ShieldCheck } from './Icons';

const points = [
  {
    icon: Droplets,
    title: 'Know the pond',
    text: 'Controlled inland aquaculture ponds with zero formalin and water quality checks.'
  },
  {
    icon: Warehouse,
    title: 'Know the counter',
    text: 'Dedicated Bangalore store with physical weigh-in, custom cuts, and express pickup.'
  },
  {
    icon: ShieldCheck,
    title: 'Know the record',
    text: 'Digital QR passes, ledger-backed wallets, and 0–24h transparent freshness timestamps.'
  }
];

export default function About() {
  return (
    <section id="about" style={{ padding: '64px 0', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div style={{ display: 'grid', gap: '32px' }} className="pf-about-grid">
          <div>
            <p className="pf-eyebrow">ABOUT PONDFISH</p>
            <h2 className="pf-section-title" style={{ marginBottom: '16px' }}>
              Freshwater fish with fewer unknowns.
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#475569', maxWidth: '800px' }}>
              PondFish brings pond sourcing, cold-chain transit, store availability, and customer credit into one straightforward retail experience. We don&apos;t freeze or chemically treat fish; every catch is harvested fresh and tracked in real-time.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {points.map((pt) => {
              const IconComp = pt.icon;
              return (
                <div
                  key={pt.title}
                  style={{
                    borderRadius: '16px',
                    border: '1px solid #d7e1e8',
                    backgroundColor: '#ffffff',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                  }}
                >
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#e8f1f5',
                    color: '#1e56a0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <IconComp size={22} color="#1e56a0" />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f2c59', marginBottom: '6px' }}>
                    {pt.title}
                  </h3>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#64748b' }}>
                    {pt.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
