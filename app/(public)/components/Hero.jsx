'use client';

import React from 'react';
import { ArrowRight, Check } from './Icons';

export default function Hero() {
  return (
    <section id="home" className="pf-hero-full">
      {/* Desktop Full-Bleed Banner Layer */}
      <div className="pf-hero-bg-desktop">
        <img
          src="https://urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/banner.png"
          alt="Fresh fish catch on lake"
          className="pf-hero-img-desktop"
        />
        <div className="pf-hero-gradient-desktop" />
      </div>

      {/* Mobile Full-Bleed Banner Layer */}
      <div className="pf-hero-bg-mobile">
        <img
          src="https://urkxrefqtrwjfttrukhw.supabase.co/storage/v1/object/public/fish-assets/banner_phone.png"
          alt="Fresh fish catch on lake"
          className="pf-hero-img-mobile"
        />
        <div className="pf-hero-gradient-mobile" />
      </div>

      {/* Content Container (Layered above the background and gradient) */}
      <div className="pf-hero-content-wrap">
        <div className="pf-hero-copy">
          <h1 className="pf-hero-title">
            Fresh <span className="pf-cyan">&amp;</span>
            <span className="pf-block-cyan">Live Fish</span>
          </h1>

          <p className="pf-hero-desc">
            Freshwater fish harvested today, handled with care in 2°C–4°C cold chain, and ready at your local PondFish counter.
          </p>

          <div className="pf-hero-ctas">
            <a href="#fish-availability" className="pf-btn-primary">
              <span>See today&apos;s fish</span>
              <ArrowRight size={16} />
            </a>
            <a href="#how-it-works" className="pf-hero-how-link">
              How PondFish works
            </a>
          </div>

          <div className="pf-hero-checks">
            <span className="pf-hero-check-item">
              <Check size={16} color="#159c57" />
              <span>Harvested every morning</span>
            </span>
            <span className="pf-hero-check-item">
              <Check size={16} color="#159c57" />
              <span>48-Hour Fresh Guarantee</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
