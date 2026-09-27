import { prisma } from '../../db.js';

export async function recordAudit(params: {
  organizationId: string;
  userId?: string;
  action: string;
  detail?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action,
      detail: (params.detail ?? undefined) as never,
    },
  });
}

export async function listAudit(organizationId: string, limit = 100, offset = 0) {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
