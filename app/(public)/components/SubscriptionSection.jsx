'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from './Icons';

const plans = [
  {
    id: 'plan-1',
    name: 'Fresh Start',
    price: 2000,
    duration: '30 Days Validity',
    weeklyKg: '2.0 kg / week',
    description: 'Ideal for regular home cooking with fresh weekly catches.',
    featured: false,
    perks: [
      '100% monetary wallet credit retention',
      'Guaranteed weekly pond harvest quota',
      'Free standard curry cut & descaling',
      'Roll-over unused credit to next cycle'
    ]
  },
  {
    id: 'plan-2',
    name: 'Pond Priority',
    price: 6000,
    duration: '90 Days Validity',
    weeklyKg: '3.0 kg / week',
    description: 'Best value for families & seafood enthusiasts.',
    featured: true,
    perks: [
      '100% monetary credit in digital pass',
      'Priority cutting & express counter pickup',
      'Custom cut options (Steaks, Fillets, Curry Cut)',
      '10% bonus credit on festive catch arrivals'
    ]
  }
];

export default function SubscriptionSection() {
  return (
    <section id="subscription-plans" style={{ padding: '70px 0', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div className="pf-section-head">
          <div>
            <p className="pf-eyebrow">SEAFOOD MEMBERSHIP &amp; WALLET</p>
            <h2 className="pf-section-title">Weekly fresh fish with guaranteed savings.</h2>
          </div>
        </div>

        <div className="pf-subs-grid">
          {plans.map((plan) => (
            <div key={plan.id} className={`pf-sub-card ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && (
                <span className="pf-sub-featured-pill">
                  MOST POPULAR
                </span>
              )}

              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f2c59', marginBottom: '6px' }}>
                  {plan.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                  {plan.description}
                </p>
              </div>

              <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: '#1e56a0' }}>₹{plan.price}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>/ {plan.duration}</span>
                </div>
                <div style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  backgroundColor: '#e8f1f5',
                  color: '#1e56a0',
                  borderRadius: '9999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: '800'
                }}>
                  {plan.weeklyKg}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', flex: 1 }}>
                {plan.perks.map((perk, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#334155' }}>
                    <Check size={14} color="#159c57" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/subscriptions"
                className="pf-btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  backgroundColor: plan.featured ? '#1e56a0' : '#0f2c59',
                  textAlign: 'center'
                }}
              >
                <span>Select Plan</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
