export default function AdminDashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#F8FAFC' }}>Operations Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>Active Fish Listed</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>--</div>
        </div>
        <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>Batches In Stock</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>--</div>
        </div>
        <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>Active Subscriptions</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38BDF8' }}>--</div>
        </div>
        <div style={{ background: '#1E293B', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>Truck Status</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FACC15' }}>IDLE</div>
        </div>
      </div>
    </div>
  );
}
