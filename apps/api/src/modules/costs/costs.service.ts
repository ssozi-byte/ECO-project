import { prisma } from '../../db.js';

export async function costOverview(organizationId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const byDay = await prisma.normalizedCostLine.groupBy({
    by: ['timeBucket'],
    where: { organizationId, timeBucket: { gte: since } },
    _sum: { amount: true },
    orderBy: { timeBucket: 'asc' },
  });

  const byService = await prisma.normalizedCostLine.groupBy({
    by: ['serviceId'],
    where: { organizationId, timeBucket: { gte: since } },
    _sum: { amount: true },
  });

  const serviceIds = byService.map((s) => s.serviceId).filter(Boolean) as string[];
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(services.map((s) => [s.id, s.name]));

  const total = byService.reduce((acc, s) => acc + Number(s._sum.amount ?? 0), 0);

  return {
    total,
    currency: 'USD',
    days,
    daily: byDay.map((d) => ({
      date: d.timeBucket.toISOString().slice(0, 10),
      amount: Number(d._sum.amount ?? 0),
    })),
    services: byService
      .map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceId ? nameById.get(s.serviceId) ?? 'unknown' : 'unmapped',
        amount: Number(s._sum.amount ?? 0),
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function serviceDrilldown(
  organizationId: string,
  serviceId: string,
  days = 30
) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId },
  });
  if (!service) return null;

  const byDay = await prisma.normalizedCostLine.groupBy({
    by: ['timeBucket'],
    where: { organizationId, serviceId, timeBucket: { gte: since } },
    _sum: { amount: true },
    orderBy: { timeBucket: 'asc' },
  });

  const topResources = await prisma.normalizedCostLine.groupBy({
    by: ['resourceKey'],
    where: { organizationId, serviceId, timeBucket: { gte: since } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10,
  });

  return {
    service,
    daily: byDay.map((d) => ({
      date: d.timeBucket.toISOString().slice(0, 10),
      amount: Number(d._sum.amount ?? 0),
    })),
    topResources: topResources.map((r) => ({
      resourceKey: r.resourceKey,
      amount: Number(r._sum.amount ?? 0),
    })),
  };
}
