import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { AppConfig } from '../../src/config/env.js';

const HEADER = 'event_id,timestamp,source,event_type';

describe('Simple Collector API Integration', () => {
  let app: FastifyInstance | undefined;
  let tempDir: string;
  let csvPath: string;
  let config: AppConfig;

  const makeEvent = (i: number, source: 'frontend' | 'backend' = i % 2 === 0 ? 'frontend' : 'backend') => ({
    event_id: `evt-${i}`,
    timestamp: '2026-10-11T15:00:00.000Z',
    source,
    event_type: 'batch_test',
  });

  const readLines = async (): Promise<string[]> =>
    (await fs.readFile(csvPath, 'utf-8')).trim().split('\n');

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'collector-api-test-'));
    csvPath = path.join(tempDir, 'test-events.csv');
    config = {
      port: 0,
      host: '127.0.0.1',
      corsOrigin: '*',
      csvFilePath: csvPath,
      logLevel: 'silent',
    };
    app = await buildApp(config);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('responds with 200 on GET /health', async () => {
    const response = await app!.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'simple-collector' });
  });

  it('accepts valid POST /collect and writes to CSV', async () => {
    const payload = {
      event_id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
      timestamp: '2026-10-11T15:00:00.000Z',
      source: 'backend',
      event_type: 'backend_api',
    };

    const response = await app!.inject({ method: 'POST', url: '/collect', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: 'recorded', event_id: payload.event_id });

    const lines = await readLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe(`${payload.event_id},${payload.timestamp},backend,backend_api`);
  });

  it('rejects invalid source with 400 and does not write', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/collect',
      payload: { ...makeEvent(1), source: 'invalid_source' },
    });
    expect(response.statusCode).toBe(400);
    expect(await readLines()).toEqual([HEADER]);
  });

  it('rejects payloads with missing fields with 400', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/collect',
      payload: { event_id: 'not-enough-fields', source: 'invalid_source' },
    });
    expect(response.statusCode).toBe(400);

    const { event_type: _omit, ...missing } = makeEvent(2);
    const response2 = await app!.inject({ method: 'POST', url: '/collect', payload: missing });
    expect(response2.statusCode).toBe(400);

    expect(await readLines()).toEqual([HEADER]);
    const stats = (await app!.inject({ method: 'GET', url: '/stats' })).json();
    expect(stats.total_recorded).toBe(0);
  });

  it('rejects payloads with unexpected additional properties with 400', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/collect',
      payload: { ...makeEvent(3), extra_field: 'disallowed' },
    });
    expect(response.statusCode).toBe(400);
    expect(await readLines()).toEqual([HEADER]);
    const stats = (await app!.inject({ method: 'GET', url: '/stats' })).json();
    expect(stats.total_recorded).toBe(0);
  });

  it('reports counters on GET /stats', async () => {
    const empty = (await app!.inject({ method: 'GET', url: '/stats' })).json();
    expect(empty).toEqual({
      total_recorded: 0,
      frontend_events: 0,
      backend_events: 0,
      csv_file_path: csvPath,
    });

    for (const [i, s] of (['frontend', 'frontend', 'backend'] as const).entries()) {
      await app!.inject({ method: 'POST', url: '/collect', payload: makeEvent(i, s) });
    }

    const stats = (await app!.inject({ method: 'GET', url: '/stats' })).json();
    expect(stats.total_recorded).toBe(3);
    expect(stats.frontend_events).toBe(2);
    expect(stats.backend_events).toBe(1);
  });

  it('POST /reset truncates the CSV to header and zeroes stats', async () => {
    for (let i = 0; i < 5; i++) {
      await app!.inject({ method: 'POST', url: '/collect', payload: makeEvent(i) });
    }
    expect(await readLines()).toHaveLength(6);

    const res = await app!.inject({ method: 'POST', url: '/reset' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'reset', csv_file_path: csvPath });

    expect(await fs.readFile(csvPath, 'utf-8')).toBe(`${HEADER}\n`);
    const stats = (await app!.inject({ method: 'GET', url: '/stats' })).json();
    expect(stats).toMatchObject({ total_recorded: 0, frontend_events: 0, backend_events: 0 });

    // Still usable after reset
    await app!.inject({ method: 'POST', url: '/collect', payload: makeEvent(99) });
    expect(await readLines()).toHaveLength(2);
  });

  it('handles 100 concurrent POST /collect with intact lines', async () => {
    const count = 100;
    const responses = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        app!.inject({ method: 'POST', url: '/collect', payload: makeEvent(i) })
      )
    );
    responses.forEach((r) => expect(r.statusCode).toBe(201));

    const lines = await readLines();
    expect(lines).toHaveLength(count + 1);
    expect(lines[0]).toBe(HEADER);

    const ids = new Set<string>();
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      expect(cols).toHaveLength(4);
      expect(cols[1]).toBe('2026-10-11T15:00:00.000Z');
      expect(cols[3]).toBe('batch_test');
      ids.add(cols[0]);
    }
    expect(ids.size).toBe(count);

    const stats = (await app!.inject({ method: 'GET', url: '/stats' })).json();
    expect(stats.total_recorded).toBe(count);
    expect(stats.frontend_events).toBe(50);
    expect(stats.backend_events).toBe(50);
  });

  it('returns CORS headers on OPTIONS preflight and POST with Origin', async () => {
    const origin = 'http://localhost:3000';

    const preflight = await app!.inject({
      method: 'OPTIONS',
      url: '/collect',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('*');
    expect(preflight.headers['access-control-allow-methods']).toContain('POST');

    const post = await app!.inject({
      method: 'POST',
      url: '/collect',
      headers: { origin },
      payload: makeEvent(1),
    });
    expect(post.statusCode).toBe(201);
    expect(post.headers['access-control-allow-origin']).toBe('*');
  });

  it('preserves a pre-existing CSV on app start', async () => {
    await app!.close();
    const existing = `${HEADER}\nold-1,2026-01-01T00:00:00.000Z,frontend,old_event\n`;
    await fs.writeFile(csvPath, existing, 'utf-8');

    app = await buildApp(config);
    expect(await fs.readFile(csvPath, 'utf-8')).toBe(existing);

    await app.inject({ method: 'POST', url: '/collect', payload: makeEvent(1) });
    const lines = await readLines();
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('old-1,2026-01-01T00:00:00.000Z,frontend,old_event');
    expect(lines[2]).toBe('evt-1,2026-10-11T15:00:00.000Z,backend,batch_test');
  });
});
