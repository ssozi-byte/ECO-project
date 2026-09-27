'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
  service?: { name: string } | null;
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api<{ recommendations: Rec[] }>(`/recommendations${q}`);
      setRecs(res.recommendations);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setBusy(true);
    setError('');
    try {
      await api('/recommendations/run', { method: 'POST' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: string) {
    try {
      await api(`/recommendations/${id}/actions`, { method: 'POST', body: { action } });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Recommendations</h2>
        <select
          className="input"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="IMPLEMENTED">Implemented</option>
        </select>
        <span style={{ marginLeft: 'auto' }} />
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Running…' : 'Run engine'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Recommendation</th>
              <th>Type</th>
              <th>Service</th>
              <th style={{ textAlign: 'right' }}>Est. savings /mo</th>
              <th style={{ textAlign: 'right' }}>Confidence</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/app/recommendations/${r.id}`}>{r.title}</Link></td>
                <td><span className="badge">{r.type}</span></td>
                <td className="muted">{r.service?.name ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>${r.expectedMonthlySavings.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{Math.round(r.confidence * 100)}%</td>
                <td><span className="badge">{r.status}</span></td>
                <td>
                  {r.status === 'OPEN' && (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" onClick={() => act(r.id, 'ACCEPTED')}>Accept</button>
                      <button className="btn" onClick={() => act(r.id, 'REJECTED')}>Reject</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {recs.length === 0 && (
              <tr><td colSpan={7} className="muted">No recommendations yet — run the engine.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
