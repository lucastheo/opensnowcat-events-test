import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectRoutes } from '../../src/routes/collect.route.js';
import { CsvWriterService } from '../../src/services/csv-writer.service.js';

describe('collectRoutes', () => {
  let dir: string, file: string, app: FastifyInstance, csvWriter: CsvWriterService;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'collect-'));
    file = path.join(dir, 'e.csv');
    csvWriter = new CsvWriterService(file);
    await csvWriter.initialize();
    app = Fastify();
    await app.register(collectRoutes, { csvWriter });
  });
  afterEach(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const valid = { event_id: 'e1', timestamp: '2026-01-01T00:00:00Z', source: 'frontend', event_type: 'click' };

  it('records a valid event with 201', async () => {
    const res = await app.inject({ method: 'POST', url: '/collect', payload: valid });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: 'recorded', event_id: 'e1' });
    expect(await fs.readFile(file, 'utf-8')).toContain('e1,2026-01-01T00:00:00Z,frontend,click\n');
  });

  it.each([
    ['missing field', { event_id: 'e1' }],
    ['bad source', { ...valid, source: 'other' }],
    ['empty event_id', { ...valid, event_id: '' }],
  ])('rejects %s with 400 and writes nothing', async (_n, payload) => {
    const res = await app.inject({ method: 'POST', url: '/collect', payload });
    expect(res.statusCode).toBe(400);
    expect(csvWriter.getStats().total_recorded).toBe(0);
  });

  it('returns 500 when the writer fails', async () => {
    csvWriter.append = async () => { throw new Error('boom'); };
    const res = await app.inject({ method: 'POST', url: '/collect', payload: valid });
    expect(res.statusCode).toBe(500);
  });
});

describe('collectRoutes extra properties', () => {
  it('rejects unknown properties with 400 Bad Request when removeAdditional is false', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'collect-x-'));
    const file = path.join(dir, 'e.csv');
    const csvWriter = new CsvWriterService(file);
    await csvWriter.initialize();
    const app = Fastify({
      ajv: {
        customOptions: {
          removeAdditional: false,
        },
      },
    });
    await app.register(collectRoutes, { csvWriter });
    const res = await app.inject({
      method: 'POST',
      url: '/collect',
      payload: { event_id: 'e1', timestamp: 't', source: 'frontend', event_type: 'c', extra: 'zzz' },
    });
    expect(res.statusCode).toBe(400);
    expect(await fs.readFile(file, 'utf-8')).not.toContain('zzz');
    expect(csvWriter.getStats().total_recorded).toBe(0);
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
