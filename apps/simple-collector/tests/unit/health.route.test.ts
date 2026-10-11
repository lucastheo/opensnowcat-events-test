import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { healthRoutes } from '../../src/routes/health.route.js';
import { CsvWriterService } from '../../src/services/csv-writer.service.js';

describe('healthRoutes', () => {
  let dir: string, file: string, app: FastifyInstance, csvWriter: CsvWriterService;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-'));
    file = path.join(dir, 'e.csv');
    csvWriter = new CsvWriterService(file);
    app = Fastify();
    await app.register(healthRoutes, { csvWriter });
  });
  afterEach(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'simple-collector' });
  });

  it('GET /stats reflects writer state', async () => {
    await csvWriter.append({ event_id: 'a', timestamp: 't', source: 'backend', event_type: 'x' });
    const res = await app.inject({ method: 'GET', url: '/stats' });
    expect(res.json()).toEqual({ total_recorded: 1, frontend_events: 0, backend_events: 1, csv_file_path: file });
  });
});
