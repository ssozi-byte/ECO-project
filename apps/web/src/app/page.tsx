import Link from 'next/link';

export default function Landing() {
  return (
    <main>
      <nav className="container" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px' }}>
        <strong>CostOpt</strong>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Log in</Link>
          <Link href="/login" className="btn btn-primary" style={{ padding: '6px 14px' }}>
            Get started
          </Link>
        </div>
      </nav>

      <section className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, margin: '0 0 16px' }}>
          Cut your cloud bill with <span style={{ color: 'var(--accent)' }}>explainable</span> recommendations
        </h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 640, margin: '0 auto 32px' }}>
          Upload a billing export and get a prioritized list of idle resources, right-sizing
          opportunities, and spend anomalies — each with expected monthly savings and the
          reasoning behind it.
        </p>
        <Link href="/login" className="btn btn-primary">
          Start free
        </Link>
      </section>

      <section className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, paddingBottom: 80 }}>
        <div className="card">
          <h3>Ingest</h3>
          <p className="muted">Upload CSV billing exports. Idempotent, validated, with per-line quarantine for bad rows.</p>
        </div>
        <div className="card">
          <h3>Understand</h3>
          <p className="muted">Daily spend trends and per-service breakdowns so you always know your top cost drivers.</p>
        </div>
        <div className="card">
          <h3>Act</h3>
          <p className="muted">Rules-based recommendations with savings estimates, confidence scores, and action tracking.</p>
        </div>
      </section>
    </main>
  );
}
