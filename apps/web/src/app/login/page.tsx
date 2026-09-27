'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const res = await api<{ token: string }>('/auth/login', {
          method: 'POST',
          body: { email: form.email, password: form.password },
        });
        setToken(res.token);
      } else {
        const res = await api<{ token: string }>('/auth/register', {
          method: 'POST',
          body: form,
        });
        setToken(res.token);
      }
      router.push('/app');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420, padding: '80px 24px' }}>
      <h1>{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {mode === 'register' && (
          <>
            <input className="input" placeholder="Your name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input" placeholder="Organization name" value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })} required />
          </>
        )}
        <input className="input" type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        {mode === 'login' ? "No account? " : 'Already registered? '}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}>
          {mode === 'login' ? 'Register' : 'Log in'}
        </a>
      </p>
      <p className="muted">Demo: owner@demo.io / demo1234</p>
    </main>
  );
}
