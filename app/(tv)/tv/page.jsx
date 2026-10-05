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

  // Real-time WebSocket connection setup
  const connectWebSocket = useCallback(() => {
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
        // Synchronize on connect / reconnect to catch any transactions processed while disconnected
        fetchRecentTransactions();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'successful_transaction' && msg.data) {
            const newTx = msg.data;

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
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onclose = () => {
        setConnectionStatus('RECONNECTING');
        // Exponential backoff reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        setConnectionStatus('OFFLINE');
      };
    } catch {
      setConnectionStatus('RECONNECTING');
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, [fetchRecentTransactions, playCounterChime]);

  // Mount lifecycle: hydrate and connect
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
    <div style={styles.container}>
      {/* 1. Global Header Bar */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <div style={styles.logoBadge}>🐟</div>
          <div>
            <div style={styles.brandTitle}>
              POND<span style={{ color: '#38BDF8' }}>FISH</span> FRESH COUNTER
            </div>
            <div style={styles.brandSubtitle}>
              Bangalore Flagship Store • Live Checkout & Handover Display
            </div>
          </div>
        </div>

        {/* Header Right: Clock + Sound + Connection Indicator */}
        <div style={styles.headerRight}>
          {/* Audio Chime Button */}
          {!audioReady ? (
            <button style={styles.audioPromptBtn} onClick={handleEnableAudio}>
              🔔 Click to Enable Sound Alerts
            </button>
          ) : (
            <button
              style={styles.soundToggleBtn}
              onClick={() => setSoundEnabled((prev) => !prev)}
              title="Toggle transaction chime sound"
            >
              {soundEnabled ? '🔔 Sound ON' : '🔕 Sound OFF'}
            </button>
          )}

          {/* Date & Time */}
          <div style={styles.clockBox}>
            <div style={styles.clockTime}>{currentTime || '--:--:--'}</div>
            <div style={styles.clockDate}>{currentDate}</div>
          </div>

          {/* Connection Status Badge */}
          <div style={styles.statusBadge}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor:
                  connectionStatus === 'CONNECTED'
                    ? '#22C55E'
                    : connectionStatus === 'RECONNECTING'
                    ? '#FACC15'
                    : '#EF4444',
                boxShadow:
                  connectionStatus === 'CONNECTED'
                    ? '0 0 12px #22C55E'
                    : 'none',
              }}
            />
            <span style={styles.statusText}>
              {connectionStatus === 'CONNECTED'
                ? 'LIVE FEED ACTIVE'
                : connectionStatus === 'RECONNECTING'
                ? 'RECONNECTING...'
                : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main style={styles.main}>
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
          <div style={styles.emptyContainer}>
            <div style={styles.emptyIcon}>🐟</div>
            <h2 style={styles.emptyTitle}>
              Awaiting Next Completed Counter Checkout
            </h2>
            <p style={styles.emptySubtitle}>
              Realtime WebSocket feed will broadcast confirmed store transactions immediately.
            </p>
            <div style={styles.emptyPill}>
              Active Store Session • {currentDate}
            </div>
          </div>
        )}

        {/* Populated Transaction Feed (TV-01, TV-02, TV-03) */}
        {!loading && transactions.length > 0 && (
          <div style={styles.feedWrapper}>
            {/* Table / Card Header */}
            <div style={styles.tableHeader}>
              <div style={{ flex: '0 0 160px' }}>ORDER / TIME</div>
              <div style={{ flex: '1 1 240px' }}>CUSTOMER</div>
              <div style={{ flex: '2 1 400px' }}>FRESH FISH & WEIGHT</div>
              <div style={{ flex: '0 0 180px', textAlign: 'right' }}>PAID AMOUNT</div>
            </div>

            {/* Scrollable Feed List */}
            <div style={styles.listContainer}>
              {transactions.map((tx) => {
                const isNew = newTxnIds.has(tx.id);
                return (
                  <div
                    key={tx.id}
                    style={{
                      ...styles.transactionCard,
                      ...(isNew ? styles.newCardHighlight : {}),
                    }}
                  >
                    {/* Column 1: Order / Time */}
                    <div style={{ flex: '0 0 160px' }}>
                      <div style={styles.orderPill}>
                        {tx.billNumber || tx.transactionNumber}
                      </div>
                      <div style={styles.orderTime}>{tx.time}</div>
                    </div>

                    {/* Column 2: Customer Name */}
                    <div style={{ flex: '1 1 240px' }}>
                      <div style={styles.customerName}>{tx.customerName}</div>
                      {isNew && (
                        <span style={styles.newBadge}>JUST COMPLETED</span>
                      )}
                    </div>

                    {/* Column 3: Fish Items & Kilograms */}
                    <div style={{ flex: '2 1 400px' }}>
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

                    {/* Column 4: Paid Amount */}
                    <div style={{ flex: '0 0 180px', textAlign: 'right' }}>
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
    backgroundColor: '#020617',
    color: '#F8FAFC',
    overflow: 'hidden',
    userSelect: 'none',
  },
  header: {
    height: '90px',
    padding: '0 36px',
    backgroundColor: '#0F172A',
    borderBottom: '2px solid #1E293B',
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
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1.5px solid #0284C7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
  },
  brandTitle: {
    fontSize: '28px',
    fontWeight: '900',
    letterSpacing: '1px',
    color: '#F8FAFC',
    lineHeight: '1.1',
  },
  brandSubtitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: '3px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  audioPromptBtn: {
    padding: '8px 16px',
    backgroundColor: '#0284C7',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    animation: 'pulse 2s infinite',
  },
  soundToggleBtn: {
    padding: '6px 14px',
    backgroundColor: '#1E293B',
    color: '#94A3B8',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  clockBox: {
    textAlign: 'right',
  },
  clockTime: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#F8FAFC',
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
    backgroundColor: '#1E293B',
    borderRadius: '24px',
    border: '1px solid #334155',
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  statusText: {
    fontSize: '15px',
    fontWeight: '800',
    letterSpacing: '0.5px',
    color: '#F8FAFC',
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
    height: '90px',
    backgroundColor: '#1E293B',
    borderRadius: '12px',
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: '12px',
  },
  emptySubtitle: {
    fontSize: '18px',
    color: '#64748B',
    maxWidth: '600px',
    marginBottom: '24px',
    lineHeight: '1.5',
  },
  emptyPill: {
    padding: '8px 20px',
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#38BDF8',
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
    padding: '12px 24px',
    backgroundColor: '#0F172A',
    borderRadius: '8px 8px 0 0',
    fontSize: '13px',
    fontWeight: '800',
    letterSpacing: '0.8px',
    color: '#64748B',
    borderBottom: '1px solid #1E293B',
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
    padding: '20px 24px',
    backgroundColor: '#0F172A',
    border: '1.5px solid #1E293B',
    borderRadius: '12px',
    transition: 'all 0.4s ease',
  },
  newCardHighlight: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    boxShadow: '0 0 20px rgba(34, 197, 94, 0.25)',
    transform: 'scale(1.01)',
  },
  orderPill: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: '800',
    color: '#38BDF8',
    fontFamily: 'monospace',
  },
  orderTime: {
    fontSize: '13px',
    color: '#64748B',
    marginTop: '6px',
    fontWeight: '600',
  },
  customerName: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: '0.2px',
  },
  newBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#22C55E',
    color: '#000000',
    borderRadius: '4px',
    fontSize: '11px',
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
    backgroundColor: '#1E293B',
    borderRadius: '8px',
    border: '1px solid #334155',
  },
  itemFish: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#F8FAFC',
  },
  itemWeight: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#38BDF8',
  },
  amountValue: {
    fontSize: '32px',
    fontWeight: '900',
    color: '#22C55E',
    fontVariantNumeric: 'tabular-nums',
  },
  amountLabel: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: '2px',
  },
  footer: {
    height: '42px',
    padding: '0 36px',
    backgroundColor: '#0F172A',
    borderTop: '1px solid #1E293B',
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
    color: '#94A3B8',
  },
};
