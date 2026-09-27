'use client';

import { use, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Rec {
  id: string;
  type: string;
  title: string;
  description: string;
  resourceKey: string;
  expectedMonthlySavings: number;
  currency: string;
  confidence: number;
  status: string;
  inputs: Record<string, unknown>;
  service?: { name: string } | null;
  ruleVersion?: { version: number } | null;
  actions: { id: string; action: string; note?: string; createdAt: string }[];
}

export default function RecommendationDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [rec, setRec] = useState<Rec | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api<{ recommendation: Rec }>(`/recommendations/${params.id}`);
      setRec(res.recommendation);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function act(action: string) {
    await api(`/recommendations/${params.id}/actions`, { method: 'POST', body: { action } });
    await load();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!rec) return <p className="muted">Loading…</p>;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <button className="btn" style={{ justifySelf: 'start' }} onClick={() => router.back()}>← Back</button>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge">{rec.type}</span>
          <span className="badge">{rec.status}</span>
        </div>
        <h2 style={{ margin: '12px 0 8px' }}>{rec.title}</h2>
        <p>{rec.description}</p>
        <p style={{ fontSize: 22, margin: '8px 0' }}>
          ${rec.expectedMonthlySavings.toFixed(2)}
          <span className="muted" style={{ fontSize: 14 }}> est. savings / month</span>
        </p>
        <p className="muted">
          Resource: {rec.resourceKey} · Service: {rec.service?.name ?? '—'} · Rule v
          {rec.ruleVersion?.version ?? '?'} · Confidence {Math.round(rec.confidence * 100)}%
        </p>
        {rec.status === 'OPEN' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => act('ACCEPTED')}>Accept</button>
            <button className="btn" onClick={() => act('REJECTED')}>Reject</button>
            <button className="btn" onClick={() => act('IMPLEMENTED')}>Mark implemented</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Why this recommendation? (inputs)</h3>
        <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, overflow: 'auto' }}>
          {JSON.stringify(rec.inputs, null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>Action history</h3>
        {rec.actions.length === 0 && <p className="muted">No actions recorded.</p>}
        {rec.actions.map((a) => (
          <p key={a.id} style={{ margin: '6px 0' }}>
            <span className="badge">{a.action}</span>{' '}
            <span className="muted">{new Date(a.createdAt).toLocaleString()}{a.note ? ` — ${a.note}` : ''}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
