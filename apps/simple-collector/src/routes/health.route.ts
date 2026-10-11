import { FastifyPluginAsync } from 'fastify';
import { CsvWriterService } from '../services/csv-writer.service.js';

export const healthRoutes: FastifyPluginAsync<{ csvWriter: CsvWriterService }> = async (
  fastify,
  opts
) => {
  const { csvWriter } = opts;

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'simple-collector',
  }));

  fastify.get('/stats', async () => csvWriter.getStats());
};
