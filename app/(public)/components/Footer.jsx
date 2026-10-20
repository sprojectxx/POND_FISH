'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Clock, Phone, Store, ShieldCheck, Tv, Globe } from './Icons';

export default function Footer() {
  return (
    <footer id="contact" className="pf-footer">
      <div className="pf-container">
        <div className="pf-footer-grid">
          {/* Column 1: Brand & Tagline */}
          <div>
            <Link href="/" className="pf-logo" style={{ textDecoration: 'none' }}>
              <span style={{ color: '#ffffff' }}>Pond</span>
              <span style={{ color: '#93CCFF' }}>Fish</span>
            </Link>
            <p style={{ marginTop: '16px', fontSize: '13px', lineHeight: '1.6', color: '#94a3b8', maxWidth: '360px' }}>
              Sustainably farmed freshwater fish, handled with traceable care from inland pond harvest to Bangalore store counter.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                fontSize: '11px',
                fontWeight: '700',
                color: '#93CCFF'
              }}>
                <Globe size={12} color="#93CCFF" />
                <span>Single Store + Dedicated Truck</span>
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links & Staff Portals */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Links
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/discounts" className="pf-footer-link">Today&apos;s Offers</Link>
              <Link href="/fish" className="pf-footer-link">Fish Catalogue</Link>
              <Link href="/subscriptions" className="pf-footer-link">Subscription Plans</Link>
              <Link href="/#how-it-works" className="pf-footer-link">How It Works</Link>
              <Link href="/about" className="pf-footer-link">About PondFish</Link>
              <Link href="/contact" className="pf-footer-link">Store Counter Contact</Link>

              <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href="/worker/login" className="pf-footer-link" style={{ color: '#93CCFF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Store size={13} color="#93CCFF" />
                  <span>Worker Tablet Portal</span>
                </Link>
                <Link href="/admin/login" className="pf-footer-link" style={{ color: '#93CCFF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={13} color="#93CCFF" />
                  <span>Admin Control Center</span>
                </Link>
                <Link href="/tv" target="_blank" className="pf-footer-link" style={{ color: '#93CCFF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tv size={13} color="#93CCFF" />
                  <span>Live Shop TV Display</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Column 3: Store Contact & Hours */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Store Location
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <MapPin size={18} color="#93CCFF" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>PondFish Flagship Store</strong><br />
                  Market Road, Indiranagar<br />
                  Bengaluru, Karnataka 560038
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={16} color="#93CCFF" />
                <span>Daily: 06:00 AM – 09:00 PM</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={16} color="#93CCFF" />
                <span>+91 98765 43210</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div>
            &copy; {new Date().getFullYear()} PondFish Digital Ecosystem. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>0–24h Cold Chain Traceability</span>
            <span>·</span>
            <span>Formalin-Free Guarantee</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
