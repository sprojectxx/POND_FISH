import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      background: '#070D19',
      borderTop: '1px solid #1E293B',
      padding: '64px 24px 32px',
      color: '#94A3B8',
      fontSize: '14px',
      marginTop: 'auto'
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '40px',
        marginBottom: '48px'
      }}>
        {/* Col 1: Brand Info */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '22px' }}>🐟</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
              POND<span style={{ color: '#38BDF8' }}>FISH</span>
            </span>
          </div>
          <p style={{ lineHeight: '1.6', marginBottom: '16px', color: '#64748B' }}>
            Single Store + Dedicated Truck Fresh Catch. Direct daily lake harvest transported to our Bangalore store with 0–24h green freshness guarantee.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ background: '#1E293B', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', color: '#22C55E', fontWeight: '600' }}>
              ✓ 100% Chemical Free
            </span>
            <span style={{ background: '#1E293B', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', color: '#38BDF8', fontWeight: '600' }}>
              ✓ Direct Lake Sourcing
            </span>
          </div>
        </div>

        {/* Col 2: Navigation */}
        <div>
          <h4 style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
            Discover
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li>
              <Link href="/fish" style={{ color: '#94A3B8', transition: 'color 0.2s' }}>
                All Fish Varieties
              </Link>
            </li>
            <li>
              <Link href="/categories" style={{ color: '#94A3B8', transition: 'color 0.2s' }}>
                Categories
              </Link>
            </li>
            <li>
              <Link href="/discounts" style={{ color: '#94A3B8', transition: 'color 0.2s' }}>
                Active Promotions & Offers
              </Link>
            </li>
            <li>
              <Link href="/about" style={{ color: '#94A3B8', transition: 'color 0.2s' }}>
                Our Freshness Promise
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Physical Store */}
        <div>
          <h4 style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
            Store Hours & Location
          </h4>
          <p style={{ lineHeight: '1.6', marginBottom: '12px' }}>
            <strong style={{ color: '#F8FAFC' }}>PondFish Main Counter:</strong><br />
            123 Fresh Lake Road, Water Town<br />
            Bangalore, Karnataka — 560001
          </p>
          <p style={{ lineHeight: '1.6', color: '#64748B' }}>
            <strong>Daily Hours:</strong> 06:00 AM – 09:00 PM<br />
            <strong>Truck Arrival Window:</strong> 07:00 AM – 08:30 AM
          </p>
        </div>

        {/* Col 4: Freshness Standard */}
        <div>
          <h4 style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
            Freshness Standard
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A' }}></span>
              <span><strong>Green (0–24h):</strong> Peak Fresh Catch</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748B' }}></span>
              <span><strong>Grey (24–48h):</strong> Day Catch (Discounted)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#DC2626' }}></span>
              <span><strong>Red (48h+):</strong> Clearance & Auto-Scrap</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        paddingTop: '24px',
        borderTop: '1px solid #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: '12px',
        color: '#64748B'
      }}>
        <span>&copy; {new Date().getFullYear()} PondFish Ecosystem. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Food Safety & Licensing</span>
        </div>
      </div>
    </footer>
  );
}
