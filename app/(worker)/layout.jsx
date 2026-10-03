export default function WorkerLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0F172A' }}>
      <header style={{ padding: '16px 24px', background: '#166534', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>PONDFISH WORKER TABLET</span>
          <span style={{ fontSize: '12px', background: '#22C55E', color: '#0F172A', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>STORE TERMINAL</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '14px' }}>
          <span>Offline Sync: Online</span>
          <span>Shift Active</span>
        </div>
      </header>
      <main style={{ flex: 1, padding: '20px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}
