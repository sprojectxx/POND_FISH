export default function TVPortalPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '24px 40px', background: '#0F172A', borderBottom: '2px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '1px', color: '#38BDF8' }}>
            PONDFISH FRESH COUNTER
          </h1>
          <p style={{ fontSize: '16px', color: '#94A3B8', marginTop: '4px' }}>
            Live Store Checkout Display
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }}></span>
          <span style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC' }}>LIVE FEED ACTIVE</span>
        </div>
      </header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px' }}>
          <div style={{ fontSize: '24px', color: '#64748B', marginBottom: '16px' }}>
            Awaiting Next Completed Counter Checkout
          </div>
          <div style={{ fontSize: '16px', color: '#475569' }}>
            Realtime WebSocket feed will broadcast confirmed store transactions immediately.
          </div>
        </div>
      </main>
    </div>
  );
}
