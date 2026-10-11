import { FastifyPluginAsync } from 'fastify';
import { CsvWriterService } from '../services/csv-writer.service.js';

export const resetRoutes: FastifyPluginAsync<{ csvWriter: CsvWriterService }> = async (
  fastify,
  opts
) => {
  const { csvWriter } = opts;

  fastify.post('/reset', async () => {
    await csvWriter.reset();
    return {
      status: 'reset',
      csv_file_path: csvWriter.getStats().csv_file_path,
    };
  });
};
