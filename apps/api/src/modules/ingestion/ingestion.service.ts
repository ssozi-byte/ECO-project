import { createHash } from 'crypto';
import { prisma } from '../../db.js';
import { parseBillingCsv } from './csv.parser.js';
import { recordAudit } from '../audit/audit.service.js';
import { logger } from '../../logger.js';

/**
 * Idempotency: content hash per organization. Re-uploading the same file
 * short-circuits and returns the existing batch.
 */
export async function createBatch(params: {
  organizationId: string;
  userId: string;
  fileName: string;
  content: string;
}) {
  const contentHash = createHash('sha256').update(params.content).digest('hex');
  const byteSize = Buffer.byteLength(params.content, 'utf8');

  const existing = await prisma.ingestionBatch.findUnique({
    where: {
      organizationId_contentHash: {
        organizationId: params.organizationId,
        contentHash,
      },
    },
  });
  if (existing) {
    return { batch: existing, deduplicated: true };
  }

  const batch = await prisma.ingestionBatch.create({
    data: {
      organizationId: params.organizationId,
      fileName: params.fileName,
      contentHash,
      byteSize,
      status: 'PARSING',
    },
  });

  await recordAudit({
    organizationId: params.organizationId,
    userId: params.userId,
    action: 'ingestion.uploaded',
    detail: { batchId: batch.id, fileName: params.fileName, byteSize },
  });

  // Process inline for MVP; move to BullMQ worker for scale.
  await processBatch(batch.id, params.content);
  const processed = await prisma.ingestionBatch.findUniqueOrThrow({
    where: { id: batch.id },
  });
  return { batch: processed, deduplicated: false };
}

export async function processBatch(batchId: string, content: string) {
  try {
    await prisma.ingestionBatch.update({ where: { id: batchId }, data: { status: 'PARSING' } });
    const { lines, quarantined } = parseBillingCsv(content);

    // Persist raw rows for lineage (quarantined rows keep their error)
    await prisma.rawBillingLine.createMany({
      data: [
        ...lines.map((l) => ({
          batchId,
          lineNumber: l.lineNumber,
          payload: l as never,
        })),
        ...quarantined.map((q) => ({
          batchId,
          lineNumber: q.lineNumber,
          payload: { raw: q.raw } as never,
          error: q.error,
        })),
      ],
    });

    // Resolve/create services (per-org dimension mapping)
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: 'NORMALIZING' },
    });

    const orgId = (await prisma.ingestionBatch.findUniqueOrThrow({ where: { id: batchId } }))
      .organizationId;

    const serviceNames = [...new Set(lines.map((l) => l.service))];
    const serviceIds = new Map<string, string>();
    for (const name of serviceNames) {
      const service = await prisma.service.upsert({
        where: { organizationId_name: { organizationId: orgId, name } },
        update: {},
        create: { organizationId: orgId, name },
      });
      serviceIds.set(name, service.id);
    }

    // Normalize + store cost lines (idempotent per batch via unique [batchId, lineNumber])
    let valid = 0;
    for (const l of lines) {
      await prisma.normalizedCostLine.upsert({
        where: { batchId_lineNumber: { batchId, lineNumber: l.lineNumber } },
        update: {},
        create: {
          organizationId: orgId,
          batchId,
          lineNumber: l.lineNumber,
          serviceId: serviceIds.get(l.service) ?? null,
          timeBucket: new Date(`${l.date}T00:00:00.000Z`),
          resourceKey: l.resourceKey,
          resourceType: l.resourceType,
          region: l.region,
          amount: l.amount,
          currency: l.currency,
          tags: (l.tags ?? undefined) as never,
        },
      });
      valid++;
    }

    const status = quarantined.length > 0 ? 'PARTIAL' : 'COMPLETED';
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: {
        status,
        totalLines: lines.length + quarantined.length,
        validLines: valid,
        quarantinedLines: quarantined.length,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    logger.error({ err, batchId }, 'Ingestion batch failed');
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: 'FAILED', error: (err as Error).message, completedAt: new Date() },
    });
    throw err;
  }
}

export async function listBatches(organizationId: string, limit = 50, offset = 0) {
  return prisma.ingestionBatch.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
