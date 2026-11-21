'use client';

/**
 * AP-14: Truck Journeys & GPS Publishing Manager
 * Traceability: PondFish Master PRD v2 (Section 22), Admin Portal Specification (Section 118–130)
 * Admin portal module for managing truck deliveries, fish manifests,
 * customer publication gate, live telemetry inspection, and geofenced arrival.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function AdminJourneysPage() {
  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const selectedJourneyRef = useRef(null);
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
    destinationLat: '12.9716',
    destinationLng: '77.5946',
    geofenceRadiusMeters: 500,
    fishItems: [
      { fishName: '', quantityKg: 50 },
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
  const [wsConnected, setWsConnected] = useState(false);

  // Fetch all journeys
  const fetchJourneys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/admin/gps/journeys');
      const data = await res.json();
      if (data.success) {
        setJourneys(data.data || []);
        if (data.data?.length > 0 && !selectedJourneyRef.current) {
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
  }, []);

  // Fetch single journey detail
  const fetchJourneyDetail = async (id) => {
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedJourney(data.data);
      }
    } catch (err) {
      console.error('Failed to load journey detail:', err);
    }
  };

  // Keep selectedJourneyRef in sync
  useEffect(() => {
    selectedJourneyRef.current = selectedJourney;
  }, [selectedJourney]);

  // Realtime connection for live telemetry via authoritative native WebSocket server
  useEffect(() => {
    fetchJourneys();

    let ws = null;
    let reconnectTimer = null;
    let isDisposed = false;

    function connectWs() {
      if (typeof window === 'undefined' || isDisposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/realtime`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isDisposed) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'gps:live') {
              const currentSelected = selectedJourneyRef.current;
              if (currentSelected && msg.data?.journeyId === currentSelected.journey?.id) {
                fetchJourneyDetail(currentSelected.journey.id);
              }
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (!isDisposed) {
            setWsConnected(false);
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch {
        if (!isDisposed) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      }
    }

    connectWs();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchJourneys]);

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
          name: createForm.originName || 'Pond Harbor',
          latitude: parseFloat(createForm.originLat) || 12.9500,
          longitude: parseFloat(createForm.originLng) || 77.5500,
        },
        destination: {
          name: createForm.destinationName,
          address: createForm.destinationAddress,
          latitude: parseFloat(createForm.destinationLat) || 12.9716,
          longitude: parseFloat(createForm.destinationLng) || 77.5946,
          geofenceRadiusMeters: parseInt(createForm.geofenceRadiusMeters, 10) || 500,
        },
        fishManifest: createForm.fishItems.filter((item) => item.fishName && item.quantityKg > 0),
      };

      const res = await fetch('/api/v1/admin/gps/journeys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    if (!confirm('Start this journey? This will activate live GPS monitoring.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}/start`, {
        method: 'POST',
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
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gps/journeys/${id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ published: nextPublished }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(nextPublished ? 'Live tracking published to customer app!' : 'Customer tracking set to private.');
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
        },
        body: JSON.stringify({
          latitude: parseFloat(ingestForm.latitude),
          longitude: parseFloat(ingestForm.longitude),
          speed: parseFloat(ingestForm.speed) || 0,
          heading: parseFloat(ingestForm.heading) || 0,
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

  // Counts for metric cards
  const liveCount = journeys.filter((j) => j.status === 'LIVE').length;
  const publishedCount = journeys.filter((j) => j.published_to_customer && !j.customer_tracking_closed_at).length;

  return (
    <div style={{ color: '#0F2C59', maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Toast Notifications */}
      {successMsg && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13.5px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>×</button>
        </div>
      )}

      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '13.5px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0F2C59', margin: 0, letterSpacing: '-0.02em' }}>
            Live Delivery Truck &amp; GPS
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Live WebSocket Sync Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: wsConnected ? '#ECFDF5' : '#F1F5F9',
            border: `1px solid ${wsConnected ? '#A7F3D0' : '#CBD5E1'}`,
            fontSize: '12px',
            fontWeight: '700',
            color: wsConnected ? '#065F46' : '#64748B',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: wsConnected ? '#10B981' : '#94A3B8',
              boxShadow: wsConnected ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
            }} />
            <span>{wsConnected ? 'Telemetry Stream Live' : 'Connecting Stream...'}</span>
          </div>

          <button
            onClick={fetchJourneys}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F2C59',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.75 : 1,
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

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#1E56A0',
              color: '#FFFFFF',
              border: 'none',
              padding: '0 20px',
              height: '38px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Create Journey</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="pf-admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Active Delivery Trucks
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: liveCount > 0 ? '#10B981' : '#0F2C59' }}>
            {liveCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            {liveCount > 0 ? 'Vehicles live on route' : 'No active live trips'}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Customer Published
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0284C7' }}>
            {publishedCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Visible on customer app
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Store Geofence Radius
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59' }}>
            500 m
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Auto-detects arrival &amp; 45m window
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px 22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Total Registered Journeys
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59' }}>
            {journeys.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            All-time fleet logs
          </div>
        </div>
      </div>

      {/* Main Grid: Left List (380px), Right Detail & Telemetry */}
      <div className="pf-admin-journeys-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 380px) 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Journeys List */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)', position: 'relative', overflow: 'hidden' }}>
          {/* Top Progress Line during fetch */}
          {loading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#E2E8F0', overflow: 'hidden', zIndex: 10 }}>
              <div className="pf-animate-indeterminate" style={{ width: '45%', height: '100%', background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', margin: 0 }}>
              Fleet Journeys ({journeys.length})
            </h2>
            <button
              onClick={fetchJourneys}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '4px 10px',
                color: '#0F2C59',
                fontSize: '12px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
              }}
            >
              <svg
                className={loading ? 'pf-animate-spin' : ''}
                width="12"
                height="12"
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

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div className="pf-skeleton" style={{ height: '18px', width: '110px' }} />
                    <div className="pf-skeleton" style={{ height: '18px', width: '55px', borderRadius: '20px' }} />
                  </div>
                  <div className="pf-skeleton" style={{ height: '14px', width: '160px', marginBottom: '8px' }} />
                  <div className="pf-skeleton" style={{ height: '12px', width: '130px', marginBottom: '10px' }} />
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <div className="pf-skeleton" style={{ height: '12px', width: '90px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : journeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B', fontSize: '13px' }}>
              <div style={{ color: '#0F2C59', fontWeight: '700', marginBottom: '6px' }}>No journeys recorded yet</div>
              <p style={{ margin: '0 0 16px', fontSize: '12.5px' }}>Create your first delivery journey to start GPS tracking.</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: '#1E56A0',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                }}
              >
                + Create First Journey
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
                      background: isSelected ? '#EFF6FF' : '#FFFFFF',
                      border: isSelected ? '1.5px solid #1E56A0' : '1px solid #E2E8F0',
                      borderLeft: isSelected ? '4px solid #1E56A0' : '1px solid #E2E8F0',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(30, 86, 160, 0.08)' : '0 1px 3px rgba(15, 44, 89, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                        <span style={{ fontWeight: '800', fontSize: '14.5px', color: '#0F2C59' }}>
                          {j.truck_number}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background:
                            j.status === 'LIVE' ? '#ECFDF5' :
                            j.status === 'STOPPED' ? '#F1F5F9' :
                            j.status === 'CANCELLED' ? '#FEF2F2' : '#EFF6FF',
                          color:
                            j.status === 'LIVE' ? '#065F46' :
                            j.status === 'STOPPED' ? '#334155' :
                            j.status === 'CANCELLED' ? '#991B1B' : '#1E56A0',
                          border: `1px solid ${
                            j.status === 'LIVE' ? '#A7F3D0' :
                            j.status === 'STOPPED' ? '#CBD5E1' :
                            j.status === 'CANCELLED' ? '#FECACA' : '#BFDBFE'
                          }`,
                        }}
                      >
                        {j.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: '600', marginBottom: '6px' }}>
                      Driver: <strong style={{ color: '#0F2C59' }}>{j.driver_name}</strong>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                      {j.origin?.name || 'Harbor'} → PondFish Store
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: j.published_to_customer ? '#059669' : '#64748B',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: j.published_to_customer ? '#10B981' : '#94A3B8',
                        }} />
                        {j.published_to_customer ? 'Published to App' : 'Internal Only'}
                      </span>
                      {j.customer_tracking_closed_at && (
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                          Closed post-arrival
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Journey Inspection & Live Controls */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 2px 8px rgba(15, 44, 89, 0.04)', position: 'relative', overflow: 'hidden' }}>
          {/* Top Progress Line during fetch */}
          {loading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#E2E8F0', overflow: 'hidden', zIndex: 10 }}>
              <div className="pf-animate-indeterminate" style={{ width: '45%', height: '100%', background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)' }} />
            </div>
          )}
          {!selectedJourney ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748B' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px' }}>
                <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F2C59', marginBottom: '4px' }}>
                Select a Journey to Inspect
              </div>
              <div style={{ fontSize: '13px' }}>
                Choose a truck from the fleet list on the left to monitor live coordinates, customer visibility, and cargo manifest.
              </div>
            </div>
          ) : (
            <div>
              {/* Journey Title & Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Journey ID: <code>{currentJourney.id.slice(0, 12)}...</code>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0F2C59', margin: '4px 0 0 0' }}>
                    Truck {currentJourney.truck_number} — {currentJourney.driver_name}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {currentJourney.status === 'DRAFT' && (
                    <button
                      onClick={() => handleStartJourney(currentJourney.id)}
                      disabled={actionLoading}
                      style={{
                        background: '#059669',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      <span>Start Journey</span>
                    </button>
                  )}

                  {currentJourney.status === 'LIVE' && (
                    <>
                      <button
                        onClick={() => handleTogglePublication(currentJourney.id, currentJourney.published_to_customer)}
                        disabled={actionLoading}
                        style={{
                          background: currentJourney.published_to_customer ? '#F1F5F9' : '#1E56A0',
                          color: currentJourney.published_to_customer ? '#334155' : '#FFFFFF',
                          border: `1px solid ${currentJourney.published_to_customer ? '#CBD5E1' : '#1E56A0'}`,
                          padding: '9px 16px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          boxShadow: currentJourney.published_to_customer ? 'none' : '0 2px 6px rgba(30, 86, 160, 0.25)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {currentJourney.published_to_customer ? 'Unpublish from Customer' : 'Publish to Customers'}
                      </button>

                      <button
                        onClick={() => setShowIngestModal(true)}
                        disabled={actionLoading}
                        style={{
                          background: '#0284C7',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '9px 16px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                        </svg>
                        <span>Ingest GPS Ping</span>
                      </button>

                      <button
                        onClick={() => handleStopJourney(currentJourney.id)}
                        disabled={actionLoading}
                        style={{
                          background: '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '9px 16px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                        <span>Stop Journey</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Status Badges Row */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>State: </span>
                  <strong style={{ color: '#1E56A0' }}>{currentJourney.status}</strong>
                </div>

                <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Customer Visibility: </span>
                  <strong style={{ color: currentJourney.published_to_customer ? '#059669' : '#64748B' }}>
                    {currentJourney.published_to_customer ? 'PUBLISHED' : 'PRIVATE'}
                  </strong>
                </div>

                <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Arrival State: </span>
                  <strong style={{ color: currentJourney.ended_at ? '#059669' : '#0284C7' }}>
                    {currentJourney.ended_at ? 'ARRIVED AT STORE' : 'EN ROUTE'}
                  </strong>
                </div>

                {selectedJourney.isStale && (
                  <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#FEF3C7', border: '1px solid #FDE68A', fontSize: '12px' }}>
                    <span style={{ color: '#B45309', fontWeight: '800' }}>
                      STALE GPS (&gt; 5 min)
                    </span>
                  </div>
                )}
              </div>

              {/* Live GPS Telemetry Card */}
              <div style={{ background: '#F8FAFC', padding: '22px', borderRadius: '14px', border: '1px solid #E2E8F0', marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="2"/>
                      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
                    </svg>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                      Live GPS Telemetry
                    </h3>
                  </div>
                  {latestPos && (
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                      Last Ping: {new Date(latestPos.recorded_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {latestPos ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>LATITUDE</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', fontFamily: 'monospace' }}>
                        {latestPos.latitude.toFixed(6)}°
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>LONGITUDE</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F2C59', fontFamily: 'monospace' }}>
                        {latestPos.longitude.toFixed(6)}°
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>SPEED</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F2C59' }}>
                        {latestPos.speed !== null ? `${latestPos.speed} km/h` : '--'}
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>DISTANCE TO STORE</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: selectedJourney.insideGeofence ? '#059669' : '#0F2C59' }}>
                        {selectedJourney.distanceMeters !== null
                          ? selectedJourney.distanceMeters < 1000
                            ? `${selectedJourney.distanceMeters} m`
                            : `${(selectedJourney.distanceMeters / 1000).toFixed(2)} km`
                          : '--'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '13px' }}>
                    No GPS coordinates received yet. Use <strong>Ingest GPS Ping</strong> to send mock or hardware coordinates.
                  </div>
                )}

                {/* Stale Warning Banner */}
                {selectedJourney.isStale && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
                    GPS signal unavailable or older than 5 minutes. Showing last known coordinates.
                  </div>
                )}

                {/* Post-Arrival Window Status */}
                {currentJourney.ended_at && (
                  <div style={{ marginTop: '16px', padding: '14px 18px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', fontSize: '13px', color: '#065F46' }}>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                      Truck arrived at store at {new Date(currentJourney.ended_at).toLocaleTimeString()}.
                    </div>
                    {currentJourney.customer_tracking_closed_at ? (
                      <div style={{ color: '#B45309', fontWeight: '600' }}>
                        Customer tracking closed at {new Date(currentJourney.customer_tracking_closed_at).toLocaleTimeString()}.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        <span>
                          Post-arrival tracking window active. Closes automatically in <strong>{selectedJourney.remainingPostArrivalMinutes || 0} minutes</strong>.
                        </span>
                        <button
                          onClick={() => handleCloseTracking(currentJourney.id)}
                          style={{ background: '#D97706', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Close Customer Tracking Now
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Route & Fish Manifest Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {/* Route Information */}
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 14px 0', color: '#0F2C59' }}>
                    Route Specifications
                  </h4>
                  <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                    <span style={{ color: '#64748B' }}>Origin:</span>{' '}
                    <strong style={{ color: '#0F2C59' }}>{currentJourney.origin?.name || 'Harbor'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                    <span style={{ color: '#64748B' }}>Destination:</span>{' '}
                    <strong style={{ color: '#0F2C59' }}>{currentJourney.destination?.name || 'PondFish Store'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                    <span style={{ color: '#64748B' }}>Store Address:</span>{' '}
                    <span style={{ color: '#334155' }}>{currentJourney.destination?.address || '--'}</span>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#64748B' }}>Geofence:</span>{' '}
                    <strong style={{ color: '#1E56A0' }}>{currentJourney.destination?.geofenceRadiusMeters || 500}m radius</strong>
                  </div>
                </div>

                {/* Fish Cargo Manifest */}
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 14px 0', color: '#0F2C59' }}>
                    Cargo Manifest
                  </h4>
                  {Array.isArray(currentJourney.fish_manifest) && currentJourney.fish_manifest.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentJourney.fish_manifest.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', background: '#FFFFFF', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontWeight: '600', color: '#0F2C59' }}>{item.fishName || item.name}</span>
                          <span style={{ fontWeight: '800', color: '#1E56A0', background: '#EFF6FF', padding: '3px 8px', borderRadius: '6px' }}>
                            {item.quantityKg || item.quantity} kg
                          </span>
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
          background: 'rgba(15, 44, 89, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px -8px rgba(15, 44, 89, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                Create New Truck Journey
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateJourney}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Truck Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AP 04 TX 5544"
                    value={createForm.truckNumber}
                    onChange={(e) => setCreateForm({ ...createForm, truckNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Driver Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Kumar"
                    value={createForm.driverName}
                    onChange={(e) => setCreateForm({ ...createForm, driverName: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Origin Harbor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kolleru Lake Fish Landing Jetty"
                  value={createForm.originName}
                  onChange={(e) => setCreateForm({ ...createForm, originName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Fixed Store Destination
                </label>
                <input
                  type="text"
                  disabled
                  value={`${createForm.destinationName} (${createForm.destinationAddress})`}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Manifest Items Section */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#0F2C59' }}>
                    Fish Cargo Manifest
                  </label>
                  <button
                    type="button"
                    onClick={addFishItem}
                    style={{ background: '#EFF6FF', color: '#1E56A0', border: '1px solid #BFDBFE', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    + Add Fish
                  </button>
                </div>

                {createForm.fishItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Fish variety name"
                      value={item.fishName}
                      onChange={(e) => updateFishItem(idx, 'fishName', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px' }}
                    />
                    <input
                      type="number"
                      placeholder="Kg"
                      value={item.quantityKg}
                      onChange={(e) => updateFishItem(idx, 'quantityKg', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeFishItem(idx)}
                      style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: '#1E56A0',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '9px 24px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                  }}
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
          background: 'rgba(15, 44, 89, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            boxShadow: '0 20px 40px -8px rgba(15, 44, 89, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F2C59' }}>
                Ingest GPS Position Telemetry
              </h2>
              <button
                type="button"
                onClick={() => setShowIngestModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px' }}>
              Send coordinates for <strong>{currentJourney.truck_number}</strong>. Telemetry evaluates the store geofence (12.9716, 77.5946 within 500m).
            </p>

            <form onSubmit={handleIngestPosition}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    placeholder="12.9716"
                    value={ingestForm.latitude}
                    onChange={(e) => setIngestForm({ ...ingestForm, latitude: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    placeholder="77.5946"
                    value={ingestForm.longitude}
                    onChange={(e) => setIngestForm({ ...ingestForm, longitude: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '22px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Speed (km/h)
                  </label>
                  <input
                    type="number"
                    placeholder="45"
                    value={ingestForm.speed}
                    onChange={(e) => setIngestForm({ ...ingestForm, speed: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#425B73', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Heading (degrees)
                  </label>
                  <input
                    type="number"
                    placeholder="180"
                    value={ingestForm.heading}
                    onChange={(e) => setIngestForm({ ...ingestForm, heading: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F2C59', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: '#1E56A0',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '9px 24px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                  }}
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
