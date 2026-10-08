'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #1E293B',
      width: '100%'
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '0 24px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand Logo & Tagline */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: '900',
            fontSize: '20px'
          }}>
            🐟
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', color: '#F8FAFC' }}>
              POND<span style={{ color: '#38BDF8' }}>FISH</span>
            </span>
            <span style={{ display: 'block', fontSize: '11px', color: '#94A3B8', fontWeight: '500', marginTop: '-2px' }}>
              Fresh Lake Catch Daily
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }} className="pf-desktop-nav">
          <Link href="/" style={{ fontSize: '14px', fontWeight: '600', color: '#F8FAFC', transition: 'color 0.2s' }}>
            Home
          </Link>
          <Link href="/fish" style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', transition: 'color 0.2s' }}>
            Fish Catalogue
          </Link>
          <Link href="/categories" style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', transition: 'color 0.2s' }}>
            Categories
          </Link>
          <Link href="/discounts" style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', transition: 'color 0.2s' }}>
            Offers
          </Link>
          <Link href="/subscriptions" style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', transition: 'color 0.2s' }}>
            Subscriptions
          </Link>
          <Link href="/about" style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', transition: 'color 0.2s' }}>
            About
          </Link>
          <Link href="/contact" style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', transition: 'color 0.2s' }}>
            Store & Contact
          </Link>
        </nav>

        {/* Right CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            href="/fish"
            style={{
              padding: '10px 20px',
              background: '#0284C7',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              transition: 'background 0.2s'
            }}
          >
            <span>Browse Fish</span>
            <span>&rarr;</span>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#F8FAFC',
              cursor: 'pointer',
              display: 'none'
            }}
            className="pf-mobile-toggle"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          background: '#0B1120',
          borderTop: '1px solid #1E293B',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Link href="/" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#F8FAFC' }}>
            Home
          </Link>
          <Link href="/fish" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#94A3B8' }}>
            Fish Catalogue
          </Link>
          <Link href="/categories" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#94A3B8' }}>
            Categories
          </Link>
          <Link href="/discounts" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#94A3B8' }}>
            Special Offers
          </Link>
          <Link href="/subscriptions" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#94A3B8' }}>
            Subscription Plans
          </Link>
          <Link href="/about" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#94A3B8' }}>
            Our Sourcing & Guarantee
          </Link>
          <Link href="/contact" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', fontWeight: '600', color: '#94A3B8' }}>
            Store Hours & Location
          </Link>
        </div>
      )}
    </header>
  );
}
