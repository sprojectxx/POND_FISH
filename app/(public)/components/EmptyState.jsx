export default function EmptyState({
  title = 'No Fish Available',
  message = 'No fish currently match this selection in our live catalogue.',
  actionLabel = 'View All Fish',
  onAction,
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      background: '#0F172A',
      borderRadius: '12px',
      border: '1px dashed #334155',
      maxWidth: '560px',
      margin: '0 auto',
      width: '100%'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐟</div>
      <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px', lineHeight: '1.6' }}>
        {message}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: '10px 24px',
            background: '#0284C7',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
