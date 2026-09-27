'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Org {
  id: string;
  name: string;
  users: { id: string; role: string; user: { email: string; name: string } }[];
  invites: { id: string; email: string; role: string; token: string }[];
}

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  detail?: unknown;
}

export default function SettingsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ANALYST');
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    api<{ organization: Org }>('/orgs/me')
      .then((res) => setOrg(res.organization))
      .catch((err) => setError((err as Error).message));
    api<{ logs: AuditEntry[] }>('/audit?limit=20')
      .then((res) => setAudit(res.logs))
      .catch(() => {});
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api<{ invite: { token: string } }>('/orgs/invites', {
        method: 'POST',
        body: { email: inviteEmail, role: inviteRole },
      });
      setInviteLink(`${window.location.origin}/login?invite=${res.invite.token}`);
      setInviteEmail('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!org) return <p className="muted">{error || 'Loading…'}</p>;

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 860 }}>
      <div className="card">
        <h3>Organization</h3>
        <p>{org.name}</p>
      </div>

      <div className="card">
        <h3>Members</h3>
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th></tr>
          </thead>
          <tbody>
            {org.users.map((m) => (
              <tr key={m.id}>
                <td>{m.user.name}</td>
                <td className="muted">{m.user.email}</td>
                <td><span className="badge">{m.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Invite a member</h3>
        <form onSubmit={invite} style={{ display: 'flex', gap: 8 }}>
          <input className="input" type="email" placeholder="email@company.com" value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)} required />
          <select className="input" style={{ width: 140 }} value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}>
            <option value="ADMIN">ADMIN</option>
            <option value="ANALYST">ANALYST</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button className="btn btn-primary">Invite</button>
        </form>
        {error && <p className="error-text">{error}</p>}
        {inviteLink && (
          <p className="muted" style={{ marginTop: 8 }}>
            Invite link (MVP — share manually): <code>{inviteLink}</code>
          </p>
        )}
      </div>

      <div className="card">
        <h3>Recent audit log</h3>
        {audit.map((a) => (
          <p key={a.id} style={{ margin: '6px 0' }}>
            <span className="badge">{a.action}</span>{' '}
            <span className="muted">{new Date(a.createdAt).toLocaleString()}</span>
          </p>
        ))}
        {audit.length === 0 && <p className="muted">No audit entries visible for your role.</p>}
      </div>
    </div>
  );
}
