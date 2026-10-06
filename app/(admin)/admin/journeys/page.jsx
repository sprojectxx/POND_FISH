'use client';

/**
 * AP-14: Truck Journeys & GPS Publishing Manager
 * Traceability: PondFish Master PRD v2 (Section 22), Admin Portal Specification (Section 118–130)
 * Admin portal module for managing truck deliveries, fish manifests,
 * customer publication gate, live telemetry inspection, and geofenced arrival.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

const ADMIN_SECRET = 'pondfish-admin-key-2026';

export default function AdminJourneysPage() {
  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);

  // Create Journey Form
  const [createForm, setCreateForm] = useState({
    truckNumber: '',
    driverName: '',
    originName: '',
    originLat: '',
    originLng: '',
    destinationName: 'PondFish Main Store',
    destinationAddress: '123 Fresh Lake Road, Water Town, AP',
    destinationLat: '',
    destinationLng: '',
    geofenceRadiusMeters: 500,
    fishItems: [
      { fishName: '', quantityKg: '' },
    ],
  });

  // GPS Ingestion Form
  const [ingestForm, setIngestForm] = useState({
    latitude: '',
    longitude: '',
    speed: '',
    heading: '',
  });

  const wsRef = useRef(null);

  // Fetch all journeys
  const fetchJourneys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/admin/gps/journeys', {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });
      const data = await res.json();
      if (data.success) {
        setJourneys(data.data || []);
        if (data.data?.length > 0 && !selectedJourney) {
          fetchJourneyDetail(data.data[0].id);
        }
      } else {
        setError(data.error?.message || 'Failed to load journeys');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedJourney]);

  // Fetch single journey detail
  const fetchJourneyDetail = async (id) => {
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}`, {
        headers: { 'x-admin-key': ADMIN_SECRET },
      });
      const data = await res.json();
      if (data.success) {
        setSelectedJourney(data.data);
      }
    } catch (err) {
      console.error('Failed to load journey detail:', err);
    }
  };

  // WebSocket connection for live telemetry
  useEffect(() => {
    fetchJourneys();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/realtime`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'gps:live' || msg.event === 'successful_transaction') {
            // Live GPS update received! Refresh detail
            if (selectedJourney && msg.data?.journeyId === selectedJourney.journey?.id) {
              fetchJourneyDetail(selectedJourney.journey.id);
            }
          }
        } catch (e) {
          // ignore
        }
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (e) {
      console.warn('Realtime WS unavailable, using standard refresh');
    }
  }, []);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Create Journey Submit
  const handleCreateJourney = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        truckNumber: createForm.truckNumber,
        driverName: createForm.driverName,
        origin: {
          name: createForm.originName,
          latitude: parseFloat(createForm.originLat),
          longitude: parseFloat(createForm.originLng),
        },
        destination: {
          name: createForm.destinationName,
          address: createForm.destinationAddress,
          latitude: parseFloat(createForm.destinationLat),
          longitude: parseFloat(createForm.destinationLng),
          geofenceRadiusMeters: parseInt(createForm.geofenceRadiusMeters, 10),
        },
        fishManifest: createForm.fishItems.filter(item => item.fishName && item.quantityKg > 0),
      };

      const res = await fetch('/api/v1/admin/gps/journeys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showNotification('GPS Journey created successfully in DRAFT state!');
        setShowCreateModal(false);
        fetchJourneys();
        fetchJourneyDetail(data.data.id);
      } else {
        alert(data.error?.message || 'Create failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Start Journey
  const handleStartJourney = async (id) => {
    if (!confirm('Start this journey? This will activate GPS monitoring.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}/start`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_SECRET },
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Journey started! Status changed to LIVE.');
        fetchJourneys();
        fetchJourneyDetail(id);
      } else {
        alert(data.error?.message || 'Start failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Customer Publication
  const handleTogglePublication = async (id, currentPublished) => {
    const nextPublished = !currentPublished;
    const confirmText = nextPublished
      ? 'Publish live tracking to customer mobile app?'
      : 'Unpublish live tracking from customers?';
    if (!confirm(confirmText)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({ published: nextPublished }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(nextPublished ? 'Live tracking published to customers!' : 'Customer tracking unpublished.');
        fetchJourneys();
        fetchJourneyDetail(id);
      } else {
        alert(data.error?.message || 'Publication update failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Stop Journey
  const handleStopJourney = async (id) => {
    if (!confirm('Stop this journey? This will conclude telemetry and close customer tracking.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}/stop`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_SECRET },
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Journey stopped successfully.');
        fetchJourneys();
        fetchJourneyDetail(id);
      } else {
        alert(data.error?.message || 'Stop failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Close Customer Tracking
  const handleCloseTracking = async (id) => {
    if (!confirm('Close customer tracking now? Customer app will stop showing live location.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}/close-tracking`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_SECRET },
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Customer tracking closed.');
        fetchJourneys();
        fetchJourneyDetail(id);
      } else {
        alert(data.error?.message || 'Close tracking failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Ingest GPS Position Telemetry
  const handleIngestPosition = async (e) => {
    e.preventDefault();
    if (!selectedJourney) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${selectedJourney.journey.id}/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({
          latitude: parseFloat(ingestForm.latitude),
          longitude: parseFloat(ingestForm.longitude),
          speed: parseFloat(ingestForm.speed),
          heading: parseFloat(ingestForm.heading),
          recordedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Position recorded!');
        setShowIngestModal(false);
        fetchJourneyDetail(selectedJourney.journey.id);
        fetchJourneys();
      } else {
        alert(data.error?.message || 'Ingestion failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Add / remove fish item in create modal
  const addFishItem = () => {
    setCreateForm({
      ...createForm,
      fishItems: [...createForm.fishItems, { fishName: '', quantityKg: 50 }],
    });
  };

  const updateFishItem = (index, field, value) => {
    const updated = [...createForm.fishItems];
    updated[index][field] = field === 'quantityKg' ? parseFloat(value) || 0 : value;
    setCreateForm({ ...createForm, fishItems: updated });
  };

  const removeFishItem = (index) => {
    const updated = createForm.fishItems.filter((_, i) => i !== index);
    setCreateForm({ ...createForm, fishItems: updated });
  };

  const currentJourney = selectedJourney?.journey;
  const latestPos = selectedJourney?.latestPosition;

  return (
    <div style={{ color: '#F8FAFC', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Notifications */}
      {successMsg && (
        <div style={{
          background: '#065F46',
          border: '1px solid #10B981',
          color: '#ECFDF5',
          padding: '12px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '500',
        }}>
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          background: '#991B1B',
          border: '1px solid #EF4444',
          color: '#FEF2F2',
          padding: '12px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#38BDF8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            AP-14 Management Console
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#F8FAFC', margin: '4px 0 0 0' }}>
            Truck Journeys & GPS Publishing Manager
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>+</span> Create Journey
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#1E293B', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
            Total Journeys
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>
            {journeys.length}
          </div>
        </div>

        <div style={{ background: '#1E293B', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
            Customer Published
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>
            {journeys.filter(j => j.published_to_customer && !j.customer_tracking_closed_at).length}
          </div>
        </div>

        <div style={{ background: '#1E293B', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
            OneLap Provider Adapter
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#F59E0B' }}>
            {selectedJourney?.providerStatus?.status === 'READY' ? '🟢 READY' : '🟡 UNCONFIGURED (STANDBY)'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Hardware Ingestion Ready
          </div>
        </div>

        <div style={{ background: '#1E293B', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
            Store Geofence Radius
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38BDF8' }}>
            500 m
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Auto-detects arrival & 45m timer
          </div>
        </div>
      </div>

      {/* Main Grid: Left List (40%), Right Detail & Telemetry (60%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px' }}>
        {/* Left Column: Journeys List */}
        <div style={{ background: '#1E293B', borderRadius: '8px', border: '1px solid #334155', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Registered Journeys</h2>
            <button
              onClick={fetchJourneys}
              style={{ background: 'transparent', border: 'none', color: '#38BDF8', cursor: 'pointer', fontSize: '13px' }}
            >
              ↻ Refresh
            </button>
          </div>

          {loading && journeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>Loading journeys...</div>
          ) : journeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
              No journeys recorded yet.<br />
              <button
                onClick={() => setShowCreateModal(true)}
                style={{ marginTop: '12px', background: '#0284C7', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Create First Journey
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '720px', overflowY: 'auto' }}>
              {journeys.map((j) => {
                const isSelected = selectedJourney?.journey?.id === j.id;
                return (
                  <div
                    key={j.id}
                    onClick={() => fetchJourneyDetail(j.id)}
                    style={{
                      background: isSelected ? '#0F172A' : '#1E293B',
                      border: isSelected ? '2px solid #38BDF8' : '1px solid #334155',
                      padding: '14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#F8FAFC' }}>
                        🚛 {j.truck_number}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background:
                            j.status === 'LIVE' ? '#065F46' :
                            j.status === 'STOPPED' ? '#334155' :
                            j.status === 'CANCELLED' ? '#991B1B' : '#854D0E',
                          color: '#FFFFFF',
                        }}
                      >
                        {j.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                      Driver: <strong style={{ color: '#E2E8F0' }}>{j.driver_name}</strong>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                      From: {j.origin?.name || 'Harbor'} → Store
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #334155' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: j.published_to_customer ? '#22C55E' : '#64748B',
                        }}
                      >
                        {j.published_to_customer ? '● Published to App' : '○ Private to Admin'}
                      </span>
                      {j.customer_tracking_closed_at && (
                        <span style={{ fontSize: '10px', color: '#F59E0B' }}>Closed post-arrival</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Journey Inspection & Live Controls */}
        <div style={{ background: '#1E293B', borderRadius: '8px', border: '1px solid #334155', padding: '24px' }}>
          {!selectedJourney ? (
            <div style={{ textAlign: 'center', padding: '64px', color: '#94A3B8' }}>
              Select a journey from the list on the left to inspect live GPS telemetry.
            </div>
          ) : (
            <div>
              {/* Journey Title & Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                    Journey ID: <code>{currentJourney.id}</code>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#F8FAFC', margin: '4px 0 0 0' }}>
                    Truck {currentJourney.truck_number} — {currentJourney.driver_name}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentJourney.status === 'DRAFT' && (
                    <button
                      onClick={() => handleStartJourney(currentJourney.id)}
                      disabled={actionLoading}
                      style={{
                        background: '#16A34A',
                        color: '#FFF',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      ▶ Start Journey
                    </button>
                  )}

                  {currentJourney.status === 'LIVE' && (
                    <>
                      <button
                        onClick={() => handleTogglePublication(currentJourney.id, currentJourney.published_to_customer)}
                        disabled={actionLoading}
                        style={{
                          background: currentJourney.published_to_customer ? '#475569' : '#0284C7',
                          color: '#FFF',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        {currentJourney.published_to_customer ? 'Unpublish from Customer' : '📢 Publish to Customers'}
                      </button>

                      <button
                        onClick={() => setShowIngestModal(true)}
                        disabled={actionLoading}
                        style={{
                          background: '#7C3AED',
                          color: '#FFF',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        📡 Ingest GPS Ping
                      </button>

                      <button
                        onClick={() => handleStopJourney(currentJourney.id)}
                        disabled={actionLoading}
                        style={{
                          background: '#DC2626',
                          color: '#FFF',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        ⏹ Stop Journey
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Status Badges Row */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <div style={{ padding: '6px 14px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>State: </span>
                  <strong style={{ color: '#38BDF8' }}>{currentJourney.status}</strong>
                </div>

                <div style={{ padding: '6px 14px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Customer Visibility: </span>
                  <strong style={{ color: currentJourney.published_to_customer ? '#22C55E' : '#94A3B8' }}>
                    {currentJourney.published_to_customer ? 'PUBLISHED' : 'PRIVATE'}
                  </strong>
                </div>

                <div style={{ padding: '6px 14px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Arrival State: </span>
                  <strong style={{ color: currentJourney.ended_at ? '#22C55E' : '#F59E0B' }}>
                    {currentJourney.ended_at ? 'ARRIVED AT STORE' : 'EN ROUTE'}
                  </strong>
                </div>

                {selectedJourney.isStale && (
                  <div style={{ padding: '6px 14px', borderRadius: '6px', background: '#78350F', border: '1px solid #F59E0B' }}>
                    <span style={{ fontSize: '12px', color: '#FEF3C7', fontWeight: 'bold' }}>
                      ⚠ STALE GPS (&gt; 5 min)
                    </span>
                  </div>
                )}
              </div>

              {/* Live GPS Telemetry Card */}
              <div style={{ background: '#0F172A', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#38BDF8' }}>
                    Live GPS Telemetry
                  </h3>
                  {latestPos && (
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      Last Recorded: {new Date(latestPos.recorded_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {latestPos ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>LATITUDE</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {latestPos.latitude.toFixed(6)}°
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>LONGITUDE</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {latestPos.longitude.toFixed(6)}°
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>SPEED</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        {latestPos.speed !== null ? `${latestPos.speed} km/h` : '--'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>DISTANCE TO STORE</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: selectedJourney.insideGeofence ? '#22C55E' : '#F8FAFC' }}>
                        {selectedJourney.distanceMeters !== null
                          ? selectedJourney.distanceMeters < 1000
                            ? `${selectedJourney.distanceMeters} m`
                            : `${(selectedJourney.distanceMeters / 1000).toFixed(2)} km`
                          : '--'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8' }}>
                    No GPS coordinates received yet. Use <strong>📡 Ingest GPS Ping</strong> to send coordinates.
                  </div>
                )}

                {/* Stale Warning Banner */}
                {selectedJourney.isStale && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', borderRadius: '6px', fontSize: '13px', color: '#FCD34D' }}>
                    GPS signal unavailable or older than 5 minutes. Showing last known coordinates.
                  </div>
                )}

                {/* Post-Arrival Window Status */}
                {currentJourney.ended_at && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22C55E', borderRadius: '6px', fontSize: '13px', color: '#86EFAC' }}>
                    ✓ Truck arrived at store at {new Date(currentJourney.ended_at).toLocaleTimeString()}.
                    {currentJourney.customer_tracking_closed_at ? (
                      <span style={{ display: 'block', marginTop: '4px', color: '#F59E0B' }}>
                        Customer tracking has ended (Closed at {new Date(currentJourney.customer_tracking_closed_at).toLocaleTimeString()}).
                      </span>
                    ) : (
                      <span style={{ display: 'block', marginTop: '4px' }}>
                        Post-arrival tracking window active. Closes automatically in {selectedJourney.remainingPostArrivalMinutes || 0} minutes.
                        <button
                          onClick={() => handleCloseTracking(currentJourney.id)}
                          style={{ marginLeft: '12px', background: '#D97706', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Close Customer Tracking Now
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Route & Fish Manifest Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Route Information */}
                <div style={{ background: '#0F172A', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#94A3B8' }}>
                    Route Specifications
                  </h4>
                  <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#64748B' }}>Origin:</span>{' '}
                    <strong>{currentJourney.origin?.name || 'Harbor'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#64748B' }}>Destination:</span>{' '}
                    <strong>{currentJourney.destination?.name || 'PondFish Store'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#64748B' }}>Address:</span>{' '}
                    <span>{currentJourney.destination?.address || '--'}</span>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#64748B' }}>Geofence:</span>{' '}
                    <span>{currentJourney.destination?.geofenceRadiusMeters || 500}m radius</span>
                  </div>
                </div>

                {/* Fish Manifest */}
                <div style={{ background: '#0F172A', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#94A3B8' }}>
                    Cargo Manifest
                  </h4>
                  {Array.isArray(currentJourney.fish_manifest) && currentJourney.fish_manifest.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentJourney.fish_manifest.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #1E293B', paddingBottom: '4px' }}>
                          <span>🐟 {item.fishName || item.name}</span>
                          <strong style={{ color: '#38BDF8' }}>{item.quantityKg || item.quantity} kg</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#64748B', fontSize: '13px' }}>No cargo manifest items attached.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE JOURNEY MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#1E293B',
            borderRadius: '12px',
            border: '1px solid #334155',
            width: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 20px 0', color: '#F8FAFC' }}>
              Create New Truck Journey
            </h2>

            <form onSubmit={handleCreateJourney}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Truck Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.truckNumber}
                    onChange={(e) => setCreateForm({ ...createForm, truckNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Driver Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.driverName}
                    onChange={(e) => setCreateForm({ ...createForm, driverName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                  Origin Harbor Name
                </label>
                <input
                  type="text"
                  value={createForm.originName}
                  onChange={(e) => setCreateForm({ ...createForm, originName: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                  Fixed Store Destination
                </label>
                <input
                  type="text"
                  disabled
                  value={`${createForm.destinationName} (${createForm.destinationAddress})`}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#334155', border: '1px solid #475569', color: '#94A3B8' }}
                />
              </div>

              {/* Manifest Items Section */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#38BDF8' }}>
                    Fish Cargo Manifest
                  </label>
                  <button
                    type="button"
                    onClick={addFishItem}
                    style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    + Add Fish
                  </button>
                </div>

                {createForm.fishItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Fish name & cut"
                      value={item.fishName}
                      onChange={(e) => updateFishItem(idx, 'fishName', e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', fontSize: '13px' }}
                    />
                    <input
                      type="number"
                      placeholder="Kg"
                      value={item.quantityKg}
                      onChange={(e) => updateFishItem(idx, 'quantityKg', e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeFishItem(idx)}
                      style={{ background: '#991B1B', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: '#475569', color: '#FFF', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {actionLoading ? 'Creating...' : 'Save Journey (DRAFT)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INGEST GPS TELEMETRY MODAL */}
      {showIngestModal && selectedJourney && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#1E293B',
            borderRadius: '12px',
            border: '1px solid #334155',
            width: '500px',
            padding: '28px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#F8FAFC' }}>
              📡 Ingest GPS Position Telemetry
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px' }}>
              Send genuine coordinates for <strong>{currentJourney.truck_number}</strong>. Telemetry evaluates the store geofence (12.9716, 77.5946 within 500m).
            </p>

            <form onSubmit={handleIngestPosition}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={ingestForm.latitude}
                    onChange={(e) => setIngestForm({ ...ingestForm, latitude: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={ingestForm.longitude}
                    onChange={(e) => setIngestForm({ ...ingestForm, longitude: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Speed (km/h)
                  </label>
                  <input
                    type="number"
                    value={ingestForm.speed}
                    onChange={(e) => setIngestForm({ ...ingestForm, speed: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
                    Heading (degrees)
                  </label>
                  <input
                    type="number"
                    value={ingestForm.heading}
                    onChange={(e) => setIngestForm({ ...ingestForm, heading: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  style={{ background: '#475569', color: '#FFF', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ background: '#7C3AED', color: '#FFF', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {actionLoading ? 'Recording...' : 'Send Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
