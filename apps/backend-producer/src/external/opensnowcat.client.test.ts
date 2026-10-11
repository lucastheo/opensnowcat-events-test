import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenSnowcatClient,
  openSnowcatClient,
  type StructuredEventParams
} from './opensnowcat.client';

describe('OpenSnowcatClient', () => {
  const originalEnv = process.env.OPENSNOWCAT_COLLECTOR_URL;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.OPENSNOWCAT_COLLECTOR_URL = originalEnv;
  });

  describe('Constructor & Endpoint Resolution', () => {
    it('uses default collector URL when no argument or env var is provided', () => {
      delete process.env.OPENSNOWCAT_COLLECTOR_URL;
      const client = new OpenSnowcatClient();
      expect(client.endpoint).toBe('http://localhost:8080/com.snowplowanalytics.snowplow/tp2');
    });

    it('uses OPENSNOWCAT_COLLECTOR_URL env var when no argument is passed', () => {
      process.env.OPENSNOWCAT_COLLECTOR_URL = 'http://collector.snowcat.local:8080';
      const client = new OpenSnowcatClient();
      expect(client.endpoint).toBe('http://collector.snowcat.local:8080/com.snowplowanalytics.snowplow/tp2');
    });

    it('uses custom constructor URL overriding env var', () => {
      process.env.OPENSNOWCAT_COLLECTOR_URL = 'http://env-collector:8080';
      const client = new OpenSnowcatClient('https://custom-collector.example.com');
      expect(client.endpoint).toBe('https://custom-collector.example.com/com.snowplowanalytics.snowplow/tp2');
    });

    it('trims trailing slashes from constructor and env collector URLs', () => {
      const client = new OpenSnowcatClient('http://collector.example.com///');
      expect(client.endpoint).toBe('http://collector.example.com/com.snowplowanalytics.snowplow/tp2');
    });

    it('provides a default singleton export', () => {
      expect(openSnowcatClient).toBeInstanceOf(OpenSnowcatClient);
    });
  });

  describe('buildPayload', () => {
    const client = new OpenSnowcatClient('http://localhost:8080');

    it('constructs payload envelope according to Snowplow jsonschema 1-0-4', () => {
      const timestamp = '2026-10-11T12:00:00.000Z';
      const params: StructuredEventParams = {
        category: 'backend_service',
        action: 'calculate',
        label: 'addition',
        property: 'standard',
        value: 42,
        eventId: 'test-event-uuid-1234',
        timestamp
      };

      const payload = client.buildPayload(params);

      expect(payload.schema).toBe(
        'iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4'
      );
      expect(payload.data).toHaveLength(1);

      const eventData = payload.data[0];
      expect(eventData).toEqual({
        e: 'se',
        se_ca: 'backend_service',
        se_ac: 'calculate',
        se_la: 'addition',
        se_pr: 'standard',
        se_va: '42',
        eid: 'test-event-uuid-1234',
        dtm: String(Date.parse(timestamp)),
        tv: 'backend-producer-1.0.0',
        p: 'srv'
      });
    });

    it('handles optional fields when omitted (label, property, value)', () => {
      const params: StructuredEventParams = {
        category: 'backend_service',
        action: 'ping',
        eventId: 'test-event-uuid-5678',
        timestamp: '2026-10-11T14:30:00.000Z'
      };

      const payload = client.buildPayload(params);
      const eventData = payload.data[0];

      expect(eventData.se_la).toBeUndefined();
      expect(eventData.se_pr).toBeUndefined();
      expect(eventData.se_va).toBeUndefined();
      expect(eventData.se_ca).toBe('backend_service');
      expect(eventData.se_ac).toBe('ping');
    });

    it('falls back to Date.now() when timestamp is not a parseable date', () => {
      const nowBefore = Date.now();
      const params: StructuredEventParams = {
        category: 'backend_service',
        action: 'ping',
        eventId: 'test-event-uuid-9999',
        timestamp: 'not-a-valid-date'
      };

      const payload = client.buildPayload(params);
      const nowAfter = Date.now();

      const parsedDtm = Number(payload.data[0].dtm);
      expect(parsedDtm).toBeGreaterThanOrEqual(nowBefore);
      expect(parsedDtm).toBeLessThanOrEqual(nowAfter);
    });
  });

  describe('emitStructuredEvent & trackEvent', () => {
    const client = new OpenSnowcatClient('http://collector.local:8080');
    const mockParams: StructuredEventParams = {
      category: 'test_category',
      action: 'test_action',
      label: 'test_label',
      property: 'test_prop',
      value: 10,
      eventId: 'evt-100',
      timestamp: '2026-10-11T12:00:00.000Z'
    };

    it('sends correct HTTP POST request and returns true on HTTP 200', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://collector.local:8080/com.snowplowanalytics.snowplow/tp2');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json'
      });
      expect(options.signal).toBeInstanceOf(AbortSignal);

      const body = JSON.parse(options.body);
      expect(body.schema).toBe('iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4');
      expect(body.data[0].se_ca).toBe('test_category');
      expect(body.data[0].eid).toBe('evt-100');
    });

    it('handles HTTP non-200 responses gracefully, logs error, and returns false', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OpenSnowcatClient] Failed to emit event. Status: 500 Internal Server Error')
      );
    });

    it('handles network errors / rejected fetch gracefully and returns false without throwing', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      const mockFetch = vi.fn().mockRejectedValue(networkError);
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OpenSnowcatClient] Error emitting structured event to OpenSnowcat:',
        networkError
      );
    });

    it('handles timeout abort gracefully and returns false', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal('fetch', mockFetch);

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OpenSnowcatClient] Error emitting structured event to OpenSnowcat:',
        abortError
      );
    });

    it('trackEvent alias delegates to emitStructuredEvent', async () => {
      const emitSpy = vi.spyOn(client, 'emitStructuredEvent').mockResolvedValue(true);

      const result = await client.trackEvent(mockParams);

      expect(result).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith(mockParams);
    });
  });
});
