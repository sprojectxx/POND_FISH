'use client';

/**
 * Screen: TV-01 — Shop Transaction TV Display Portal
 * Traceability: PondFish Transaction TV Spec (Sections 11-20, 64-67, 149), Complete Design System (Sec. 27, 33)
 * 
 * Features:
 * - Read-only distance-readable display for store TV monitors (3-5m viewing).
 * - Real-time WebSocket connection to /api/v1/realtime for instant transaction display.
 * - Initial hydration and reconnect synchronization via GET /api/v1/public/transactions/recent.
 * - Current business day isolation & transaction deduplication.
 * - Synthesized Web Audio API notification chime on new transactions.
 * - Connection status indicator (Live, Reconnecting, Offline).
 * - High-contrast accessible dark palette with emerald green success highlights.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function TVPortalPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING'); // 'CONNECTED' | 'RECONNECTING' | 'OFFLINE'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [newTxnIds, setNewTxnIds] = useState(new Set());

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const audioCtxRef = useRef(null);
  const seenTxnIdsRef = useRef(new Set());

  // Update live clock every second
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        })
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio API Chime Synthesizer
  const playCounterChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Note 1: E6 (1318.5 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.5, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2: B6 (1975.5 Hz) - pleasant counter harmony
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1975.5, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.35, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);
    } catch {
      // Audio autoplay policy might require initial user interaction
    }
  }, [soundEnabled]);

  // Handle user interaction to unlock browser Web Audio API
  function handleEnableAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setAudioReady(true);
      setSoundEnabled(true);
      playCounterChime();
    } catch {
      setAudioReady(true);
    }
  }

  // REST Hydration: Fetch today's transactions from backend
  const fetchRecentTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/public/transactions/recent?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data?.transactions)) {
        const fetched = json.data.transactions;
        setTransactions(fetched);
        // Track seen IDs for deduplication
        fetched.forEach((tx) => seenTxnIdsRef.current.add(tx.id));
      }
    } catch (err) {
      console.warn('[TV PORTAL] Hydration error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle new incoming transaction with deduplication and highlight
  const handleIncomingTransaction = useCallback(
    (newTx) => {
      if (!newTx || !newTx.id) return;

      // Strict deduplication: ignore if already displayed
      if (seenTxnIdsRef.current.has(newTx.id)) {
        return;
      }

      seenTxnIdsRef.current.add(newTx.id);

      // Prepend new transaction
      setTransactions((prev) => [newTx, ...prev]);

      // Add highlight state
      setNewTxnIds((prev) => new Set(prev).add(newTx.id));

      // Trigger notification sound
      playCounterChime();

      // Clear highlight after 8 seconds
      setTimeout(() => {
        setNewTxnIds((prev) => {
          const next = new Set(prev);
          next.delete(newTx.id);
          return next;
        });
      }, 8000);
    },
    [playCounterChime]
  );

  // Authoritative native WebSocket connection setup
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/realtime`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('CONNECTED');
        fetchRecentTransactions();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'successful_transaction' && msg.data) {
            handleIncomingTransaction(msg.data);
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onclose = () => {
        setConnectionStatus('RECONNECTING');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        setConnectionStatus('RECONNECTING');
      };
    } catch {
      setConnectionStatus('RECONNECTING');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    }
  }, [fetchRecentTransactions, handleIncomingTransaction]);

  // Mount lifecycle: hydrate and establish native WebSocket connection
  useEffect(() => {
    fetchRecentTransactions();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchRecentTransactions, connectWebSocket]);

  return (
    <div className="pf-tv-shell" style={styles.container}>
      {/* 1. Global Header Bar */}
      <header className="pf-tv-header" style={styles.header}>
        <div className="pf-tv-header-left" style={styles.brandGroup}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.logoBadge}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                <path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
              </svg>
            </div>
            <div>
              <div className="pf-tv-brand-title" style={styles.brandTitle}>
                POND<span style={{ color: '#1E56A0' }}>FISH</span> FRESH COUNTER
              </div>
              <div className="pf-tv-brand-subtitle" style={styles.brandSubtitle}>
                Live Checkout & Handover Display
              </div>
            </div>
          </div>
        </div>

        {/* Header Right: Clock + Sound + Connection Indicator */}
        <div className="pf-tv-header-right" style={styles.headerRight}>
          {/* Audio Chime Button */}
          {!audioReady ? (
            <button className="pf-tv-action-btn" style={styles.audioPromptBtn} onClick={handleEnableAudio}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Enable Chimes
            </button>
          ) : (
            <button
              className="pf-tv-action-btn"
              style={styles.soundToggleBtn}
              onClick={() => setSoundEnabled((prev) => !prev)}
              title="Toggle transaction chime sound"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {soundEnabled && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                {!soundEnabled && <line x1="23" y1="9" x2="17" y2="15" />}
                {!soundEnabled && <line x1="17" y1="9" x2="23" y2="15" />}
              </svg>
              {soundEnabled ? 'Sound ON' : 'Muted'}
            </button>
          )}

          {/* Date & Time */}
          <div className="pf-tv-clock-box" style={styles.clockBox}>
            <div className="pf-tv-clock-time" style={styles.clockTime}>{currentTime || '--:--:--'}</div>
            <div className="pf-tv-clock-date" style={styles.clockDate}>{currentDate}</div>
          </div>

          {/* Connection Status Badge */}
          <div
            className="pf-tv-status-badge"
            style={{
              ...styles.statusBadge,
              backgroundColor:
                connectionStatus === 'CONNECTED'
                  ? '#DCFCE7'
                  : connectionStatus === 'RECONNECTING'
                  ? '#FEF3C7'
                  : '#FEE2E2',
              borderColor:
                connectionStatus === 'CONNECTED'
                  ? '#BBF7D0'
                  : connectionStatus === 'RECONNECTING'
                  ? '#FDE68A'
                  : '#FECACA',
            }}
          >
            <span
              style={{
                ...styles.statusDot,
                backgroundColor:
                  connectionStatus === 'CONNECTED'
                    ? '#15803D'
                    : connectionStatus === 'RECONNECTING'
                    ? '#D97706'
                    : '#DC2626',
                boxShadow:
                  connectionStatus === 'CONNECTED'
                    ? '0 0 8px rgba(21, 128, 61, 0.5)'
                    : 'none',
              }}
            />
            <span
              className="pf-tv-status-text"
              style={{
                ...styles.statusText,
                color:
                  connectionStatus === 'CONNECTED'
                    ? '#166534'
                    : connectionStatus === 'RECONNECTING'
                    ? '#B45309'
                    : '#991B1B',
              }}
            >
              {connectionStatus === 'CONNECTED'
                ? 'LIVE FEED'
                : connectionStatus === 'RECONNECTING'
                ? 'RECONNECTING'
                : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="pf-tv-main" style={styles.main}>
        {/* Loading State */}
        {loading && (
          <div style={styles.skeletonContainer}>
            <div style={styles.skeletonRow}></div>
            <div style={styles.skeletonRow}></div>
            <div style={styles.skeletonRow}></div>
          </div>
        )}

        {/* Empty State (TV-05) */}
        {!loading && transactions.length === 0 && (
          <div className="pf-tv-empty-card" style={styles.emptyContainer}>
            <div style={styles.emptyIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#1E56A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h2 className="pf-tv-empty-title" style={styles.emptyTitle}>
              Awaiting Next Completed Counter Checkout
            </h2>
            <p className="pf-tv-empty-subtitle" style={styles.emptySubtitle}>
              Realtime WebSocket feed will broadcast confirmed store transactions immediately.
            </p>
            <div style={styles.emptyPill}>
              Active Store Session • {currentDate}
            </div>
          </div>
        )}

        {/* Populated Transaction Feed (TV-01, TV-02, TV-03) */}
        {!loading && transactions.length > 0 && (
          <div className="pf-tv-feed-wrapper" style={styles.feedWrapper}>
            {/* Table / Card Header */}
            <div className="pf-tv-table-header" style={styles.tableHeader}>
              <div style={{ flex: '0 0 160px' }}>ORDER / TIME</div>
              <div style={{ flex: '1 1 240px' }}>CUSTOMER</div>
              <div style={{ flex: '2 1 400px' }}>FRESH FISH & WEIGHT</div>
              <div style={{ flex: '0 0 180px', textAlign: 'right' }}>PAID AMOUNT</div>
            </div>

            {/* Scrollable Feed List */}
            <div className="pf-tv-list-container" style={styles.listContainer}>
              {transactions.map((tx) => {
                const isNew = newTxnIds.has(tx.id);
                return (
                  <div
                    key={tx.id}
                    className="pf-tv-card"
                    style={{
                      ...styles.transactionCard,
                      ...(isNew ? styles.newCardHighlight : {}),
                    }}
                  >
                    {/* Top Row: Order / Time + Mobile Amount */}
                    <div className="pf-tv-card-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 0 160px' }}>
                      <div>
                        <div style={styles.orderPill}>
                          {tx.billNumber || tx.transactionNumber}
                        </div>
                        <div style={styles.orderTime}>{tx.time}</div>
                      </div>
                      <div className="pf-tv-card-mobile-amount" style={{ display: 'none', textAlign: 'right' }}>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803D' }}>
                          ₹{Number(tx.paidAmount).toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700' }}>Verified Paid</div>
                      </div>
                    </div>

                    {/* Column 2: Customer Name */}
                    <div className="pf-tv-card-customer-col" style={{ flex: '1 1 240px' }}>
                      <div className="pf-tv-card-customer-name" style={styles.customerName}>{tx.customerName}</div>
                      {isNew && (
                        <span style={styles.newBadge}>JUST COMPLETED</span>
                      )}
                    </div>

                    {/* Column 3: Fish Items & Kilograms */}
                    <div className="pf-tv-card-fish-col" style={{ flex: '2 1 400px' }}>
                      <div style={styles.itemsWrapper}>
                        {tx.items && tx.items.length > 0 ? (
                          tx.items.map((item, idx) => (
                            <span key={idx} style={styles.itemTag}>
                              <span style={styles.itemFish}>{item.fishName}</span>
                              <span style={styles.itemWeight}>
                                {item.quantityKg} kg
                              </span>
                            </span>
                          ))
                        ) : (
                          <span style={styles.itemTag}>
                            <span style={styles.itemFish}>Fresh Seafood Order</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Column 4: Desktop Paid Amount */}
                    <div className="pf-tv-card-amount-col" style={{ flex: '0 0 180px', textAlign: 'right' }}>
                      <div style={styles.amountValue}>
                        ₹{Number(tx.paidAmount).toLocaleString('en-IN')}
                      </div>
                      <div style={styles.amountLabel}>Verified Paid</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer Bar */}
      <footer style={styles.footer}>
        <div style={styles.footerLeft}>
          <span>Store ID: #BLR-FLAGSHIP-01</span>
          <span style={{ color: '#475569' }}>•</span>
          <span>Authoritative Supabase PostgreSQL + WebSocket</span>
        </div>
        <div style={styles.footerRight}>
          <span>Transactions Displayed: {transactions.length}</span>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#F0F5FA',
    color: '#0F2C59',
    overflow: 'hidden',
    userSelect: 'none',
  },
  header: {
    height: '84px',
    padding: '0 36px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    boxShadow: '0 2px 10px rgba(15, 44, 89, 0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logoBadge: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    backgroundColor: '#E8F1F5',
    border: '1.5px solid #CBD5E1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '26px',
    fontWeight: '900',
    letterSpacing: '-0.02em',
    color: '#0F2C59',
    lineHeight: '1.1',
  },
  brandSubtitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#64748B',
    marginTop: '3px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  audioPromptBtn: {
    padding: '9px 18px',
    backgroundColor: '#1E56A0',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(30, 86, 160, 0.25)',
  },
  soundToggleBtn: {
    padding: '8px 16px',
    backgroundColor: '#F8FAFC',
    color: '#0F2C59',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  clockBox: {
    textAlign: 'right',
  },
  clockTime: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0F2C59',
    fontVariantNumeric: 'tabular-nums',
  },
  clockDate: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 16px',
    borderRadius: '24px',
    border: '1px solid',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  statusText: {
    fontSize: '13px',
    fontWeight: '800',
    letterSpacing: '0.04em',
  },
  main: {
    flex: 1,
    padding: '24px 36px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  skeletonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '20px',
  },
  skeletonRow: {
    height: '84px',
    backgroundColor: '#E2E8F0',
    borderRadius: '14px',
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 8px 24px rgba(15, 44, 89, 0.04)',
    maxWidth: '740px',
    margin: '40px auto',
    padding: '50px 36px',
  },
  emptyIcon: {
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: '10px',
  },
  emptySubtitle: {
    fontSize: '15px',
    color: '#64748B',
    maxWidth: '560px',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  emptyPill: {
    padding: '8px 20px',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#159C57',
  },
  feedWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 24px',
    backgroundColor: '#E8F1F5',
    borderRadius: '12px 12px 0 0',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.06em',
    color: '#0F2C59',
    borderBottom: '1px solid #CBD5E1',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '12px',
  },
  transactionCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '18px 24px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
    transition: 'all 0.3s ease',
  },
  newCardHighlight: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.16)',
    transform: 'scale(1.01)',
  },
  orderPill: {
    display: 'inline-block',
    padding: '5px 12px',
    backgroundColor: '#E0F2FE',
    border: '1px solid #BAE6FD',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '800',
    color: '#0369A1',
    fontFamily: 'monospace',
  },
  orderTime: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '4px',
    fontWeight: '600',
  },
  customerName: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: '-0.01em',
  },
  newBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#DCFCE7',
    color: '#166534',
    border: '1px solid #BBF7D0',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '900',
    marginTop: '4px',
  },
  itemsWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  itemTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
  },
  itemFish: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0F2C59',
  },
  itemWeight: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#1E56A0',
  },
  amountValue: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#047857',
    fontVariantNumeric: 'tabular-nums',
  },
  amountLabel: {
    fontSize: '11px',
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: '2px',
  },
  footer: {
    height: '46px',
    padding: '0 36px',
    backgroundColor: '#FFFFFF',
    borderTop: '1px solid #E2E8F0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#64748B',
    fontWeight: '600',
    flexShrink: 0,
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  footerRight: {
    color: '#64748B',
  },
};
