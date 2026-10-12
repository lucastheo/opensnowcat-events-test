import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as snowplowSdk from '@snowplow/browser-tracker';
import { renderApp } from './test-router';
import { eventEmitter } from '@/tracker/event-emitter';
import { ANYTHING_A_SCHEMA } from '@/tracker/snowcat';

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

describe('Dice Emulator Service - End-to-End Integration', () => {
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

      // Backend Producer API Mock (POST /api/dice)
      if (urlStr.includes('/api/dice')) {
        const payload = init?.body ? JSON.parse(init.body as string) : null;
        backendCalls.push({
          url: urlStr,
          method: init?.method || 'POST',
          body: payload
        });

        return {
          ok: true,
          status: 200,
          json: async () => ({
            rolls: [5, 12, 18, 20],
            total: 55
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

  it('completes dice roll user journey with custom count and sides selection: form -> API POST -> DOM update -> dual emission', async () => {
    renderApp('/dice');

    // Page view emission on mount
    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const countInput = screen.getByTestId('dice-input-count');
    const sidesSelect = screen.getByTestId('dice-select-sides');
    const rollBtn = screen.getByTestId('btn-roll-dice');

    // Set custom count: 4, custom sides: d20
    fireEvent.change(countInput, { target: { value: '4' } });
    fireEvent.change(sidesSelect, { target: { value: 'd20' } });
    fireEvent.click(rollBtn);

    // 1. Assert Backend API was called with count and sides
    await waitFor(() => {
      expect(backendCalls).toHaveLength(1);
    });
    expect(backendCalls[0].url).toContain('/api/dice');
    expect(backendCalls[0].method).toBe('POST');
    expect(backendCalls[0].body).toEqual({ count: 4, sides: 'd20' });

    // 2. Assert DOM was updated with rolls and total sum
    await waitFor(() => {
      expect(screen.getByTestId('dice-result')).toHaveTextContent(
        'Total: 55 (Rolls: [5, 12, 18, 20])'
      );
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

    // Verify OpenSnowcat SDK was also called
    expect(snowplowSdk.trackStructEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'service',
        action: 'roll_dice',
        label: 'd20',
        property: '5,12,18,20',
        value: 55
      })
    );
    expect(snowplowSdk.trackSelfDescribingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          schema: ANYTHING_A_SCHEMA,
          data: {
            count: 4,
            sides: 20,
            rolls: [5, 12, 18, 20],
            total: 55
          }
        }
      })
    );

    // Assert session counter is incremented
    expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('3');
  });

  it('rolls default dice (2 dice, d6) without changing form inputs', async () => {
    renderApp('/dice');

    await waitFor(() => {
      expect(collectorCalls.some((c) => c.event_type === 'page_view')).toBe(true);
    });

    const rollBtn = screen.getByTestId('btn-roll-dice');
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(backendCalls).toHaveLength(1);
    });
    expect(backendCalls[0].body).toEqual({ count: 2, sides: 'd6' });

    await waitFor(() => {
      expect(screen.getByTestId('dice-result')).not.toBeEmptyDOMElement();
    });
  });
});
