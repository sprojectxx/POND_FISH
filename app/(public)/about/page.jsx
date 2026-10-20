'use client';

import Link from 'next/link';
import { Droplets, Truck, ShieldCheck, ArrowRight, Clock, Check } from '../components/Icons';

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '48px 24px 72px', width: '100%' }}>
      {/* 1. Header & Hero */}
      <div style={{ marginBottom: '48px' }}>
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
          The PondFish Cold-Chain Standard
        </div>
        <h1 style={{ fontSize: '40px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 16px 0', lineHeight: '1.2' }}>
          Real Lake Catch. Zero Chemicals. Uncompromising Freshness.
        </h1>
        <p style={{ fontSize: '17px', color: '#64748b', lineHeight: '1.7', margin: 0, maxWidth: '780px' }}>
          PondFish was founded with a singular purpose: to bring truly fresh, chemical-free lake and river fish directly from harvest waters to Bangalore dinner tables within hours, backed by complete age transparency.
        </p>
      </div>

      {/* 2. Core Pillars Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '56px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Droplets size={24} color="#0284c7" />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Direct Water Sourcing
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            We work directly with certified lake harvesters and sustainable pond cooperatives across Andhra & Karnataka. No middlemen, no multi-day holding yards.
          </p>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Truck size={24} color="#0284c7" />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Dedicated Insulated Fleet
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Our dedicated refrigerated truck departs harvest sites before dawn, arriving at our Bangalore retail counter every morning between 07:00 AM and 08:30 AM.
          </p>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#ecfdf5',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <ShieldCheck size={24} color="#047857" />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            100% Preservative Free
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Zero formalin, zero ammonia, and zero chemical washes. We rely strictly on sub-zero flake ice cold-chain management from water to plate.
          </p>
        </div>
      </div>

      {/* 3. The 3-Day Freshness Protocol */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '40px 32px',
          marginBottom: '56px',
          boxShadow: '0 4px 20px rgba(15, 44, 89, 0.04)',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
          Industry-First Transparency
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#0f2c59', margin: '0 0 10px 0' }}>
          The PondFish 3-Day Protocol
        </h2>
        <p style={{ fontSize: '15px', color: '#64748b', lineHeight: '1.65', margin: '0 0 32px 0', maxWidth: '720px' }}>
          Most wet markets hold fish for weeks using chemical treatments. At PondFish, every batch is assigned an immutable catch timestamp and a visual color indicator visible to both customers and staff.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Day 1 */}
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '18px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#10b981',
                color: '#ffffff',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              1
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '17px', fontWeight: '800', color: '#065f46', margin: 0 }}>
                  Day 1 — Green (0 to 24 Hours)
                </h4>
                <span style={{ background: '#d1fae5', color: '#047857', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                  PEAK CATCH
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#047857', lineHeight: '1.6', margin: 0 }}>
                Arrived with today's morning truck. Firm texture, clear bright eyes, fresh lake scent. Sold at standard counter rates.
              </p>
            </div>
          </div>

          {/* Day 2 */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '18px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#64748b',
                color: '#ffffff',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              2
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                  Day 2 — Grey (24 to 48 Hours)
                </h4>
                <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                  CLEARANCE SAVINGS
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                Stored in strict sub-zero flake ice. Prime quality for curries and deep fry. Automatically discounted by the system to pass value directly to customers.
              </p>
            </div>
          </div>

          {/* Day 3 */}
          <div
            style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '18px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#e11d48',
                color: '#ffffff',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              3
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '17px', fontWeight: '800', color: '#9f1239', margin: 0 }}>
                  Day 3 — Red (48 to 72 Hours) & Strict Discard
                </h4>
                <span style={{ background: '#ffe4e6', color: '#be123c', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                  FINAL EXPIRY
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#9f1239', lineHeight: '1.6', margin: 0 }}>
                Last-call clearance. Any fish remaining at 72 hours is permanently discarded from the counter. We never sell fish past Day 3. Period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CTA */}
      <div
        style={{
          textAlign: 'center',
          padding: '44px 32px',
          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '20px',
          boxShadow: '0 8px 24px rgba(30, 86, 160, 0.08)',
        }}
      >
        <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#0f2c59', margin: '0 0 8px 0' }}>
          Taste the Real Lake Catch Difference
        </h3>
        <p style={{ fontSize: '15px', color: '#38536e', margin: '0 0 24px 0', maxWidth: '540px', marginLeft: 'auto', marginRight: 'auto' }}>
          Browse today's morning harvest or visit our Bangalore flagship counter in person.
        </p>
        <Link
          href="/fish"
          style={{
            padding: '13px 28px',
            background: '#1e56a0',
            color: '#ffffff',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '800',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(30, 86, 160, 0.25)',
          }}
        >
          <span>Open Live Fish Catalogue</span>
          <ArrowRight size={16} color="#ffffff" />
        </Link>
      </div>
    </div>
  );
}
