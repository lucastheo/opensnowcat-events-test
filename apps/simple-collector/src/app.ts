import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig } from './config/env.js';
import { CsvWriterService } from './services/csv-writer.service.js';
import { collectRoutes } from './routes/collect.route.js';
import { healthRoutes } from './routes/health.route.js';
import { resetRoutes } from './routes/reset.route.js';

export async function buildApp(
  config: AppConfig,
  csvWriterService?: CsvWriterService
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  // Enable CORS for browser Frontend requests
  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  const csvWriter = csvWriterService ?? new CsvWriterService(config.csvFilePath);
  await csvWriter.initialize();

  // Register routes
  await app.register(collectRoutes, { csvWriter });
  await app.register(healthRoutes, { csvWriter });
  await app.register(resetRoutes, { csvWriter });

  return app;
}
