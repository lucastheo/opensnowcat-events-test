import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsvWriterService, EventRecord } from '../../src/services/csv-writer.service.js';

const HEADER = 'event_id,timestamp,source,event_type\n';
const rec = (i: number, source: EventRecord['source'] = 'frontend', event_type = 'page_view'): EventRecord => ({
  event_id: 'id-' + i,
  timestamp: '2026-01-01T00:00:00.000Z',
  source,
  event_type,
});

describe('CsvWriterService', () => {
  let dir: string;
  let file: string;
  let svc: CsvWriterService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'csvw-'));
    file = path.join(dir, 'nested', 'events.csv');
    svc = new CsvWriterService(file);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates directory and writes header on initialize', async () => {
    await svc.initialize();
    expect(await fs.readFile(file, 'utf-8')).toBe(HEADER);
  });

  it('does not re-header an existing file', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, HEADER + 'old,t,frontend,x\n');
    await svc.initialize();
    await svc.initialize();
    expect(await fs.readFile(file, 'utf-8')).toBe(HEADER + 'old,t,frontend,x\n');
  });

  it('appends a row and lazily initializes', async () => {
    await svc.append(rec(1));
    expect(await fs.readFile(file, 'utf-8')).toBe(HEADER + 'id-1,2026-01-01T00:00:00.000Z,frontend,page_view\n');
  });

  it('keeps order for concurrent appends', async () => {
    await svc.initialize();
    await Promise.all(Array.from({ length: 50 }, (_, i) => svc.append(rec(i))));
    const lines = (await fs.readFile(file, 'utf-8')).trim().split('\n');
    expect(lines).toHaveLength(51);
    expect(lines[0]).toBe(HEADER.trim());
    lines.slice(1).forEach((l, i) => expect(l.startsWith('id-' + i + ',')).toBe(true));
  });

  it('escapes commas and quotes', async () => {
    await svc.append(rec(1, 'backend', 'a,b'));
    await svc.append(rec(2, 'backend', 'say "hi"'));
    const lines = (await fs.readFile(file, 'utf-8')).split('\n');
    expect(lines[1]).toBe('id-1,2026-01-01T00:00:00.000Z,backend,"a,b"');
    expect(lines[2]).toBe('id-2,2026-01-01T00:00:00.000Z,backend,"say ""hi"""');
  });

  it('encloses strings containing newlines in double quotes', async () => {
    await svc.append(rec(1, 'frontend', 'a\nb\r\nc'));
    const content = await fs.readFile(file, 'utf-8');
    expect(content).toContain('"a\nb\r\nc"');
  });

  it('tracks stats per source', async () => {
    await svc.append(rec(1, 'frontend'));
    await svc.append(rec(2, 'backend'));
    await svc.append(rec(3, 'backend'));
    expect(svc.getStats()).toEqual({
      total_recorded: 3,
      frontend_events: 1,
      backend_events: 2,
      csv_file_path: file,
    });
  });

  it('reset truncates to header and zeroes stats', async () => {
    await svc.append(rec(1));
    await svc.reset();
    expect(await fs.readFile(file, 'utf-8')).toBe(HEADER);
    expect(svc.getStats()).toMatchObject({ total_recorded: 0, frontend_events: 0, backend_events: 0 });
    await svc.append(rec(2));
    expect((await fs.readFile(file, 'utf-8')).split('\n')).toHaveLength(3);
  });

  it('reset works before initialize (creates dir)', async () => {
    await svc.reset();
    expect(await fs.readFile(file, 'utf-8')).toBe(HEADER);
  });

  it('stays healthy after a failed write', async () => {
    await svc.initialize();
    const spy = vi.spyOn(fs, 'appendFile').mockRejectedValueOnce(new Error('disk full'));
    await expect(svc.append(rec(1))).rejects.toThrow('disk full');
    expect(svc.getStats().total_recorded).toBe(0);
    spy.mockRestore();
    await svc.append(rec(2));
    expect(svc.getStats().total_recorded).toBe(1);
    expect(await fs.readFile(file, 'utf-8')).toBe(HEADER + 'id-2,2026-01-01T00:00:00.000Z,frontend,page_view\n');
  });

  it('rejects reset on failure and keeps queue healthy', async () => {
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('ro'));
    await expect(svc.reset()).rejects.toThrow('ro');
    await svc.append(rec(1));
    expect(svc.getStats().total_recorded).toBe(1);
  });
});
