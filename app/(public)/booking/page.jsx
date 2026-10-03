'use client';

import Link from 'next/link';

export default function BookingEntryPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '56px 24px', width: '100%' }}>
      {/* 1. Badge & Headline */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(2, 132, 199, 0.15)',
          border: '1px solid rgba(2, 132, 199, 0.3)',
          padding: '6px 14px',
          borderRadius: '20px',
          color: '#38BDF8',
          fontSize: '12px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: '16px'
        }}>
          📲 Customer Booking Portal
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          Reserve Fresh Daily Catch Online
        </h1>
        <p style={{ fontSize: '17px', color: '#94A3B8', maxWidth: '640px', margin: '0 auto', lineHeight: '1.6' }}>
          Lock in your preferred whole fish or pre-cut portions directly before the morning truck arrives at our Bangalore counter.
        </p>
      </div>

      {/* 2. How Online Booking Works Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '24px',
        marginBottom: '56px'
      }}>
        {/* Step 1 */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '28px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(2, 132, 199, 0.15)',
            color: '#38BDF8',
            fontSize: '18px',
            fontWeight: '900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            1
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Check Bookable Catch
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            View live fish with the <strong style={{ color: '#38BDF8' }}>Online Booking Available</strong> badge in our live catalogue.
          </p>
        </div>

        {/* Step 2 */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '28px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(2, 132, 199, 0.15)',
            color: '#38BDF8',
            fontSize: '18px',
            fontWeight: '900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            2
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Enter Customer App
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            Seamless OTP authentication via your phone number. No passwords or cumbersome account creation required.
          </p>
        </div>

        {/* Step 3 */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '28px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(2, 132, 199, 0.15)',
            color: '#38BDF8',
            fontSize: '18px',
            fontWeight: '900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            3
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Instant Reservation
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            Choose priority counter pickup or morning dispatch with real-time GPS tracking of our delivery vehicle.
          </p>
        </div>
      </div>

      {/* 3. Action Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #162032 100%)',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', marginBottom: '12px' }}>
          Ready to discover today's catch?
        </h2>
        <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '580px', margin: '0 auto 28px', lineHeight: '1.6' }}>
          Physical store availability and online reservation eligibility are synchronized in real-time with our Supabase PostgreSQL inventory.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
          <Link
            href="/fish"
            style={{
              padding: '14px 28px',
              background: '#0284C7',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '700',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Browse Bookable Fish</span>
            <span>&rarr;</span>
          </Link>
          <Link
            href="/contact"
            style={{
              padding: '14px 28px',
              background: '#1E293B',
              color: '#F8FAFC',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '700',
              textDecoration: 'none',
              border: '1px solid #334155'
            }}
          >
            Call Bangalore Counter
          </Link>
        </div>
      </div>
    </div>
  );
}
