'use client';

import React from 'react';
import { Truck, MapPin, Thermometer, Clock } from './Icons';

export default function TruckStatus() {
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
                TODAY&apos;S REPLENISHMENT JOURNEY
              </p>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f2c59', marginBottom: '4px' }}>
                Truck #1 is en route from Nellore Ponds to PondFish Store
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b' }}>
                Last published update: 8:30 AM · Availability updates when counter completes weigh-in intake.
              </p>
            </div>
          </div>

          <div className="pf-truck-telemetry">
            <span className="pf-truck-telemetry-item">
              <MapPin size={14} color="#3d84a8" />
              <span>GPS live telemetry</span>
            </span>
            <span className="pf-truck-telemetry-item">
              <Thermometer size={14} color="#1e56a0" />
              <span>Cold chain 2.0°C – 4.0°C</span>
            </span>
            <span className="pf-truck-telemetry-item">
              <Clock size={14} color="#1e56a0" />
              <span>ETA 35 min</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
