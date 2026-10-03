export default function WorkerHomePage() {
  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#F8FAFC' }}>Worker Quick Actions</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#22C55E' }}>Scan Booking QR</h2>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Verify customer online order for fulfillment.</p>
        </div>
        <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#38BDF8' }}>Upload Bill Slip (OCR)</h2>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Capture weighing scale slip for automatic line extraction.</p>
        </div>
        <div style={{ background: '#1E293B', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#FACC15' }}>Store Checkout & Cash</h2>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Finalize counter transactions with optional cash or subscription balance.</p>
        </div>
      </div>
    </div>
  );
}
