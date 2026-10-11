import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AppConfig } from '../../src/config/env.js';
import { CsvWriterService } from '../../src/services/csv-writer.service.js';

describe('buildApp', () => {
  let dir: string, config: AppConfig;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'app-'));
    config = {
      port: 0, host: '127.0.0.1', corsOrigin: 'http://front.test',
      csvFilePath: path.join(dir, 'sub', 'e.csv'), logLevel: 'silent',
    };
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('initializes the CSV and registers all routes', async () => {
    const app = await buildApp(config);
    expect(await fs.readFile(config.csvFilePath, 'utf-8')).toBe('event_id,timestamp,source,event_type\n');
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const c = await app.inject({
      method: 'POST', url: '/collect',
      payload: { event_id: 'e', timestamp: 't', source: 'backend', event_type: 'x' },
    });
    expect(c.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/stats' })).json().total_recorded).toBe(1);
    expect((await app.inject({ method: 'POST', url: '/reset' })).json().status).toBe('reset');
    await app.close();
  });

  it('applies CORS origin', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://front.test' } });
    expect(res.headers['access-control-allow-origin']).toBe('http://front.test');
    await app.close();
  });

  it('uses an injected writer', async () => {
    const w = new CsvWriterService(path.join(dir, 'inj.csv'));
    const app = await buildApp(config, w);
    const res = await app.inject({ method: 'GET', url: '/stats' });
    expect(res.json().csv_file_path).toBe(path.join(dir, 'inj.csv'));
    await app.close();
  });
});
