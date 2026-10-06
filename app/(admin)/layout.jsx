export default function AdminLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0B1120' }}>
      <aside style={{ width: '260px', background: '#1E293B', borderRight: '1px solid #334155', padding: '24px 16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38BDF8', marginBottom: '32px' }}>
          PONDFISH ADMIN
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#94A3B8' }}>
          <a href="/admin" style={{ color: '#F8FAFC', textDecoration: 'none', padding: '6px 8px', borderRadius: '4px' }}>📊 Executive Dashboard</a>
          <a href="/admin/journeys" style={{ color: '#38BDF8', textDecoration: 'none', padding: '6px 8px', borderRadius: '4px' }}>🚛 GPS Truck Journey</a>
          <a href="/admin/settings" style={{ color: '#94A3B8', textDecoration: 'none', padding: '6px 8px', borderRadius: '4px' }}>⚙️ Business Settings</a>
          <a href="/admin/reports" style={{ color: '#94A3B8', textDecoration: 'none', padding: '6px 8px', borderRadius: '4px' }}>📈 Reports & Exports</a>
          <a href="/admin/audit" style={{ color: '#94A3B8', textDecoration: 'none', padding: '6px 8px', borderRadius: '4px' }}>📋 Audit Trail</a>
          <a href="/admin/exceptions" style={{ color: '#94A3B8', textDecoration: 'none', padding: '6px 8px', borderRadius: '4px' }}>⚠️ Exceptions Center</a>
          <div style={{ margin: '12px 0 6px 0', borderTop: '1px solid #334155', paddingTop: '12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Catalog & Accounts
          </div>
          <span style={{ padding: '4px 8px', color: '#64748B' }}>Fish Master & Pricing</span>
          <span style={{ padding: '4px 8px', color: '#64748B' }}>Freshness Durations</span>
          <span style={{ padding: '4px 8px', color: '#64748B' }}>Stock & Receiving</span>
          <span style={{ padding: '4px 8px', color: '#64748B' }}>Subscription Plans</span>
          <span style={{ padding: '4px 8px', color: '#64748B' }}>Customer Accounts</span>
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
