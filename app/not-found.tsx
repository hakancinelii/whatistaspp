import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            fontFamily: 'sans-serif',
            padding: '20px',
            textAlign: 'center'
        }}>
            <h2 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h2>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Sayfa Bulunamadı</p>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
            <Link
                href="/"
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#8b5cf6',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 'bold'
                }}
            >
                Ana Sayfaya Dön
            </Link>
        </div>
    );
}
