import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { createBatch, listBatches } from './ingestion.service.js';
import { completeIngestionSchema, listQuerySchema } from '@costopt/shared';

export const ingestionRouter = Router();

ingestionRouter.use(requireAuth);

ingestionRouter.post(
  '/',
  requirePermission('ingestion:create'),
  async (req, res) => {
    const parsed = completeIngestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
      return;
    }
    try {
      const content = Buffer.from(parsed.data.contentBase64, 'base64').toString('utf8');
      const result = await createBatch({
        organizationId: req.auth!.organizationId,
        userId: req.auth!.userId,
        fileName: parsed.data.fileName,
        content,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: 'Ingestion failed', detail: (err as Error).message });
    }
  }
);

ingestionRouter.get('/', requirePermission('ingestion:read'), async (req, res) => {
  const q = listQuerySchema.parse(req.query);
  const batches = await listBatches(req.auth!.organizationId, q.limit, q.offset);
  res.json({ batches });
});
