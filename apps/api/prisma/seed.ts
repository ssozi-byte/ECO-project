import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const DEMO_CSV_HEADER = 'date,service,resource_id,resource_type,region,amount,currency,tags';

function buildDemoCsv(): string {
  const rows: string[] = [DEMO_CSV_HEADER];
  const today = new Date();
  const day = (offset: number) =>
    new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);

  for (let i = 29; i >= 0; i--) {
    // healthy service
    rows.push(`${day(i)},api-gateway,i-0abc123,ec2,us-east-1,${(12 + Math.random() * 3).toFixed(2)},USD,team=platform`);
    // idle resource: near-zero every day
    rows.push(`${day(i)},api-gateway,i-0idle999,ec2,us-east-1,0.00,USD,team=platform;status=zombie`);
    // spiky resource for anomaly detection (spike on last day)
    const spike = i === 0 ? 80 : 10 + Math.random() * 2;
    rows.push(`${day(i)},data-pipeline,rds-prod-01,rds,us-east-1,${spike.toFixed(2)},USD,team=data`);
    rows.push(`${day(i)},data-pipeline,etl-job-42,glue,us-east-1,${(4 + Math.random()).toFixed(2)},USD,team=data`);
  }
  return rows.join('\n');
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: { id: 'demo-org', name: 'Demo Corp' },
  });

  const passwordHash = await bcrypt.hash('demo1234', 10);
  for (const [email, name, role] of [
    ['owner@demo.io', 'Owner Olive', 'OWNER'],
    ['analyst@demo.io', 'Analyst Andy', 'ANALYST'],
  ] as const) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash },
    });
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { role: role as never },
      create: { userId: user.id, organizationId: org.id, role: role as never },
    });
  }

  const csv = buildDemoCsv();
  const contentHash = createHash('sha256').update(csv).digest('hex');
  const existing = await prisma.ingestionBatch.findUnique({
    where: { organizationId_contentHash: { organizationId: org.id, contentHash } },
  });
  if (existing) {
    console.log('Seed data already present; skipping ingestion.');
    return;
  }

  const batch = await prisma.ingestionBatch.create({
    data: {
      organizationId: org.id,
      fileName: 'demo-billing.csv',
      contentHash,
      byteSize: Buffer.byteLength(csv),
      status: 'PARSING',
    },
  });

  // Reuse API ingestion logic indirectly by inline parsing here to keep seed standalone
  const { parseBillingCsv } = await import('../src/modules/ingestion/csv.parser.js');
  const { lines, quarantined } = parseBillingCsv(csv);

  const serviceNames = [...new Set(lines.map((l) => l.service))];
  const serviceIds = new Map<string, string>();
  for (const name of serviceNames) {
    const svc = await prisma.service.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
    serviceIds.set(name, svc.id);
  }

  await prisma.normalizedCostLine.createMany({
    data: lines.map((l) => ({
      organizationId: org.id,
      batchId: batch.id,
      lineNumber: l.lineNumber,
      serviceId: serviceIds.get(l.service)!,
      timeBucket: new Date(`${l.date}T00:00:00.000Z`),
      resourceKey: l.resourceKey,
      resourceType: l.resourceType,
      region: l.region,
      amount: l.amount,
      currency: l.currency,
      tags: (l.tags ?? undefined) as never,
    })),
  });

  await prisma.ingestionBatch.update({
    where: { id: batch.id },
    data: {
      status: quarantined.length ? 'PARTIAL' : 'COMPLETED',
      totalLines: lines.length + quarantined.length,
      validLines: lines.length,
      quarantinedLines: quarantined.length,
      completedAt: new Date(),
    },
  });

  console.log('Seeded demo org, users, and 30 days of billing data.');
  console.log('Login: owner@demo.io / demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
