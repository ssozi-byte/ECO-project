import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { orgsRouter } from './modules/orgs/orgs.routes.js';
import { ingestionRouter } from './modules/ingestion/ingestion.routes.js';
import { costsRouter } from './modules/costs/costs.routes.js';
import { recommendationsRouter } from './modules/recommendations/recommendations.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import './modules/auth/auth.middleware.js';

const app = express();
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/orgs', orgsRouter);
app.use('/api/ingestion', ingestionRouter);
app.use('/api/costs', costsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/audit', auditRouter);

app.listen(config.port, () => {
  logger.info(`API listening on http://localhost:${config.port}`);
});
