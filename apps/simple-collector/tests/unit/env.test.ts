import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

const KEYS = ['PORT', 'HOST', 'CORS_ORIGIN', 'CSV_FILE_PATH', 'EVENTS_CSV_PATH', 'LOG_LEVEL'];

describe('loadConfig', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('returns defaults', () => {
    const c = loadConfig();
    expect(c.port).toBe(5000);
    expect(c.host).toBe('0.0.0.0');
    expect(c.corsOrigin).toBe('*');
    expect(c.logLevel).toBe('info');
    expect(c.csvFilePath).toBe(path.resolve(process.cwd(), './data/events.csv'));
  });

  it('reads overrides from env', () => {
    process.env.PORT = '6123';
    process.env.HOST = '127.0.0.1';
    process.env.CORS_ORIGIN = 'http://x.test';
    process.env.LOG_LEVEL = 'debug';
    process.env.CSV_FILE_PATH = '/tmp/a/b.csv';
    const c = loadConfig();
    expect(c).toEqual({
      port: 6123,
      host: '127.0.0.1',
      corsOrigin: 'http://x.test',
      csvFilePath: '/tmp/a/b.csv',
      logLevel: 'debug',
    });
  });

  it('resolves relative CSV paths against cwd', () => {
    process.env.CSV_FILE_PATH = 'out/e.csv';
    expect(loadConfig().csvFilePath).toBe(path.resolve(process.cwd(), 'out/e.csv'));
  });

  it('falls back to EVENTS_CSV_PATH and prefers CSV_FILE_PATH', () => {
    process.env.EVENTS_CSV_PATH = '/tmp/legacy.csv';
    expect(loadConfig().csvFilePath).toBe('/tmp/legacy.csv');
    process.env.CSV_FILE_PATH = '/tmp/primary.csv';
    expect(loadConfig().csvFilePath).toBe('/tmp/primary.csv');
  });
});
