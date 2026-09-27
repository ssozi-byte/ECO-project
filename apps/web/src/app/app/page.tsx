'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Overview {
  total: number;
  currency: string;
  days: number;
  daily: { date: string; amount: number }[];
  services: { serviceId: string; serviceName: string; amount: number }[];
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Overview>('/costs/overview?days=30')
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const max = Math.max(...data.daily.map((d) => d.amount), 1);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <p className="muted">Total last {data.days} days</p>
          <h2 style={{ margin: 0 }}>
            ${data.total.toFixed(2)} <span className="muted">{data.currency}</span>
          </h2>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <p className="muted">Services tracked</p>
          <h2 style={{ margin: 0 }}>{data.services.length}</h2>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <p className="muted">Daily average</p>
          <h2 style={{ margin: 0 }}>${(data.total / Math.max(data.days, 1)).toFixed(2)}</h2>
        </div>
      </div>

      <div className="card">
        <h3>Daily spend</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, marginTop: 12 }}>
          {data.daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: $${d.amount.toFixed(2)}`}
              style={{
                flex: 1,
                height: `${(d.amount / max) * 100}%`,
                background: 'var(--accent-2)',
                borderRadius: 2,
                minHeight: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Spend by service</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Service</th>
              <th style={{ textAlign: 'right' }}>Last {data.days}d</th>
            </tr>
          </thead>
          <tbody>
            {data.services.map((s) => (
              <tr key={s.serviceId ?? 'unmapped'}>
                <td>{s.serviceName}</td>
                <td style={{ textAlign: 'right' }}>${s.amount.toFixed(2)}</td>
              </tr>
            ))}
            {data.services.length === 0 && (
              <tr><td colSpan={2} className="muted">No data yet — upload a billing export.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
