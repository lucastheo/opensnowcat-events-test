import { FastifyPluginAsync } from 'fastify';
import { collectSchema } from '../schemas/collect.schema.js';
import { CsvWriterService, EventRecord } from '../services/csv-writer.service.js';

export const collectRoutes: FastifyPluginAsync<{ csvWriter: CsvWriterService }> = async (
  fastify,
  opts
) => {
  const { csvWriter } = opts;

  fastify.post<{ Body: EventRecord }>(
    '/collect',
    { schema: collectSchema },
    async (request, reply) => {
      const record = request.body;

      await csvWriter.append(record);

      return reply.code(201).send({
        status: 'recorded',
        event_id: record.event_id,
      });
    }
  );
};
