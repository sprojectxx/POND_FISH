import Header from './components/Header';
import Footer from './components/Footer';
import './public.css';

export default function PublicLayout({ children }) {
  return (
    <div className="pf-public-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
