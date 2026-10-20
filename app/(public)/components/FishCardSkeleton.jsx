export default function FishCardSkeleton() {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        height: '380px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(15, 44, 89, 0.04)',
      }}
    >
      {/* Image Skeleton */}
      <div
        style={{
          width: '100%',
          height: '190px',
          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: 'pf-pulse 1.5s infinite',
        }}
      />

      {/* Content Skeleton */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
        <div style={{ width: '60%', height: '18px', background: '#e2e8f0', borderRadius: '4px' }} />
        <div style={{ width: '40%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
        <div style={{ width: '90%', height: '14px', background: '#f1f5f9', borderRadius: '4px' }} />
        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
          <div style={{ width: '70px', height: '20px', background: '#e2e8f0', borderRadius: '4px' }} />
          <div style={{ width: '80px', height: '20px', background: '#e2e8f0', borderRadius: '4px' }} />
        </div>
        <div
          style={{
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ width: '80px', height: '22px', background: '#e2e8f0', borderRadius: '4px' }} />
          <div style={{ width: '70px', height: '28px', background: '#e2e8f0', borderRadius: '6px' }} />
        </div>
      </div>
    </div>
  );
}
