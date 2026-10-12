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

describe('Event Mode Toggle - End-to-End Integration', () => {
  let collectorCalls: CollectorCall[];

  beforeEach(() => {
    vi.clearAllMocks();
    eventEmitter.resetSessionEventCount();
    eventEmitter.setEventMode('both');
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

      // Backend API Mock for /api/daily-excuse
      if (urlStr.includes('/api/daily-excuse')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 101,
            excuse: 'Our CI runner ran out of disk space.'
          })
        } as Response;
      }

      // Backend API Mock for /api/calc
      if (urlStr.includes('/api/calc')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: 42 })
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response;
    });
  });

  it('dispatches both structured and self-describing events when mode is "both" (default)', async () => {
    renderApp('/excuse');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const modeSelect = screen.getByTestId('event-mode-select');
    expect(modeSelect).toHaveValue('both');

    const generateBtn = screen.getByTestId('btn-generate-excuse');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const serviceCalls = collectorCalls.filter((c) => c.event_type !== 'page_view');
      expect(serviceCalls).toHaveLength(2);
    });

    const types = collectorCalls
      .filter((c) => c.event_type !== 'page_view')
      .map((c) => c.event_type);
    expect(types).toContain('struct_event');
    expect(types).toContain('self_describing');

    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledTimes(1);
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledTimes(1);
  });

  it('dispatches ONLY structured events when mode is changed to "no_schema_only"', async () => {
    renderApp('/excuse');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const modeSelect = screen.getByTestId('event-mode-select');
    fireEvent.change(modeSelect, { target: { value: 'no_schema_only' } });
    expect(modeSelect).toHaveValue('no_schema_only');
    expect(eventEmitter.getEventMode()).toBe('no_schema_only');

    collectorCalls = []; // reset to isolate button click events
    vi.mocked(snowplowSdk.trackStructEvent).mockClear();
    vi.mocked(snowplowSdk.trackSelfDescribingEvent).mockClear();

    const generateBtn = screen.getByTestId('btn-generate-excuse');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(collectorCalls).toHaveLength(1);
    });

    expect(collectorCalls[0].event_type).toBe('struct_event');
    expect(collectorCalls.some((c) => c.event_type === 'self_describing')).toBe(false);

    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledTimes(1);
    expect(snowplowSdk.trackSelfDescribingEvent).not.toHaveBeenCalled();
  });

  it('dispatches ONLY self-describing events when mode is changed to "self_describing_only"', async () => {
    renderApp('/excuse');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const modeSelect = screen.getByTestId('event-mode-select');
    fireEvent.change(modeSelect, { target: { value: 'self_describing_only' } });
    expect(modeSelect).toHaveValue('self_describing_only');
    expect(eventEmitter.getEventMode()).toBe('self_describing_only');

    collectorCalls = []; // reset to isolate button click events
    vi.mocked(snowplowSdk.trackStructEvent).mockClear();
    vi.mocked(snowplowSdk.trackSelfDescribingEvent).mockClear();

    const generateBtn = screen.getByTestId('btn-generate-excuse');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(collectorCalls).toHaveLength(1);
    });

    expect(collectorCalls[0].event_type).toBe('self_describing');
    expect(collectorCalls.some((c) => c.event_type === 'struct_event')).toBe(false);

    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledTimes(1);
    expect(snowplowSdk.trackStructEvent).not.toHaveBeenCalled();
  });

  it('restores dual emission when toggled back to "both"', async () => {
    renderApp('/calc');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const modeSelect = screen.getByTestId('event-mode-select');

    // Toggle to no_schema_only then back to both
    fireEvent.change(modeSelect, { target: { value: 'no_schema_only' } });
    expect(eventEmitter.getEventMode()).toBe('no_schema_only');

    fireEvent.change(modeSelect, { target: { value: 'both' } });
    expect(eventEmitter.getEventMode()).toBe('both');

    collectorCalls = [];
    vi.mocked(snowplowSdk.trackStructEvent).mockClear();
    vi.mocked(snowplowSdk.trackSelfDescribingEvent).mockClear();

    const submitBtn = screen.getByTestId('btn-calc-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(collectorCalls).toHaveLength(2);
    });

    const eventTypes = collectorCalls.map((c) => c.event_type);
    expect(eventTypes).toContain('struct_event');
    expect(eventTypes).toContain('self_describing');

    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledTimes(1);
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledTimes(1);
  });
});
