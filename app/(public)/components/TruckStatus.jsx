'use client';

/**
 * Truck Replenishment Status Component
 * Traceability: PondFish Master PRD v2 (Section 22)
 * Binds to authoritative backend delivery status (/api/v1/public/truck/status).
 * Strictly removes fabricated sample ETAs, fake temperatures, and hardcoded truck location.
 */

import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Thermometer, Clock } from './Icons';

export default function TruckStatus() {
  const [truckData, setTruckData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchStatus() {
      try {
        const res = await fetch('/api/v1/public/truck/status');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.data) {
            setTruckData(json.data);
          }
        }
      } catch {
        // Fallback gracefully on network error
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const isActive = truckData && truckData.active;
  const isArrived = truckData && truckData.isArrived;

  return (
    <section id="truck-status" style={{ padding: '40px 0', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      <div className="pf-container">
        <div className="pf-truck-card">
          <div className="pf-truck-left">
            <div className="pf-truck-icon-box">
              <Truck size={22} color="#1e56a0" />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '0.12em', color: '#1e56a0', textTransform: 'uppercase', marginBottom: '4px' }}>
                {isActive ? "TODAY'S LIVE REPLENISHMENT JOURNEY" : 'COLD CHAIN REPLENISHMENT'}
              </p>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f2c59', marginBottom: '4px' }}>
                {isActive
                  ? `${truckData.truckNumber || 'Replenishment Truck'} is ${isArrived ? 'arrived at' : 'en route to'} ${truckData.destination?.name || 'PondFish Store'}${truckData.origin?.name ? ` from ${truckData.origin.name}` : ''}`
                  : 'Daily morning harvest transit from regional Andhra & coastal ponds'}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                {isActive
                  ? `Status: ${truckData.status || (isArrived ? 'Arrived' : 'In Transit')} · Store counter updates availability upon weigh-in intake.`
                  : 'Live GPS telemetry and journey tracking activate during morning delivery runs to our Bangalore retail counter.'}
              </p>
            </div>
          </div>

          <div className="pf-truck-telemetry">
            <span className="pf-truck-telemetry-item">
              <MapPin size={14} color="#3d84a8" />
              <span>{isActive ? (isArrived ? 'At Bangalore Store' : 'GPS Active') : 'GPS Gate Controlled'}</span>
            </span>
            <span className="pf-truck-telemetry-item">
              <Thermometer size={14} color="#1e56a0" />
              <span>Cold chain insulated transit</span>
            </span>
            <span className="pf-truck-telemetry-item">
              <Clock size={14} color="#1e56a0" />
              <span>{isActive ? (isArrived ? 'Weigh-in Intake' : 'Morning Delivery') : 'Direct Harvest Daily'}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
