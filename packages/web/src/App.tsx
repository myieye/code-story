import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? setHealth('ok') : setHealth('error')))
      .catch(() => setHealth('error'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1120, margin: '4rem auto' }}>
      <h1>code-story</h1>
      <p>No book loaded yet — diff ingestion arrives in the next slice.</p>
      <p>
        Daemon: {health === 'checking' ? 'checking…' : health === 'ok' ? 'connected' : 'unreachable'}
      </p>
    </main>
  );
}
