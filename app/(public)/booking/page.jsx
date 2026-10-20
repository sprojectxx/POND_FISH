'use client';

import Link from 'next/link';
import { ArrowRight, Check, Phone, ShieldCheck, Truck, Clock } from '../components/Icons';

export default function BookingEntryPage() {
  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '48px 24px 64px', width: '100%' }}>
      {/* 1. Badge & Headline */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#e0f2fe',
            border: '1px solid #bfdbfe',
            padding: '5px 14px',
            borderRadius: '9999px',
            color: '#1e56a0',
            fontSize: '11px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '16px',
          }}
        >
          <ShieldCheck size={14} color="#1e56a0" />
          <span>Customer Reservation System</span>
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 14px 0' }}>
          Reserve Fresh Daily Catch Online
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: '1.65' }}>
          Lock in your preferred whole fish or pre-cut portions directly before the morning harvest truck arrives at our Bangalore retail counter.
        </p>
      </div>

      {/* 2. How Online Booking Works Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '56px',
        }}
      >
        {/* Step 1 */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#1e56a0',
              fontSize: '18px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            01
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Check Bookable Catch
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Filter live fish with the <strong style={{ color: '#1e56a0' }}>Online Bookable</strong> status directly in today's fresh catalogue.
          </p>
        </div>

        {/* Step 2 */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#1e56a0',
              fontSize: '18px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            02
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Specify Weight & Cuts
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Select your preferred cleaning preference: whole fish round, steaks/curry cut, or boneless fillets.
          </p>
        </div>

        {/* Step 3 */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              color: '#1e56a0',
              fontSize: '18px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            03
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Priority Counter Pickup
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: 0 }}>
            Pick up your packaged order within your 48-hour reserve window at our Bangalore counter, or track delivery.
          </p>
        </div>
      </div>

      {/* 3. Action Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '20px',
          padding: '44px 32px',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(30, 86, 160, 0.08)',
        }}
      >
        <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#0f2c59', margin: '0 0 10px 0' }}>
          Ready to reserve today's harvest?
        </h2>
        <p style={{ fontSize: '15px', color: '#38536e', maxWidth: '560px', margin: '0 auto 28px', lineHeight: '1.6' }}>
          Physical store availability and online reservation eligibility are synchronized in real-time with our store weighing scales.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px' }}>
          <Link
            href="/fish"
            style={{
              padding: '13px 26px',
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
            <span>Browse Bookable Fish</span>
            <ArrowRight size={16} color="#ffffff" />
          </Link>
          <Link
            href="/contact"
            style={{
              padding: '13px 24px',
              background: '#ffffff',
              color: '#0f2c59',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '800',
              textDecoration: 'none',
              border: '1px solid #cbd5e1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Phone size={16} color="#1e56a0" />
            <span>Call Bangalore Counter</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
