import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRoutes } from '../../src/routes/reset.route.js';
import { CsvWriterService } from '../../src/services/csv-writer.service.js';

describe('resetRoutes', () => {
  let dir: string, file: string, app: FastifyInstance, csvWriter: CsvWriterService;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reset-'));
    file = path.join(dir, 'e.csv');
    csvWriter = new CsvWriterService(file);
    app = Fastify();
    await app.register(resetRoutes, { csvWriter });
  });
  afterEach(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('POST /reset truncates file and zeroes stats', async () => {
    await csvWriter.append({ event_id: 'a', timestamp: 't', source: 'frontend', event_type: 'x' });
    const res = await app.inject({ method: 'POST', url: '/reset' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'reset', csv_file_path: file });
    expect(await fs.readFile(file, 'utf-8')).toBe('event_id,timestamp,source,event_type\n');
    expect(csvWriter.getStats().total_recorded).toBe(0);
  });
});
