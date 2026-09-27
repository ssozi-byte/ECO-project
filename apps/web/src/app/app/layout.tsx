'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getToken } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return <main className="container" style={{ padding: 40 }}><p className="muted">Loading…</p></main>;

  return (
    <div>
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container" style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '14px 24px' }}>
          <Link href="/app"><strong>CostOpt</strong></Link>
          <Link href="/app">Overview</Link>
          <Link href="/app/ingest">Ingest</Link>
          <Link href="/app/recommendations">Recommendations</Link>
          <Link href="/app/settings">Settings</Link>
          <span style={{ marginLeft: 'auto' }} />
          <button
            className="btn"
            onClick={() => {
              clearToken();
              router.push('/login');
            }}
          >
            Log out
          </button>
        </div>
      </nav>
      <main className="container" style={{ padding: '32px 24px' }}>{children}</main>
    </div>
  );
}
