import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as snowplowSdk from '@snowplow/browser-tracker';
import {
  initSnowcatTracker,
  trackSnowcatPageView,
  trackSnowcatStructEvent,
  trackSnowcatSelfDescribingEvent,
  resetSnowcatTracker,
  ANYTHING_A_SCHEMA
} from '@/tracker/snowcat';

vi.mock('@snowplow/browser-tracker', () => ({
  newTracker: vi.fn().mockReturnValue({ id: 'tracker-instance' }),
  trackPageView: vi.fn(),
  trackStructEvent: vi.fn(),
  trackSelfDescribingEvent: vi.fn()
}));

describe('OpenSnowcat Tracker SDK Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSnowcatTracker();
  });

  it('initializes the tracker with custom plugins and settings', () => {
    const tracker = initSnowcatTracker('http://localhost:8080');
    expect(tracker).toBeDefined();
    expect(snowplowSdk.newTracker).toHaveBeenCalledTimes(1);
    expect(snowplowSdk.newTracker).toHaveBeenCalledWith(
      'opensnowcat',
      'http://localhost:8080',
      expect.objectContaining({
        appId: 'frontend-producer',
        bufferSize: 1
      })
    );

    // Subsequent calls return existing singleton
    const secondCall = initSnowcatTracker('http://localhost:8080');
    expect(secondCall).toBe(tracker);
    expect(snowplowSdk.newTracker).toHaveBeenCalledTimes(1);
  });

  it('tracks page view and returns generated eventId and timestamp', () => {
    const result = trackSnowcatPageView({
      title: 'Test Page',
      eventId: 'manual-id-123'
    });

    expect(result.eventId).toBe('manual-id-123');
    expect(result.timestamp).toBeDefined();
    expect(snowplowSdk.trackPageView).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Page',
        timestamp: { type: 'ttm', value: expect.any(Number) }
      })
    );
  });

  it('tracks structured event with full attributes', () => {
    const result = trackSnowcatStructEvent({
      category: 'service',
      action: 'calculate',
      label: 'addition',
      property: '2+2',
      value: 4
    });

    expect(result.eventId).toBeDefined();
    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'service',
        action: 'calculate',
        label: 'addition',
        property: '2+2',
        value: 4,
        timestamp: { type: 'ttm', value: expect.any(Number) }
      })
    );
  });

  it('tracks self-describing event conforming to schema envelope', () => {
    const result = trackSnowcatSelfDescribingEvent({
      event: {
        schema: ANYTHING_A_SCHEMA,
        data: { a: 2, b: 2, operator: '+', result: 4 }
      }
    });

    expect(result.eventId).toBeDefined();
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          schema: ANYTHING_A_SCHEMA,
          data: { a: 2, b: 2, operator: '+', result: 4 }
        },
        timestamp: { type: 'ttm', value: expect.any(Number) }
      })
    );
  });
});
