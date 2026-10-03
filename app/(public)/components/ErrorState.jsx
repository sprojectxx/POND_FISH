export default function ErrorState({
  title = 'Catalogue Loading Error',
  message = "We couldn't connect to the live fish inventory right now.",
  onRetry,
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      background: 'rgba(239, 68, 68, 0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      maxWidth: '560px',
      margin: '0 auto',
      width: '100%'
    }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#EF4444', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px', lineHeight: '1.6' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '10px 24px',
            background: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #475569',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          🔄 Try Again
        </button>
      )}
    </div>
  );
}
