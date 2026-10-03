'use client';

import Link from 'next/link';

export default function ContactPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '56px 24px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '48px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Direct Store Access
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '12px' }}>
          Visit or Contact Our Bangalore Counter
        </h1>
        <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '640px', lineHeight: '1.6' }}>
          Whether you have questions about today's fresh morning harvest or want to request custom whole-fish cleaning, our retail counter team is here to assist.
        </p>
      </div>

      {/* 2. Contact Details & Hours Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '28px',
        marginBottom: '48px'
      }}>
        {/* Physical Location */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '16px' }}>📍</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Store Counter Address
          </h3>
          <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: '1.7', marginBottom: '16px' }}>
            <strong style={{ color: '#F8FAFC' }}>PondFish Bangalore Flagship Counter</strong><br />
            123 Fresh Lake Road, Water Town<br />
            Bangalore, Karnataka — 560001<br />
            Landmark: Near Lakeside Metro Station
          </p>
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#38BDF8',
              fontSize: '13px',
              fontWeight: '700',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Open in Google Maps</span>
            <span>&rarr;</span>
          </a>
        </div>

        {/* Operating Hours */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '16px' }}>⏰</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Daily Hours & Truck Windows
          </h3>
          <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '6px', marginBottom: '6px' }}>
              <span style={{ color: '#F8FAFC', fontWeight: '600' }}>Counter Retail:</span>
              <span>06:00 AM – 09:00 PM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '6px', marginBottom: '6px' }}>
              <span style={{ color: '#F8FAFC', fontWeight: '600' }}>Fresh Truck Window:</span>
              <span style={{ color: '#16A34A', fontWeight: '700' }}>07:00 AM – 08:30 AM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px' }}>
              <span style={{ color: '#F8FAFC', fontWeight: '600' }}>Cleaning & Dressing:</span>
              <span>Available all operating hours</span>
            </div>
          </div>
        </div>

        {/* Phone & Inquiries */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '16px' }}>📞</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Customer Counter Direct
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.7', marginBottom: '16px' }}>
            Call our counter directly during operating hours for immediate availability queries:
          </p>
          <div style={{ marginBottom: '12px' }}>
            <a
              href="tel:+919876543210"
              style={{
                fontSize: '18px',
                fontWeight: '800',
                color: '#38BDF8',
                textDecoration: 'none'
              }}
            >
              +91 98765 43210
            </a>
          </div>
          <div>
            <a
              href="mailto:support@pondfish.in"
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#94A3B8',
                textDecoration: 'none'
              }}
            >
              support@pondfish.in
            </a>
          </div>
        </div>
      </div>

      {/* 3. In-Store Services Highlight */}
      <div style={{
        background: '#070D19',
        border: '1px solid #1E293B',
        borderRadius: '12px',
        padding: '32px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '6px' }}>
            Complimentary Custom Cutting & Cleaning
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' }}>
            Our trained store cutters clean, scale, and cut every purchase to your exact preference: Bengali curry cut, South Indian fry steaks, boneless cubes, or whole cleaned with head on.
          </p>
        </div>
        <Link
          href="/fish"
          style={{
            padding: '12px 24px',
            background: '#0284C7',
            color: '#FFFFFF',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none'
          }}
        >
          Check Today's Catch &rarr;
        </Link>
      </div>
    </div>
  );
}
