import { FastifySchema } from 'fastify';

export const collectSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['event_id', 'timestamp', 'source', 'event_type'],
    properties: {
      event_id: { type: 'string', minLength: 1 },
      timestamp: { type: 'string', minLength: 1 },
      source: { type: 'string', enum: ['frontend', 'backend'] },
      event_type: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        event_id: { type: 'string' },
      },
      required: ['status', 'event_id'],
    },
  },
};
