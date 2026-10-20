'use client';

import React from 'react';
import Hero from './components/Hero';
import OfferTiles from './components/OfferTiles';
import FishAvailability from './components/FishAvailability';
import SubscriptionSection from './components/SubscriptionSection';
import TruckStatus from './components/TruckStatus';
import About from './components/About';
import MobileApp from './components/MobileApp';
import HowItWorks from './components/HowItWorks';

export default function PublicHomePage() {
  return (
    <>
      <Hero />
      <OfferTiles />
      <FishAvailability />
      <SubscriptionSection />
      <TruckStatus />
      <About />
      <MobileApp />
      <HowItWorks />
    </>
  );
}
