import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculate,
  fetchTimestamp,
  getDailyExcuse,
  rollDice,
  BackendApiError
} from '@/services/backend-api';
import { VITE_BACKEND_URL } from '@/config/env';

describe('Backend Producer API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculate()', () => {
    it('delegates addition to POST /api/calc', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 42 })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await calculate(20, 22, '+');

      expect(fetchMock).toHaveBeenCalledWith(
        `${VITE_BACKEND_URL}/api/calc`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ a: 20, b: 22, operator: '+' })
        })
      );
      expect(res).toEqual({ result: 42 });
    });

    it('throws BackendApiError when server responds with 400', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Division by zero' })
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(calculate(10, 0, '/')).rejects.toThrow(BackendApiError);
      await expect(calculate(10, 0, '/')).rejects.toThrow('Division by zero');
    });
  });

  describe('fetchTimestamp()', () => {
    it('delegates to POST /api/timestamp with explicit timezone', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          timestamp_iso: '2026-10-12T12:00:00.000Z',
          formatted_local: '12/10/2026, 09:00:00',
          timezone: 'America/Sao_Paulo'
        })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await fetchTimestamp('America/Sao_Paulo');

      expect(fetchMock).toHaveBeenCalledWith(
        `${VITE_BACKEND_URL}/api/timestamp`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ timezone: 'America/Sao_Paulo' })
        })
      );
      expect(res.timezone).toBe('America/Sao_Paulo');
    });

    it('uses browser timezone if none provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          timestamp_iso: '2026-10-12T12:00:00.000Z',
          formatted_local: '12/10/2026, 12:00:00',
          timezone: 'UTC'
        })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await fetchTimestamp();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(res.timestamp_iso).toBeDefined();
    });
  });

  describe('getDailyExcuse()', () => {
    it('delegates to GET /api/daily-excuse', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 7,
          excuse: 'Git conflict in .lock file'
        })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await getDailyExcuse();

      expect(fetchMock).toHaveBeenCalledWith(
        `${VITE_BACKEND_URL}/api/daily-excuse`,
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(res).toEqual({
        id: 7,
        excuse: 'Git conflict in .lock file'
      });
    });
  });

  describe('rollDice()', () => {
    it('delegates to POST /api/dice with normalized sides', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          rolls: [4, 6],
          total: 10
        })
      });
      vi.stubGlobal('fetch', fetchMock);

      // Testing number sides conversion 6 -> 'd6'
      const res = await rollDice(2, 6);

      expect(fetchMock).toHaveBeenCalledWith(
        `${VITE_BACKEND_URL}/api/dice`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ count: 2, sides: 'd6' })
        })
      );
      expect(res).toEqual({ rolls: [4, 6], total: 10 });
    });

    it('passes string sides like d20 directly', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          rolls: [18],
          total: 18
        })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await rollDice(1, 'd20');

      expect(fetchMock).toHaveBeenCalledWith(
        `${VITE_BACKEND_URL}/api/dice`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ count: 1, sides: 'd20' })
        })
      );
      expect(res.total).toBe(18);
    });
  });

  describe('Network and Parse Error Handling', () => {
    it('throws BackendApiError with status 0 on network error', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      vi.stubGlobal('fetch', fetchMock);

      await expect(calculate(1, 1, '+')).rejects.toThrow(BackendApiError);
      await expect(calculate(1, 1, '+')).rejects.toThrow('Network error: Failed to fetch');
    });

    it('throws BackendApiError when server responds with non-JSON text', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('invalid json');
        }
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(getDailyExcuse()).rejects.toThrow('Failed to parse backend response as JSON');
    });
  });
});
