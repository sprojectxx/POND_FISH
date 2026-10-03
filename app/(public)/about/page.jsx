'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '56px 24px', width: '100%' }}>
      {/* 1. Header & Hero */}
      <div style={{ marginBottom: '56px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          The PondFish Difference
        </div>
        <h1 style={{ fontSize: '40px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          Real Lake Catch. Zero Chemicals. Uncompromising Freshness.
        </h1>
        <p style={{ fontSize: '18px', color: '#94A3B8', lineHeight: '1.7' }}>
          PondFish was founded with a singular purpose: to bring truly fresh, chemical-free lake and river fish directly from harvest waters to Bangalore dinner tables within hours, backed by complete age transparency.
        </p>
      </div>

      {/* 2. Core Pillars Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '64px'
      }}>
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🌊</div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '10px' }}>
            Direct Water Sourcing
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            We work directly with certified lake harvesters and sustainable pond cooperatives across Karnataka. No middlemen, no multi-day storage yards.
          </p>
        </div>

        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🚚</div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '10px' }}>
            Dedicated Insulated Fleet
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            Our dedicated refrigerated truck departs harvest sites before dawn, arriving at our Bangalore retail counter every single morning between 07:00 AM and 08:30 AM.
          </p>
        </div>

        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🛡️</div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '10px' }}>
            100% Preservative Free
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            Zero formalin, zero ammonia, and zero chemical washes. We rely strictly on sub-zero flake ice cold-chain management from water to plate.
          </p>
        </div>
      </div>

      {/* 3. The 3-Day Freshness Protocol */}
      <div style={{
        background: '#070D19',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '40px',
        marginBottom: '64px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
          Industry-First Transparency
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#F8FAFC', marginBottom: '12px' }}>
          The PondFish 3-Day Protocol
        </h2>
        <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '36px', maxWidth: '720px' }}>
          Most markets keep fish for weeks using chemical treatments. At PondFish, every fish is assigned an immutable catch timestamp and a visual color indicator visible to both customers and staff.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Day 1 */}
          <div style={{
            background: '#0F172A',
            border: '1px solid #16A34A',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#16A34A',
              color: '#FFFFFF',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              1
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                  Day 1 — Green (0 to 24 Hours)
                </h4>
                <span style={{ background: '#DCFCE7', color: '#16A34A', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px' }}>
                  PEAK CATCH
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
                Arrived with today's morning truck. Firm texture, clear bright eyes, fresh scent. Sold at standard counter MRP.
              </p>
            </div>
          </div>

          {/* Day 2 */}
          <div style={{
            background: '#0F172A',
            border: '1px solid #64748B',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#64748B',
              color: '#FFFFFF',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              2
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                  Day 2 — Grey (24 to 48 Hours)
                </h4>
                <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px' }}>
                  CLEARANCE SAVINGS
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
                Stored in strict sub-zero flake ice. Prime quality for curries and deep fry. Automatically discounted by the system to pass value to customers.
              </p>
            </div>
          </div>

          {/* Day 3 */}
          <div style={{
            background: '#0F172A',
            border: '1px solid #DC2626',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#DC2626',
              color: '#FFFFFF',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              3
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                  Day 3 — Red (48 to 72 Hours) & Strict Discard
                </h4>
                <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px' }}>
                  FINAL EXPIRY
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
                Last-call clearance. Any fish remaining at 72 hours is permanently discarded from the counter. We never sell fish past Day 3. Period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CTA */}
      <div style={{
        textAlign: 'center',
        padding: '36px',
        background: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '12px'
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
          Taste the Real Lake Catch Difference
        </h3>
        <p style={{ fontSize: '15px', color: '#94A3B8', marginBottom: '24px' }}>
          Browse our live inventory or visit our Bangalore counter today.
        </p>
        <Link
          href="/fish"
          style={{
            padding: '12px 28px',
            background: '#0284C7',
            color: '#FFFFFF',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>Open Live Fish Catalogue</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
