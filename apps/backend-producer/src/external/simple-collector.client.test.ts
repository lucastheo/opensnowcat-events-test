import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SimpleCollectorClient,
  simpleCollectorClient,
  type SimpleCollectorRecord
} from './simple-collector.client';

describe('SimpleCollectorClient', () => {
  const originalEnv = process.env.SIMPLE_COLLECTOR_URL;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.SIMPLE_COLLECTOR_URL = originalEnv;
  });

  describe('Constructor & Endpoint Resolution', () => {
    it('uses default collector URL when no argument or env var is provided', () => {
      delete process.env.SIMPLE_COLLECTOR_URL;
      const client = new SimpleCollectorClient();
      expect(client.endpoint).toBe('http://localhost:5000/collect');
    });

    it('uses SIMPLE_COLLECTOR_URL env var when no argument is passed', () => {
      process.env.SIMPLE_COLLECTOR_URL = 'http://collector.audit.local:5000';
      const client = new SimpleCollectorClient();
      expect(client.endpoint).toBe('http://collector.audit.local:5000/collect');
    });

    it('uses custom constructor URL overriding env var', () => {
      process.env.SIMPLE_COLLECTOR_URL = 'http://env-collector:5000';
      const client = new SimpleCollectorClient('https://custom-simple-collector.example.com');
      expect(client.endpoint).toBe('https://custom-simple-collector.example.com/collect');
    });

    it('trims trailing slashes from collector URL', () => {
      const client = new SimpleCollectorClient('http://collector.audit.local:5000///');
      expect(client.endpoint).toBe('http://collector.audit.local:5000/collect');
    });

    it('provides a default singleton export', () => {
      expect(simpleCollectorClient).toBeInstanceOf(SimpleCollectorClient);
    });
  });

  describe('record', () => {
    const client = new SimpleCollectorClient('http://simple-collector.local:5000');
    const mockRecord: SimpleCollectorRecord = {
      event_id: 'test-uuid-abc-123',
      timestamp: '2026-10-11T12:00:00.000Z',
      source: 'backend',
      event_type: 'backend_api'
    };

    it('formats request with POST, Content-Type header, JSON body and returns true on HTTP 200', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.record(mockRecord);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://simple-collector.local:5000/collect');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json'
      });
      expect(options.signal).toBeInstanceOf(AbortSignal);

      const body = JSON.parse(options.body);
      expect(body).toEqual(mockRecord);
    });

    it('returns true on HTTP 201 Created', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created'
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.record(mockRecord);

      expect(result).toBe(true);
    });

    it('handles HTTP failure (non-2xx) gracefully, logs to console.error, and returns false without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.record(mockRecord);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SimpleCollectorClient] Failed to record event. Status: 503 Service Unavailable'
      );
    });

    it('handles network failure (fetch reject) gracefully, logs error, and returns false without throwing', async () => {
      const networkError = new Error('ECONNREFUSED: Simple collector offline');
      const mockFetch = vi.fn().mockRejectedValue(networkError);
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.record(mockRecord);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SimpleCollectorClient] Error recording event to Simple Collector:',
        networkError
      );
    });

    it('handles abort timeout gracefully and returns false', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.record(mockRecord);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SimpleCollectorClient] Error recording event to Simple Collector:',
        abortError
      );
    });
  });
});
