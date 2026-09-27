import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { costOverview, serviceDrilldown } from './costs.service.js';

export const costsRouter = Router();

costsRouter.use(requireAuth);

costsRouter.get('/overview', requirePermission('cost:read'), async (req, res) => {
  const days = Math.min(Number(req.query.days ?? 30), 365);
  res.json(await costOverview(req.auth!.organizationId, days));
});

costsRouter.get(
  '/services/:serviceId',
  requirePermission('cost:read'),
  async (req, res) => {
    const days = Math.min(Number(req.query.days ?? 30), 365);
    const result = await serviceDrilldown(
      req.auth!.organizationId,
      req.params.serviceId,
      days
    );
    if (!result) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json(result);
  }
);
