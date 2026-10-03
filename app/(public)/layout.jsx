export default function PublicLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--pf-border)', background: 'var(--pf-primary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--pf-secondary)' }}>PONDFISH</span>
          <nav style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
            <span>Fish Catalogue</span>
            <span>Subscriptions</span>
            <span>Live Truck Tracking</span>
            <span>Customer Login</span>
          </nav>
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '24px', width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
