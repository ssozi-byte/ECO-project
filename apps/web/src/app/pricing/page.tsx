import Link from 'next/link';

export default function Pricing() {
  return (
    <main className="container" style={{ padding: '60px 24px' }}>
      <h1>Pricing</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 32 }}>
        <div className="card">
          <h3>Free</h3>
          <p style={{ fontSize: 32, margin: '8px 0' }}>$0</p>
          <p className="muted">1 organization, monthly exports, all recommendation types.</p>
          <Link href="/login" className="btn">Start</Link>
        </div>
        <div className="card">
          <h3>Team</h3>
          <p style={{ fontSize: 32, margin: '8px 0' }}>$99<span className="muted" style={{ fontSize: 14 }}>/mo</span></p>
          <p className="muted">Unlimited members, RBAC, audit logs, weekly scheduled runs.</p>
          <Link href="/login" className="btn btn-primary">Start</Link>
        </div>
        <div className="card">
          <h3>Enterprise</h3>
          <p style={{ fontSize: 32, margin: '8px 0' }}>Custom</p>
          <p className="muted">SSO/SAML, API connectors, dedicated support.</p>
          <Link href="/login" className="btn">Contact</Link>
        </div>
      </div>
    </main>
  );
}
