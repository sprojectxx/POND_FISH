export default function PublicHomePage() {
  return (
    <section style={{ textAlign: 'center', padding: '60px 0' }}>
      <h1 style={{ fontSize: '36px', marginBottom: '16px', color: 'var(--pf-text-primary)' }}>
        PondFish Freshness Ecosystem
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--pf-text-secondary)', maxWidth: '600px', margin: '0 auto 32px' }}>
        Single Store + Dedicated Truck Fresh Catch. Transparent 0-24h Green Freshness Guarantee.
      </p>
      <div style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--pf-secondary)', borderRadius: 'var(--pf-radius-md)', fontWeight: 600 }}>
        Browse Today's Catch
      </div>
    </section>
  );
}
