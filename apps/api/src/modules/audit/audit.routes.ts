import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { listAudit } from './audit.service.js';

export const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get('/', requirePermission('audit:read'), async (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const offset = Number(req.query.offset ?? 0);
  const logs = await listAudit(req.auth!.organizationId, limit, offset);
  res.json({ logs });
});
