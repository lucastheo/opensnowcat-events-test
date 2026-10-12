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

describe('Calculator Service - End-to-End Integration', () => {
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

      // Backend Producer API Mock
      if (urlStr.includes('/api/calc')) {
        const payload = init?.body ? JSON.parse(init.body as string) : null;
        backendCalls.push({
          url: urlStr,
          method: init?.method || 'GET',
          body: payload
        });

        const { a, b, operator } = payload;
        let result = 0;
        if (operator === '+') result = a + b;
        else if (operator === '-') result = a - b;
        else if (operator === '*') result = a * b;
        else if (operator === '/') result = a / b;

        return {
          ok: true,
          status: 200,
          json: async () => ({ result })
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response;
    });
  });

  it('completes calculation user journey: form fill -> API POST -> DOM update -> dual emission to Simple Collector', async () => {
    renderApp('/calc');

    // Page view emission on initial render
    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });
    expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');

    // Fill the calculator form: 24 / 6
    const inputA = screen.getByTestId('calc-input-a');
    const selectOp = screen.getByTestId('calc-select-op');
    const inputB = screen.getByTestId('calc-input-b');
    const submitBtn = screen.getByTestId('btn-calc-submit');

    fireEvent.change(inputA, { target: { value: '24' } });
    fireEvent.change(selectOp, { target: { value: '/' } });
    fireEvent.change(inputB, { target: { value: '6' } });

    // Submit calculation
    fireEvent.click(submitBtn);

    // 1. Assert Backend API was called with exact payload
    await waitFor(() => {
      expect(backendCalls).toHaveLength(1);
    });
    expect(backendCalls[0].url).toContain('/api/calc');
    expect(backendCalls[0].method).toBe('POST');
    expect(backendCalls[0].body).toEqual({ a: 24, b: 6, operator: '/' });

    // 2. Assert DOM was updated with result
    await waitFor(() => {
      expect(screen.getByTestId('calc-result')).toHaveTextContent('4');
    });

    // 3. Assert dual emission to Simple Collector
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

    // Verify OpenSnowcat SDK was also called (Dual emission parity)
    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'service',
        action: 'calculate',
        label: 'division',
        property: '24/6',
        value: 4
      })
    );
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          schema: 'iglu:com.opensnowcat.test/calc_event/jsonschema/1-0-0',
          data: {
            a: 24,
            b: 6,
            operator: '/',
            result: 4
          }
        }
      })
    );

    // 4. Assert session events counter increased: 1 page_view + 2 service events = 3
    expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('3');
  });

  it('handles multiplication operation and updates result properly', async () => {
    renderApp('/calc');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    fireEvent.change(screen.getByTestId('calc-input-a'), { target: { value: '7' } });
    fireEvent.change(screen.getByTestId('calc-select-op'), { target: { value: '*' } });
    fireEvent.change(screen.getByTestId('calc-input-b'), { target: { value: '6' } });

    fireEvent.click(screen.getByTestId('btn-calc-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('calc-result')).toHaveTextContent('42');
    });

    expect(backendCalls[0].body).toEqual({ a: 7, b: 6, operator: '*' });
  });
});
