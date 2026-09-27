import { Router } from 'express';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { runRecommendations } from './engine.js';
import { recordActionSchema, listQuerySchema } from '@costopt/shared';
import { recordAudit } from '../audit/audit.service.js';

export const recommendationsRouter = Router();

recommendationsRouter.use(requireAuth);

recommendationsRouter.post(
  '/run',
  requirePermission('recommendation:run'),
  async (req, res) => {
    try {
      const result = await runRecommendations(req.auth!.organizationId, req.auth!.userId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Run failed', detail: (err as Error).message });
    }
  }
);

recommendationsRouter.get('/', requirePermission('recommendation:read'), async (req, res) => {
  const q = listQuerySchema.parse(req.query);
  const where = {
    organizationId: req.auth!.organizationId,
    ...(q.status ? { status: q.status as never } : {}),
    ...(q.type ? { type: q.type as never } : {}),
  };
  const [recommendations, total] = await Promise.all([
    prisma.recommendation.findMany({
      where,
      orderBy: { expectedMonthlySavings: 'desc' },
      take: q.limit,
      skip: q.offset,
      include: { service: { select: { name: true } } },
    }),
    prisma.recommendation.count({ where }),
  ]);
  res.json({ recommendations, total });
});

recommendationsRouter.get(
  '/:id',
  requirePermission('recommendation:read'),
  async (req, res) => {
    const rec = await prisma.recommendation.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
      include: {
        service: { select: { name: true } },
        ruleVersion: { select: { version: true } },
        actions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!rec) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ recommendation: rec });
  }
);

recommendationsRouter.post(
  '/:id/actions',
  requirePermission('recommendation:act'),
  async (req, res) => {
    const parsed = recordActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
      return;
    }
    const rec = await prisma.recommendation.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!rec) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const [action] = await prisma.$transaction([
      prisma.recommendationAction.create({
        data: {
          recommendationId: rec.id,
          userId: req.auth!.userId,
          action: parsed.data.action,
          note: parsed.data.note,
        },
      }),
      prisma.recommendation.update({
        where: { id: rec.id },
        data: { status: parsed.data.action },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: req.auth!.organizationId,
          userId: req.auth!.userId,
          action: `recommendation.${parsed.data.action.toLowerCase()}`,
          detail: { recommendationId: rec.id, note: parsed.data.note },
        },
      }),
    ]);
    res.status(201).json({ action });
  }
);
