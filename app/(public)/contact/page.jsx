'use client';

import Link from 'next/link';
import { MapPin, Clock, Phone, ArrowRight, Check } from '../components/Icons';

export default function ContactPage() {
  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '48px 24px 72px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
          Direct Store Counter Access
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '900', color: '#0f2c59', letterSpacing: '-0.5px', margin: '0 0 12px 0' }}>
          Visit or Contact Our Bangalore Counter
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '640px', lineHeight: '1.6', margin: 0 }}>
          Whether you have questions about today's morning lake harvest or want to request custom whole-fish cleaning, our retail counter team is here to assist.
        </p>
      </div>

      {/* 2. Contact Details & Hours Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '48px',
        }}
      >
        {/* Physical Location */}
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
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <MapPin size={22} color="#0284c7" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Store Counter Address
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.7', margin: '0 0 20px 0', flex: 1 }}>
            <strong style={{ color: '#0f2c59' }}>PondFish Bangalore Flagship Counter</strong><br />
            123 Fresh Lake Road, Water Town<br />
            Bangalore, Karnataka — 560001<br />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Landmark: Near Lakeside Metro Station</span>
          </p>
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#1e56a0',
              fontSize: '13px',
              fontWeight: '800',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Open in Google Maps</span>
            <ArrowRight size={14} color="#1e56a0" />
          </a>
        </div>

        {/* Operating Hours */}
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
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Clock size={22} color="#0284c7" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 12px 0' }}>
            Daily Hours & Truck Windows
          </h3>
          <div style={{ fontSize: '13px', color: '#425b73', lineHeight: '1.8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#0f2c59', fontWeight: '700' }}>Counter Retail:</span>
              <span style={{ color: '#334155', fontWeight: '600' }}>06:00 AM – 09:00 PM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#0f2c59', fontWeight: '700' }}>Fresh Truck Window:</span>
              <span style={{ color: '#047857', fontWeight: '800' }}>07:00 AM – 08:30 AM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <span style={{ color: '#0f2c59', fontWeight: '700' }}>Cleaning & Dressing:</span>
              <span style={{ color: '#64748b' }}>All operating hours</span>
            </div>
          </div>
        </div>

        {/* Phone & Inquiries */}
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
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#ecfdf5',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Phone size={22} color="#047857" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2c59', margin: '0 0 8px 0' }}>
            Customer Counter Direct
          </h3>
          <p style={{ fontSize: '14px', color: '#425b73', lineHeight: '1.6', margin: '0 0 16px 0' }}>
            Call our counter directly during operating hours for immediate stock availability:
          </p>
          <div style={{ marginBottom: '10px' }}>
            <a
              href="tel:+919876543210"
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#1e56a0',
                textDecoration: 'none',
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
                color: '#64748b',
                textDecoration: 'none',
              }}
            >
              support@pondfish.in
            </a>
          </div>
        </div>
      </div>

      {/* 3. In-Store Services Highlight */}
      <div
        style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '16px',
          padding: '32px 36px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 4px 16px rgba(30, 86, 160, 0.06)',
        }}
      >
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ fontSize: '19px', fontWeight: '900', color: '#0f2c59', margin: '0 0 6px 0' }}>
            Complimentary Custom Cutting & Cleaning
          </h3>
          <p style={{ fontSize: '14px', color: '#38536e', lineHeight: '1.6', margin: 0 }}>
            Our trained store cutters clean, scale, and cut every purchase to your exact preference: Bengali curry cut, Andhra fry steaks, boneless cubes, or whole cleaned.
          </p>
        </div>
        <Link
          href="/fish"
          style={{
            padding: '12px 24px',
            background: '#1e56a0',
            color: '#ffffff',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '800',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(30, 86, 160, 0.25)',
          }}
        >
          <span>Check Today's Catch</span>
          <ArrowRight size={14} color="#ffffff" />
        </Link>
      </div>
    </div>
  );
}
