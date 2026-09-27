import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';
import { processBatch } from './modules/ingestion/ingestion.service.js';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const ingestionQueue = new Queue('ingestion', { connection });

export async function enqueueIngestion(batchId: string, content: string) {
  await ingestionQueue.add('process', { batchId, content }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

// Worker entry (run separately with `npm run worker`)
if (process.argv[1]?.endsWith('worker.ts')) {
  const worker = new Worker(
    'ingestion',
    async (job) => {
      const { batchId, content } = job.data as { batchId: string; content: string };
      await processBatch(batchId, content);
    },
    { connection }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Ingestion job failed');
  });
  logger.info('Ingestion worker started');
}
