'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FishIcon, ChevronLeft, ChevronRight } from './Icons';

const TELUGU_NAMES = {
  'ROHU': 'రోహు',
  'BOCHE': 'బొచ్చె',
  'KORAMENU': 'కొరమీను',
  'KORAMENU DEAD': 'కొరమీను',
  'APPOLLO BONE LESS': 'అపోలో బోన్‌లెస్',
  'BANGDA': 'బంగ్డా (కనగుర్తులు)',
  'TILAPIA WHOLE FISH': 'తిలాపియా',
  'TILAPIA': 'తిలాపియా',
  'NETHILLI SEA FOOD': 'నెత్తిళ్ళు',
  'NETHILLI': 'నెత్తిళ్ళు',
  'VANJARAM': 'వంజరం (సీర్ ఫిష్)',
  'TUNA': 'ట్యూనా',
  'WHITE PALMPHLETE': 'తెల్ల చందమామ (పాంఫ్రెట్)',
  'SEA BASS (PANDUGAPPA)': 'పండుగప్ప (సీ బాస్)',
  'SEA BASS': 'పండుగప్ప',
  'TIGER PRAWNS': 'టైగర్ రొయ్యలు',
  'PRAWNS SMALL/MED/LARGE': 'రొయ్యలు (పచ్చి రొయ్యలు)',
  'BLUE CRABS SEA FOOD': 'పీతలు',
  'BLUE CRABS': 'పీతలు',
  'ICE FISH 1 & 2': 'ఐస్ ఫిష్',
  'ICE FISH': 'ఐస్ ఫిష్',
  'LIVE (D)': 'లైవ్ క్యాచ్ (జీవ చేప)',
  'Lake Katla': 'కట్ల',
};

export default function FishAvailability() {
  const [activeTab, setActiveTab] = useState('All Fish');
  const [fishList, setFishList] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    async function fetchLiveFish() {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/public/fish');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setFishList(json.data);
          }
        }
      } catch (e) {
        console.error('Failed to load fish catalogue:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveFish();
  }, []);

  const categories = ['All Fish', 'Freshwater Fish', 'Sea Fish / Marine', 'Shellfish & Prawns'];

  const filteredFish = activeTab === 'All Fish'
    ? fishList
    : fishList.filter((item) => (
        (item.categoryName && item.categoryName.toLowerCase() === activeTab.toLowerCase()) ||
        (item.category_name && item.category_name.toLowerCase() === activeTab.toLowerCase())
      ));

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollAmount = direction === 'left' ? -containerWidth : containerWidth;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  return (
    <section id="fish-availability" style={{ padding: '64px 0', backgroundColor: '#f4fafc', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        {/* Section Heading with Carousel Controls */}
        <div className="pf-section-head">
          <div>
            <p className="pf-eyebrow">FRESH FROM OUR STORE COUNTER</p>
            <h2 className="pf-section-title">Fresh fish, clear prices.</h2>
          </div>

          <div className="pf-carousel-nav">
            <span className="pf-carousel-badge">
              {filteredFish.length} varieties today
            </span>
            <div className="pf-carousel-arrows">
              <button
                type="button"
                onClick={() => scroll('left')}
                className="pf-carousel-arrow-btn"
                aria-label="Previous fish"
                title="Scroll previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                className="pf-carousel-arrow-btn"
                aria-label="Next fish"
                title="Scroll next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="pf-filter-tabs">
          {categories.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`pf-tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Fish Cards Grid / Single-card horizontal scroll carousel on mobile */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
            Loading store counter catch...
          </div>
        ) : filteredFish.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            No varieties listed in this category right now.
          </div>
        ) : (
          <div ref={scrollContainerRef} className="pf-fish-grid">
            {filteredFish.map((fish) => {
              const price = fish.unitPrice || fish.unit_price || (fish.pricing && (fish.pricing.effectivePrice || fish.pricing.basePrice)) || null;
              const telugu = TELUGU_NAMES[fish.name.toUpperCase()] || TELUGU_NAMES[fish.name] || '';
              const category = fish.categoryName || fish.category_name || 'Fresh catch';

              return (
                <article key={fish.id} className="pf-fish-card">
                  {/* Image Container */}
                  <div className="pf-fish-card-imgwrap">
                    <span className="pf-fish-card-tag">
                      {fish.freshness_state === 'PEAK_FRESH' || fish.freshness_state === 'GREEN' || (fish.freshness && fish.freshness.state === 'GREEN') ? '0–24H FRESH' : 'COUNTER FRESH'}
                    </span>

                    {(fish.imageUrl || fish.image_url) ? (
                      <img
                        src={fish.imageUrl || fish.image_url}
                        alt={fish.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          padding: '12px',
                          transition: 'transform 0.3s ease'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.parentElement) {
                            const fallback = e.currentTarget.parentElement.querySelector('.pf-fallback-icon');
                            if (fallback) fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}

                    <div
                      className="pf-fallback-icon"
                      style={{
                        display: (fish.imageUrl || fish.image_url) ? 'none' : 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <FishIcon size={38} color="#94a3b8" />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                        {category}
                      </span>
                    </div>
                  </div>

                  <div className="pf-fish-card-body">
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                      <h3 className="pf-fish-card-name">{fish.name}</h3>
                      {telugu && <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e56a0' }}>{telugu}</span>}
                    </div>
                    <p className="pf-fish-card-telugu">{telugu ? `${telugu} • ${category}` : category}</p>

                    <div className="pf-freshness-pill">
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                      <span>0–24h Cold Chain Fresh</span>
                    </div>

                    <div className="pf-fish-card-bottom">
                      <div>
                        {price ? (
                          <>
                            <span className="pf-fish-card-price">₹{price}</span>
                            <span className="pf-fish-card-unit">/ KG</span>
                          </>
                        ) : (
                          <span className="pf-fish-card-unit" style={{ fontSize: '13px', fontWeight: '700', color: '#1e56a0' }}>
                            Counter Price
                          </span>
                        )}
                      </div>

                      <Link href={`/booking?fishId=${fish.id}`} className="pf-btn-book">
                        Reserve Info
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
