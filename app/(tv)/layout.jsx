export default function TVLayout({ children }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#020617',
      color: '#FFFFFF',
      fontFamily: 'var(--pf-font-main)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {children}
    </div>
  );
}
