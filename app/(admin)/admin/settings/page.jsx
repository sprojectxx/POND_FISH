'use client';

/**
 * AP-17: Business Settings Manager
 * Traceability: PondFish Master PRD v2 & Page-by-Page UI Specification Admin Portal (Section 148–151)
 * Configuration of store contact, business operating hours, fixed truck destination,
 * geofence thresholds, fleet info, and booking lifecycle windows with audit logging.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminSubNav } from '@/components/ui';

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

  // Lock body scroll and handle Escape key when confirmation modal is open
  useEffect(() => {
    if (!showConfirmModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowConfirmModal(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showConfirmModal]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/admin/settings');

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/settings';
        return;
      }

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
        },
        body: JSON.stringify({
          key,
          value,
          reason: reasonText || auditReason || 'Admin updated configuration',
          confirmed: Boolean(confirmed),
        }),
      });

      if (res.status === 401) {
        window.location.href = '/admin/login?redirect=/admin/settings';
        return;
      }

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
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Store Operations', href: '/admin/settings', exact: true },
          { label: 'Reports & Exports', href: '/admin/reports' },
          { label: 'Activity Log', href: '/admin/audit' },
          { label: 'Order Alerts', href: '/admin/exceptions' },
          { label: 'Security & Passwords', href: '/admin/security' },
          { label: 'My Profile', href: '/admin/profile' },
        ]}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Store Operations &amp; Business Rules
          </h1>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#0F2C59',
            height: '36px',
            padding: '0 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <svg
            className={loading ? 'pf-animate-spin' : ''}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#065F46', fontSize: '13px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#991B1B', fontSize: '13px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {/* Audit Reason Global Input Card */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#1E56A0', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '150px' }}>
          Audit Reason (Optional):
        </div>
        <input
          type="text"
          placeholder="e.g., Seasonal operating hours adjustment or revised destination coordinates"
          value={auditReason}
          onChange={(e) => setAuditReason(e.target.value)}
          style={{
            flex: 1,
            minWidth: '240px',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '9px 12px',
            color: '#0F2C59',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {loading && !settings ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
          Loading business configuration...
        </div>
      ) : (
        <div
          className="pf-admin-twin-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}
        >
          {/* 1. STORE INFO & BUSINESS HOURS */}
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: '0 0 16px 0' }}>
              Store Info &amp; Operating Hours
            </h2>
            <form onSubmit={handleStoreInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Store Name</label>
                <input
                  type="text"
                  required
                  value={storeInfo.name}
                  onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Address</label>
                <input
                  type="text"
                  required
                  value={storeInfo.address}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Contact Phone</label>
                <input
                  type="text"
                  required
                  value={storeInfo.phone}
                  onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Opening Time</label>
                  <input
                    type="text"
                    required
                    placeholder="06:00 AM"
                    value={storeInfo.openingTime}
                    onChange={(e) => setStoreInfo({ ...storeInfo, openingTime: e.target.value })}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Closing Time</label>
                  <input
                    type="text"
                    required
                    placeholder="09:00 PM"
                    value={storeInfo.closingTime}
                    onChange={(e) => setStoreInfo({ ...storeInfo, closingTime: e.target.value })}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'store_info'}
                  style={{
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: savingKey === 'store_info' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {savingKey === 'store_info' ? 'Saving...' : 'Save Store Info'}
                </button>
              </div>
            </form>
          </div>

          {/* 2. STORE DESTINATION & GEOFENCE */}
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
                Truck Destination &amp; Geofence
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '700', background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: '9999px' }}>
                Elevated Action
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              Centrally configured store coordinate used as destination for truck tracking and automatic geofenced arrival.
            </p>
            <form onSubmit={handleDestinationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Destination Name</label>
                <input
                  type="text"
                  required
                  value={destination.name}
                  onChange={(e) => setDestination({ ...destination, name: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Latitude (-90 to 90)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={destination.latitude}
                    onChange={(e) => setDestination({ ...destination, latitude: e.target.value })}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Longitude (-180 to 180)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={destination.longitude}
                    onChange={(e) => setDestination({ ...destination, longitude: e.target.value })}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Geofence Radius (meters)</label>
                  <input
                    type="number"
                    min="50"
                    max="10000"
                    required
                    value={destination.geofenceRadiusMeters}
                    onChange={(e) => setDestination({ ...destination, geofenceRadiusMeters: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Post-Arrival Window (30–60 mins)</label>
                  <input
                    type="number"
                    min="30"
                    max="60"
                    required
                    value={destination.postArrivalTrackingMinutes}
                    onChange={(e) => setDestination({ ...destination, postArrivalTrackingMinutes: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'store_destination'}
                  style={{
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: savingKey === 'store_destination' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {savingKey === 'store_destination' ? 'Saving...' : 'Review & Update Destination'}
                </button>
              </div>
            </form>
          </div>

          {/* 3. FLEET & TRUCK CONFIGURATION */}
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: '0 0 16px 0' }}>
              Fleet &amp; Vehicle Information
            </h2>
            <form onSubmit={handleTruckInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Default Truck Number</label>
                <input
                  type="text"
                  required
                  value={truckInfo.truckNumber}
                  onChange={(e) => setTruckInfo({ ...truckInfo, truckNumber: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Default Driver Name</label>
                <input
                  type="text"
                  required
                  value={truckInfo.driverName}
                  onChange={(e) => setTruckInfo({ ...truckInfo, driverName: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Coverage Area</label>
                <input
                  type="text"
                  value={truckInfo.coverageArea}
                  onChange={(e) => setTruckInfo({ ...truckInfo, coverageArea: e.target.value })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'truck_info'}
                  style={{
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: savingKey === 'truck_info' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {savingKey === 'truck_info' ? 'Saving...' : 'Save Truck Info'}
                </button>
              </div>
            </form>
          </div>

          {/* 4. STORE OPERATING RULES */}
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: '0 0 16px 0' }}>
              Store Operating Rules
            </h2>
            <form onSubmit={handleOperationalRulesSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Online Booking Expiry Window (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  required
                  value={operationalRules.bookingExpiryHours}
                  onChange={(e) => setOperationalRules({ ...operationalRules, bookingExpiryHours: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', display: 'block' }}>
                  Standard PondFish authoritative rule is 48 hours before reserved stock is released.
                </span>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingKey === 'operational_rules'}
                  style={{
                    background: '#1E56A0',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: savingKey === 'operational_rules' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                    transition: 'all 0.15s ease',
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
        <div
          onClick={() => setShowConfirmModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 44, 89, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(15, 44, 89, 0.15)',
              overscrollBehavior: 'contain',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F2C59', margin: '0 0 12px 0' }}>
              Confirm Store Destination Change
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Changing the store destination will affect future truck journeys and GPS geofenced arrival behavior.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '8px', color: '#64748B' }}>
                <strong style={{ color: '#0F2C59' }}>Old Destination:</strong> {settings?.store_destination?.name || 'Default Store'} ({settings?.store_destination?.latitude}, {settings?.store_destination?.longitude})
              </div>
              <div style={{ color: '#1E56A0', fontWeight: '600' }}>
                <strong style={{ color: '#0F2C59' }}>New Destination:</strong> {pendingDestinationChange.name} ({pendingDestinationChange.latitude}, {pendingDestinationChange.longitude})
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B' }}>
                Geofence Radius: {pendingDestinationChange.geofenceRadiusMeters}m | Window: {pendingDestinationChange.postArrivalTrackingMinutes} mins
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); setPendingDestinationChange(null); }}
                style={{
                  background: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDestinationSave}
                style={{
                  background: '#1E56A0',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                  transition: 'all 0.15s ease',
                }}
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
