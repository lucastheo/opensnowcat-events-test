import { describe, it, expect, vi } from 'vitest';
import { ApiController } from '../../src/controllers/api.controller.js';

describe('ApiController', () => {
  it('should initialize with backendUrl and default timeout', () => {
    const controller = new ApiController({ backendUrl: 'http://localhost:4000/' });
    expect(controller).toBeDefined();
  });

  it('should execute calc request with defaults and return success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: 15 }),
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeCalc();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/calc',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        body: JSON.stringify({ a: 10, b: 5, operator: '+' }),
      })
    );
    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ result: 15 });
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should execute calc with custom arguments', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: 42 }),
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeCalc(6, 7, '*');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/calc',
      expect.objectContaining({
        body: JSON.stringify({ a: 6, b: 7, operator: '*' }),
      })
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ result: 42 });
  });

  it('should execute timestamp request with defaults', async () => {
    const mockPayload = {
      timestamp_iso: '2026-10-12T20:00:00.000Z',
      formatted_local: '10/12/2026, 8:00:00 PM',
      timezone: 'UTC',
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockPayload),
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeTimestamp('America/New_York');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/timestamp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ timezone: 'America/New_York' }),
      })
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockPayload);
  });

  it('should execute excuse request via GET', async () => {
    const mockPayload = { id: 1, excuse: 'Cache invalidation gone wrong.' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockPayload),
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeExcuse();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/daily-excuse',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockPayload);
  });

  it('should execute dice request with defaults', async () => {
    const mockPayload = { rolls: [4, 6], total: 10 };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockPayload),
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeDice(3, 'd20');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/dice',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ count: 3, sides: 'd20' }),
      })
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockPayload);
  });

  it('should handle HTTP error status gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'Division by zero is not allowed' }),
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeCalc(10, 0, '/');

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toBe('Division by zero is not allowed');
  });

  it('should handle network failure gracefully without throwing', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await controller.executeCalc();

    expect(res.success).toBe(false);
    expect(res.error).toBe('Connection refused');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should execute all endpoints via executeAll and collect results and errors', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/calc')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ result: 15 }) };
      }
      if (url.includes('/api/timestamp')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ timestamp_iso: '2026-10-12T00:00:00Z', formatted_local: '', timezone: 'UTC' }),
        };
      }
      if (url.includes('/api/daily-excuse')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 5, excuse: 'DNS issues' }) };
      }
      if (url.includes('/api/dice')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => JSON.stringify({ error: 'RNG hardware failed' }),
        };
      }
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
    });

    const controller = new ApiController({
      backendUrl: 'http://localhost:4000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const allRes = await controller.executeAll();

    expect(allRes.success).toBe(false);
    expect(allRes.errors).toContain('Dice error: RNG hardware failed');
    expect(allRes.results.calc.success).toBe(true);
    expect(allRes.results.timestamp.success).toBe(true);
    expect(allRes.results.excuse.success).toBe(true);
    expect(allRes.results.dice.success).toBe(false);
  });
});
