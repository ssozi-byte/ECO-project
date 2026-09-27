'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Batch {
  id: string;
  fileName: string;
  status: string;
  totalLines: number;
  validLines: number;
  quarantinedLines: number;
  createdAt: string;
}

export default function IngestPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api<{ batches: Batch[] }>('/ingestion');
      setBatches(res.batches);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.slice(result.indexOf(',') + 1));
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api<{ batch: Batch; deduplicated: boolean }>('/ingestion', {
        method: 'POST',
        body: { fileName: file.name, contentBase64 },
      });
      setMessage(
        res.deduplicated
          ? 'Duplicate file detected — returning existing batch (idempotent).'
          : `Imported: ${res.batch.validLines} valid lines, ${res.batch.quarantinedLines} quarantined.`
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="card">
        <h3>Upload billing export</h3>
        <p className="muted">
          CSV with columns: date, service, resource_id, resource_type, region, amount, currency, tags
        </p>
        <input type="file" accept=".csv,text/csv" onChange={upload} disabled={busy} />
        {busy && <p className="muted">Processing…</p>}
        {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h3>Recent batches</h3>
        <table className="data">
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Lines</th>
              <th style={{ textAlign: 'right' }}>Quarantined</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.fileName}</td>
                <td><span className="badge">{b.status}</span></td>
                <td style={{ textAlign: 'right' }}>{b.validLines}/{b.totalLines}</td>
                <td style={{ textAlign: 'right' }}>{b.quarantinedLines}</td>
                <td className="muted">{new Date(b.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={5} className="muted">No batches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
