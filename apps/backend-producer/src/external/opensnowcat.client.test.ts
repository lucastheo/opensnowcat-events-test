import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockTrack, mockFlush, mockNewTracker, mockBuildStructEvent } = vi.hoisted(() => {
  const mockTrack = vi.fn();
  const mockFlush = vi.fn();
  const mockNewTracker = vi.fn((..._args: any[]) => ({
    track: mockTrack,
    flush: mockFlush
  }));
  const mockBuildStructEvent = vi.fn((params: any) => ({
    category: params.category,
    action: params.action,
    label: params.label,
    property: params.property,
    value: params.value
  }));
  return { mockTrack, mockFlush, mockNewTracker, mockBuildStructEvent };
});

vi.mock('@snowplow/node-tracker', () => ({
  buildStructEvent: (args: any) => mockBuildStructEvent(args),
  newTracker: (...args: any[]) => (mockNewTracker as any)(...args)
}));

import {
  OpenSnowcatClient,
  openSnowcatClient,
  type StructuredEventParams
} from './opensnowcat.client';

describe('OpenSnowcatClient', () => {
  const originalEnv = process.env.OPENSNOWCAT_COLLECTOR_URL;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFlush.mockResolvedValue(undefined);
    mockTrack.mockReturnValue({
      eid: 'default-mock-uuid',
      dtm: '1728648000000'
    });
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

    it('initializes newTracker with parsed host, port, protocol and timeout', () => {
      mockNewTracker.mockClear();
      new OpenSnowcatClient('https://custom-collector.example.com:9000', 3000);
      expect(mockNewTracker).toHaveBeenCalledWith(
        { namespace: 'backend', appId: 'backend-producer' },
        {
          endpoint: 'custom-collector.example.com',
          port: 9000,
          protocol: 'https',
          bufferSize: 1,
          connectionTimeout: 3000
        }
      );
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

    it('calls tracker.track(buildStructEvent(...)) and tracker.flush()', async () => {
      mockTrack.mockReturnValueOnce({
        eid: 'test-event-uuid-1',
        dtm: '1728648000000'
      });

      const result = await client.emitStructuredEvent(mockParams);

      expect(mockBuildStructEvent).toHaveBeenCalledWith({
        category: mockParams.category,
        action: mockParams.action,
        label: mockParams.label,
        property: mockParams.property,
        value: mockParams.value
      });
      expect(mockTrack).toHaveBeenCalledTimes(1);
      expect(mockFlush).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        eventId: 'test-event-uuid-1',
        timestamp: new Date(1728648000000).toISOString()
      });
    });

    it('returns eventId and ISO timestamp from tracked payload', async () => {
      const dtmTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z
      mockTrack.mockReturnValueOnce({
        eid: 'specific-uuid-999',
        dtm: String(dtmTimestamp)
      });

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toEqual({
        eventId: 'specific-uuid-999',
        timestamp: new Date(dtmTimestamp).toISOString()
      });
    });

    it('falls back to current time when payload dtm is missing or not a number', async () => {
      mockTrack.mockReturnValueOnce({
        eid: 'fallback-time-uuid'
      });

      const before = Date.now();
      const result = await client.emitStructuredEvent(mockParams);
      const after = Date.now();

      expect(result?.eventId).toBe('fallback-time-uuid');
      expect(result?.timestamp).toBeDefined();
      const parsedTime = Date.parse(result!.timestamp);
      expect(parsedTime).toBeGreaterThanOrEqual(before);
      expect(parsedTime).toBeLessThanOrEqual(after);
    });

    it('handles tracker.track errors gracefully, logs error, and returns null without throwing', async () => {
      const trackerError = new Error('Tracker serialization error');
      mockTrack.mockImplementationOnce(() => {
        throw trackerError;
      });

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OpenSnowcatClient] Error emitting structured event to OpenSnowcat:',
        trackerError
      );
    });

    it('handles missing payload or missing eid gracefully and returns null', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockTrack.mockReturnValueOnce({});

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[OpenSnowcatClient] Tracker did not return payload with eid'
      );
    });

    it('handles tracker.flush rejection gracefully, logs error, and still returns tracked eventId and timestamp', async () => {
      const flushError = new Error('Network timeout during flush');
      mockFlush.mockRejectedValueOnce(flushError);
      mockTrack.mockReturnValueOnce({
        eid: 'flush-failed-uuid',
        dtm: '1728648000000'
      });

      const result = await client.emitStructuredEvent(mockParams);

      expect(result).toEqual({
        eventId: 'flush-failed-uuid',
        timestamp: new Date(1728648000000).toISOString()
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OpenSnowcatClient] Failed to flush tracker emitter:',
        flushError
      );
    });

    it('trackEvent alias delegates to emitStructuredEvent', async () => {
      const emitSpy = vi.spyOn(client, 'emitStructuredEvent').mockResolvedValueOnce({
        eventId: 'evt-alias-123',
        timestamp: '2026-10-11T12:00:00.000Z'
      });

      const result = await client.trackEvent(mockParams);

      expect(result).toEqual({
        eventId: 'evt-alias-123',
        timestamp: '2026-10-11T12:00:00.000Z'
      });
      expect(emitSpy).toHaveBeenCalledWith(mockParams);
    });
  });
});
