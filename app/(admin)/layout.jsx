export default function AdminLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0B1120' }}>
      <aside style={{ width: '260px', background: '#1E293B', borderRight: '1px solid #334155', padding: '24px 16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', marginBottom: '32px' }}>
          PONDFISH ADMIN
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#94A3B8' }}>
          <a href="/admin" style={{ color: '#94A3B8', textDecoration: 'none' }}>Overview</a>
          <span>Fish Master & Pricing</span>
          <span>Freshness Durations</span>
          <span>Stock & Receiving</span>
          <span>Subscription Plans</span>
          <span>Customer Accounts</span>
          <a href="/admin/journeys" style={{ color: '#38BDF8', textDecoration: 'none', fontWeight: 'bold' }}>
            🚛 GPS Truck Journey
          </a>
          <span>Audit Logs</span>
          <span>System Settings</span>
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '16px 32px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#94A3B8' }}>PondFish Enterprise Operations</span>
          <span style={{ fontSize: '14px', color: '#F8FAFC' }}>Administrator Session</span>
        </header>
        <main style={{ flex: 1, padding: '32px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
