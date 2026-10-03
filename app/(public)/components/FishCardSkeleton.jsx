export default function FishCardSkeleton() {
  return (
    <div style={{
      background: '#0F172A',
      border: '1px solid #1E293B',
      borderRadius: '12px',
      overflow: 'hidden',
      height: '380px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Image Skeleton */}
      <div style={{
        width: '100%',
        height: '180px',
        background: 'linear-gradient(90deg, #1E293B 25%, #334155 50%, #1E293B 75%)',
        backgroundSize: '200% 100%',
        animation: 'pf-pulse 1.5s infinite'
      }} />

      {/* Content Skeleton */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
        <div style={{ width: '60%', height: '20px', background: '#1E293B', borderRadius: '4px' }} />
        <div style={{ width: '90%', height: '14px', background: '#1E293B', borderRadius: '4px' }} />
        <div style={{ width: '75%', height: '14px', background: '#1E293B', borderRadius: '4px' }} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <div style={{ width: '80px', height: '22px', background: '#1E293B', borderRadius: '4px' }} />
          <div style={{ width: '90px', height: '22px', background: '#1E293B', borderRadius: '4px' }} />
        </div>
        <div style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ width: '70px', height: '24px', background: '#1E293B', borderRadius: '4px' }} />
          <div style={{ width: '80px', height: '32px', background: '#1E293B', borderRadius: '6px' }} />
        </div>
      </div>
    </div>
  );
}
