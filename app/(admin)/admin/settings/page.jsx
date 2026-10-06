'use client';

/**
 * AP-17: Business Settings Manager
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 148–151)
 * Configuration of store contact, business operating hours, fixed truck destination,
 * geofence thresholds, fleet info, and booking lifecycle windows with audit logging.
 */

import React, { useState, useEffect, useCallback } from 'react';

const ADMIN_SECRET = 'pondfish-admin-key-2026';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [storeInfo, setStoreInfo] = useState({
    name: '',
    address: '',
    phone: '',
    openingTime: '',
    closingTime: '',
  });

  const [destination, setDestination] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    geofenceRadiusMeters: 500,
    postArrivalTrackingMinutes: 45,
  });

  const [truckInfo, setTruckInfo] = useState({
    truckNumber: '',
    driverName: '',
    coverageArea: '',
  });

  const [operationalRules, setOperationalRules] = useState({
    bookingExpiryHours: 48,
  });

  const [auditReason, setAuditReason] = useState('');

  // Elevated Confirmation Modal for Destination change
  const [pendingDestinationChange, setPendingDestinationChange] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/admin/settings', {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch settings');
      }

      const data = json.data;
      setSettings(data);

      if (data.store_info) setStoreInfo(data.store_info);
      if (data.store_destination) setDestination(data.store_destination);
      if (data.truck_info) setTruckInfo(data.truck_info);
      if (data.operational_rules) setOperationalRules(data.operational_rules);
    } catch (err) {
      console.error('[Settings Error]:', err);
      setError(err.message || 'Unable to load business settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSetting = async (key, value, reasonText, confirmed = false) => {
    try {
      setSavingKey(key);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch('/api/v1/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({
          key,
          value,
          reason: reasonText || auditReason || 'Admin updated configuration',
          confirmed: Boolean(confirmed),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Failed to update ${key}`);
      }

      setSuccessMsg(`Setting ${key} successfully updated and audited.`);
      fetchSettings();
    } catch (err) {
      console.error(`[Save ${key} Error]:`, err);
      setError(err.message || `Failed to update ${key}`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleStoreInfoSubmit = (e) => {
    e.preventDefault();
    saveSetting('store_info', storeInfo);
  };

  const handleDestinationSubmit = (e) => {
    e.preventDefault();
    // Elevated confirmation required for store destination per Section 150
    setPendingDestinationChange(destination);
    setShowConfirmModal(true);
  };

  const confirmDestinationSave = () => {
    setShowConfirmModal(false);
    if (pendingDestinationChange) {
      saveSetting('store_destination', pendingDestinationChange, 'Admin confirmed elevated destination update', true);
      setPendingDestinationChange(null);
    }
  };

  const handleTruckInfoSubmit = (e) => {
    e.preventDefault();
    saveSetting('truck_info', truckInfo);
  };

  const handleOperationalRulesSubmit = (e) => {
    e.preventDefault();
    saveSetting('operational_rules', operationalRules);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#F8FAFC' }}>
          Business & Store Settings
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>
          Centrally configure store operations, business hours, GPS destination, and lifecycle rules.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#064E3B', border: '1px solid #059669', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#A7F3D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: '#A7F3D0', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #DC2626', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#FECACA', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Audit Reason Global Input */}
      <div style={{ background: '#1E293B', padding: '16px 20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: '#94A3B8', minWidth: '130px' }}>
          Audit Reason (Optional):
        </div>
        <input
          type="text"
          placeholder="e.g., Seasonal operating hours adjustment or revised destination coordinates"
          value={auditReason}
          onChange={(e) => setAuditReason(e.target.value)}
          style={{
            flex: 1,
            background: '#0B1120',
            border: '1px solid #475569',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#F8FAFC',
            fontSize: '13px',
          }}
        />
      </div>

      {loading && !settings ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
          Loading business configuration...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
          {/* 1. STORE INFO & BUSINESS HOURS */}
          <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: '0 0 16px 0' }}>
              🏪 Store Info & Business Hours
            </h2>
            <form onSubmit={handleStoreInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Store Name</label>
                <input
                  type="text"
                  required
                  value={storeInfo.name}
                  onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Address</label>
                <input
                  type="text"
                  required
                  value={storeInfo.address}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Contact Phone</label>
                <input
                  type="text"
                  required
                  value={storeInfo.phone}
                  onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Opening Time</label>
                  <input
                    type="text"
                    required
                    placeholder="06:00 AM"
                    value={storeInfo.openingTime}
                    onChange={(e) => setStoreInfo({ ...storeInfo, openingTime: e.target.value })}
                    style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Closing Time</label>
                  <input
                    type="text"
                    required
                    placeholder="09:00 PM"
                    value={storeInfo.closingTime}
                    onChange={(e) => setStoreInfo({ ...storeInfo, closingTime: e.target.value })}
                    style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'store_info'}
                  style={{
                    background: '#38BDF8',
                    color: '#0B1120',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {savingKey === 'store_info' ? 'Saving...' : 'Save Store Info'}
                </button>
              </div>
            </form>
          </div>

          {/* 2. STORE DESTINATION & GEOFENCE */}
          <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: 0 }}>
                📍 Truck Destination & Geofence
              </h2>
              <span style={{ fontSize: '11px', background: '#78350F', color: '#FDE68A', padding: '3px 8px', borderRadius: '4px' }}>
                Elevated Action
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px 0' }}>
              Centrally configured store coordinate used as destination for truck tracking and automatic geofenced arrival.
            </p>
            <form onSubmit={handleDestinationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Destination Name</label>
                <input
                  type="text"
                  required
                  value={destination.name}
                  onChange={(e) => setDestination({ ...destination, name: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Latitude (-90 to 90)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={destination.latitude}
                    onChange={(e) => setDestination({ ...destination, latitude: e.target.value })}
                    style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Longitude (-180 to 180)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={destination.longitude}
                    onChange={(e) => setDestination({ ...destination, longitude: e.target.value })}
                    style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Geofence Radius (meters)</label>
                  <input
                    type="number"
                    min="50"
                    max="10000"
                    required
                    value={destination.geofenceRadiusMeters}
                    onChange={(e) => setDestination({ ...destination, geofenceRadiusMeters: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Post-Arrival Window (30–60 mins)</label>
                  <input
                    type="number"
                    min="30"
                    max="60"
                    required
                    value={destination.postArrivalTrackingMinutes}
                    onChange={(e) => setDestination({ ...destination, postArrivalTrackingMinutes: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'store_destination'}
                  style={{
                    background: '#F59E0B',
                    color: '#0B1120',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {savingKey === 'store_destination' ? 'Saving...' : 'Review & Update Destination'}
                </button>
              </div>
            </form>
          </div>

          {/* 3. FLEET & TRUCK CONFIGURATION */}
          <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: '0 0 16px 0' }}>
              🚛 Fleet & Vehicle Information
            </h2>
            <form onSubmit={handleTruckInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Default Truck Number</label>
                <input
                  type="text"
                  required
                  value={truckInfo.truckNumber}
                  onChange={(e) => setTruckInfo({ ...truckInfo, truckNumber: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Default Driver Name</label>
                <input
                  type="text"
                  required
                  value={truckInfo.driverName}
                  onChange={(e) => setTruckInfo({ ...truckInfo, driverName: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Coverage Area</label>
                <input
                  type="text"
                  value={truckInfo.coverageArea}
                  onChange={(e) => setTruckInfo({ ...truckInfo, coverageArea: e.target.value })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'truck_info'}
                  style={{
                    background: '#38BDF8',
                    color: '#0B1120',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {savingKey === 'truck_info' ? 'Saving...' : 'Save Truck Info'}
                </button>
              </div>
            </form>
          </div>

          {/* 4. OPERATIONAL LIFECYCLE RULES */}
          <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', margin: '0 0 16px 0' }}>
              ⏱️ Operational Lifecycle Rules
            </h2>
            <form onSubmit={handleOperationalRulesSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  Online Booking Expiry Window (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  required
                  value={operationalRules.bookingExpiryHours}
                  onChange={(e) => setOperationalRules({ ...operationalRules, bookingExpiryHours: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: '#0B1120', border: '1px solid #475569', borderRadius: '6px', padding: '8px 12px', color: '#F8FAFC' }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Standard PondFish authoritative rule is 48 hours before reserved stock is released.
                </span>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'operational_rules'}
                  style={{
                    background: '#38BDF8',
                    color: '#0B1120',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {savingKey === 'operational_rules' ? 'Saving...' : 'Save Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ELEVATED CONFIRMATION MODAL (Section 150 & 151) */}
      {showConfirmModal && pendingDestinationChange && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1E293B', border: '1px solid #F59E0B', borderRadius: '12px', padding: '28px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#F59E0B', margin: '0 0 12px 0' }}>
              ⚠️ Confirm Store Destination Change
            </h3>
            <p style={{ fontSize: '13px', color: '#E2E8F0', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Changing the store destination will affect future truck journeys and GPS geofenced arrival behavior.
            </p>

            <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '8px', color: '#94A3B8' }}>
                <strong>Old Destination:</strong> {settings?.store_destination?.name || 'Default Store'} ({settings?.store_destination?.latitude}, {settings?.store_destination?.longitude})
              </div>
              <div style={{ color: '#F8FAFC' }}>
                <strong>New Destination:</strong> {pendingDestinationChange.name} ({pendingDestinationChange.latitude}, {pendingDestinationChange.longitude})
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#94A3B8' }}>
                Geofence Radius: {pendingDestinationChange.geofenceRadiusMeters}m | Window: {pendingDestinationChange.postArrivalTrackingMinutes} mins
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => { setShowConfirmModal(false); setPendingDestinationChange(null); }}
                style={{ background: '#334155', color: '#F8FAFC', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDestinationSave}
                style={{ background: '#F59E0B', color: '#0B1120', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
