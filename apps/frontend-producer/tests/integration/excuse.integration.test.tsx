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
}

describe('Excuse Service - End-to-End Integration', () => {
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

      // Backend Producer API Mock (GET /api/daily-excuse)
      if (urlStr.includes('/api/daily-excuse')) {
        backendCalls.push({
          url: urlStr,
          method: init?.method || 'GET'
        });

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 42,
            excuse: "My Docker container is eating 100% of my CPU and my mic won't unmute."
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

  it('completes daily excuse user journey: click generate -> API GET -> DOM update -> dual emission', async () => {
    renderApp('/excuse');

    // Initial page view emission
    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const generateBtn = screen.getByTestId('btn-generate-excuse');
    fireEvent.click(generateBtn);

    // 1. Assert Backend API GET was invoked
    await waitFor(() => {
      expect(backendCalls).toHaveLength(1);
    });
    expect(backendCalls[0].url).toContain('/api/daily-excuse');
    expect(backendCalls[0].method).toBe('GET');

    // 2. Assert DOM was updated with excuse text and ID
    await waitFor(() => {
      expect(screen.getByTestId('excuse-result')).toHaveTextContent(
        "My Docker container is eating 100% of my CPU and my mic won't unmute."
      );
    });
    expect(screen.getByText(/Generated Excuse \(#42\)/i)).toBeInTheDocument();

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
        action: 'get_excuse',
        label: 'daily_excuse',
        property: '42',
        value: 42
      })
    );
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          schema: 'iglu:com.opensnowcat.test/excuse_event/jsonschema/1-0-0',
          data: {
            excuse_id: 42,
            excuse_text: "My Docker container is eating 100% of my CPU and my mic won't unmute."
          }
        }
      })
    );

    // Event counter reflected
    expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('3');
  });
});
