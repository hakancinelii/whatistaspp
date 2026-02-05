'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

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
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Bir şeyler ters gitti!</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Uygulamada bir hata oluştu.</p>
            <button
                onClick={() => reset()}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#8b5cf6',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}
            >
                Tekrar Dene
            </button>
        </div>
    );
}
