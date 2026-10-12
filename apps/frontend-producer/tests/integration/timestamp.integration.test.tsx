import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as snowplowSdk from '@snowplow/browser-tracker';
import { renderApp } from './test-router';
import { eventEmitter } from '@/tracker/event-emitter';

vi.mock('@snowplow/browser-tracker', () => ({
  newTracker: vi.fn(),
  trackPageView: vi.fn(),
  trackStructEvent: vi.fn(),
  trackSelfDescribingEvent: vi.fn()
}));

interface CollectorCall {
  event_id: string;
  timestamp: string;
  source: string;
  event_type: string;
}

interface BackendCall {
  url: string;
  method: string;
  body: unknown;
}

describe('Timestamp Service - End-to-End Integration', () => {
  let backendCalls: BackendCall[];
  let collectorCalls: CollectorCall[];

  beforeEach(() => {
    vi.clearAllMocks();
    eventEmitter.resetSessionEventCount();
    eventEmitter.setEventMode('both');
    backendCalls = [];
    collectorCalls = [];

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      // Simple Collector Mock
      if (urlStr.includes('/collect')) {
        const payload = JSON.parse(init?.body as string) as CollectorCall;
        collectorCalls.push(payload);
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: payload.event_id })
        } as Response;
      }

      // Backend Producer API Mock (/api/timestamp)
      if (urlStr.includes('/api/timestamp')) {
        const payload = init?.body ? JSON.parse(init.body as string) : null;
        backendCalls.push({
          url: urlStr,
          method: init?.method || 'POST',
          body: payload
        });

        const tz = payload?.timezone || 'UTC';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            timestamp_iso: '2026-10-12T15:00:00.000Z',
            formatted_local: `12/10/2026, 16:00:00 (${tz})`,
            timezone: tz
          })
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response;
    });
  });

  it('completes timestamp user journey with custom timezone override: input -> API POST -> DOM update -> dual emission', async () => {
    renderApp('/timestamp');

    // Page view emission on initial render
    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const tzInput = screen.getByTestId('timestamp-input-tz');
    const fetchBtn = screen.getByTestId('btn-timestamp-fetch');

    // Custom timezone override
    fireEvent.change(tzInput, { target: { value: 'Europe/London' } });
    fireEvent.click(fetchBtn);

    // 1. Assert Backend API was called with overridden timezone
    await waitFor(() => {
      expect(backendCalls).toHaveLength(1);
    });
    expect(backendCalls[0].url).toContain('/api/timestamp');
    expect(backendCalls[0].method).toBe('POST');
    expect(backendCalls[0].body).toEqual({ timezone: 'Europe/London' });

    // 2. Assert DOM was updated with returned formatted timestamp
    await waitFor(() => {
      expect(screen.getByTestId('timestamp-result')).toHaveTextContent(
        '12/10/2026, 16:00:00 (Europe/London)'
      );
    });

    // 3. Assert dual emission audit ping to Simple Collector
    await waitFor(() => {
      const serviceAuditPings = collectorCalls.filter((c) => c.event_type !== 'page_view');
      expect(serviceAuditPings).toHaveLength(2);
    });

    const structPing = collectorCalls.find((c) => c.event_type === 'struct_event')!;
    const sdPing = collectorCalls.find((c) => c.event_type === 'self_describing')!;

    expect(structPing).toBeDefined();
    expect(structPing.source).toBe('frontend');
    expect(structPing.event_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Date.parse(structPing.timestamp)).not.toBeNaN();

    expect(sdPing).toBeDefined();
    expect(sdPing.source).toBe('frontend');
    expect(sdPing.event_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Date.parse(sdPing.timestamp)).not.toBeNaN();

    // Verify OpenSnowcat SDK was also called
    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'service',
        action: 'fetch_timestamp',
        label: 'Europe/London',
        property: 'Europe/London'
      })
    );
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          schema: 'iglu:com.opensnowcat.test/timestamp_event/jsonschema/1-0-0',
          data: {
            timezone: 'Europe/London',
            timestamp_iso: '2026-10-12T15:00:00.000Z'
          }
        }
      })
    );

    // Session event counter reflects page_view + struct_event + self_describing = 3
    expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('3');
  });

  it('fetches timestamp using default browser timezone when not overridden', async () => {
    renderApp('/timestamp');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const fetchBtn = screen.getByTestId('btn-timestamp-fetch');
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(backendCalls).toHaveLength(1);
    });
    expect(backendCalls[0].url).toContain('/api/timestamp');
    expect(backendCalls[0].body).toHaveProperty('timezone');

    await waitFor(() => {
      expect(screen.getByTestId('timestamp-result')).not.toBeEmptyDOMElement();
    });
  });
});
