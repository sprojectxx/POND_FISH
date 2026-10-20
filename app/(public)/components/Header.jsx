'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Download, ChevronDown, Menu, X } from './Icons';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Fish', href: '/fish' },
  { label: 'Offers', href: '/discounts' },
  { label: 'Subscriptions', href: '/subscriptions' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [fishDropdown, setFishDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setFishDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Close mobile drawer on ESC or route change
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setFishDropdown(false);
  };

  return (
    <header className="pf-header">
      <div className="pf-container">
        <div className="pf-header-inner">
          {/* Brand Logo */}
          <Link href="/" className="pf-logo" aria-label="PondFish Home" onClick={closeMenu} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '2px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 4px rgba(15, 44, 89, 0.06)'
            }}>
              <img
                src="/logo.png"
                alt="PondFish"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span>
              <span className="pf-logo-pond">Pond</span>
              <span className="pf-logo-fish">Fish</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="pf-nav-links">
            <Link href="/" className="pf-nav-link">Home</Link>

            {/* Fish Dropdown Anchor */}
            <div
              ref={dropdownRef}
              className="pf-nav-dropdown-wrapper"
              onMouseEnter={() => setFishDropdown(true)}
              onMouseLeave={() => setFishDropdown(false)}
            >
              <button
                type="button"
                className="pf-nav-link pf-nav-link-dropdown"
                onClick={() => setFishDropdown((prev) => !prev)}
                aria-expanded={fishDropdown}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <span>Fish</span>
                <ChevronDown
                  size={12}
                  style={{
                    transform: fishDropdown ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>

              {fishDropdown && (
                <div className="pf-dropdown-menu">
                  <Link href="/fish" className="pf-dropdown-item" onClick={() => setFishDropdown(false)}>All Fish Varieties</Link>
                  <Link href="/fish?category=freshwater" className="pf-dropdown-item" onClick={() => setFishDropdown(false)}>Freshwater / Pond</Link>
                  <Link href="/fish?category=marine" className="pf-dropdown-item" onClick={() => setFishDropdown(false)}>Sea Fish / Marine</Link>
                  <Link href="/fish?category=shellfish" className="pf-dropdown-item" onClick={() => setFishDropdown(false)}>Shellfish &amp; Prawns</Link>
                </div>
              )}
            </div>

            {navLinks.slice(2).map((link) => (
              <Link key={link.label} href={link.href} className="pf-nav-link">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action CTA (Desktop) */}
          <div className="pf-header-actions">
            <Link href="/#mobile-app" className="pf-btn-primary pf-btn-app" title="Download the PondFish Mobile App">
              <Download size={14} />
              <span>Download App</span>
            </Link>
          </div>

          {/* Mobile Hamburger Button (3 lines) */}
          <button
            type="button"
            className="pf-mobile-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={26} color="#0f2c59" /> : <Menu size={26} color="#0f2c59" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop & Menu mounted to body */}
      {mounted && mobileMenuOpen && createPortal(
        <div className="pf-mobile-menu-overlay" onClick={closeMenu}>
          <div className="pf-mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="pf-mobile-menu-header">
              <Link href="/" className="pf-logo" onClick={closeMenu} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '2px',
                  border: '1px solid #E2E8F0',
                }}>
                  <img
                    src="/logo.png"
                    alt="PondFish"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <span>
                  <span className="pf-logo-pond">Pond</span>
                  <span className="pf-logo-fish">Fish</span>
                </span>
              </Link>
              <button
                type="button"
                className="pf-mobile-close-btn"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                <X size={22} color="#0f2c59" />
              </button>
            </div>

            <nav className="pf-mobile-nav-list">
              <Link href="/" className="pf-mobile-nav-item" onClick={closeMenu}>
                Home
              </Link>
              <Link href="/fish" className="pf-mobile-nav-item" onClick={closeMenu}>
                All Fish Varieties
              </Link>
              <div className="pf-mobile-subnav">
                <Link href="/fish?category=freshwater" className="pf-mobile-sublink" onClick={closeMenu}>
                  • Freshwater / Pond
                </Link>
                <Link href="/fish?category=marine" className="pf-mobile-sublink" onClick={closeMenu}>
                  • Sea Fish / Marine
                </Link>
                <Link href="/fish?category=shellfish" className="pf-mobile-sublink" onClick={closeMenu}>
                  • Shellfish &amp; Prawns
                </Link>
              </div>
              <Link href="/discounts" className="pf-mobile-nav-item" onClick={closeMenu}>
                Offers &amp; Deals
              </Link>
              <Link href="/subscriptions" className="pf-mobile-nav-item" onClick={closeMenu}>
                Seafood Subscriptions
              </Link>
              <Link href="/#how-it-works" className="pf-mobile-nav-item" onClick={closeMenu}>
                How PondFish Works
              </Link>
              <Link href="/about" className="pf-mobile-nav-item" onClick={closeMenu}>
                About Us
              </Link>
              <Link href="/contact" className="pf-mobile-nav-item" onClick={closeMenu}>
                Contact Store
              </Link>
            </nav>

            <div className="pf-mobile-menu-footer">
              <Link
                href="/#mobile-app"
                className="pf-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: '14px' }}
                onClick={closeMenu}
              >
                <Download size={16} />
                <span>Download PondFish App</span>
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
