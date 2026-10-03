import Header from './components/Header';
import Footer from './components/Footer';

export default function PublicLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0B1120',
      color: '#F8FAFC'
    }}>
      <Header />
      <main style={{ flex: 1, width: '100%' }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
