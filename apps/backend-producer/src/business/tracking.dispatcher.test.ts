import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchDualEmission, type DualEmissionParams } from './tracking.dispatcher';
import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';

vi.mock('@/external/opensnowcat.client', () => ({
  openSnowcatClient: {
    emitStructuredEvent: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK' })
  }
}));

vi.mock('@/external/simple-collector.client', () => ({
  simpleCollectorClient: {
    record: vi.fn().mockResolvedValue({ status: 'ok', event_id: 'test' })
  }
}));

describe('Tracking Dispatcher (dispatchDualEmission)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches concurrent calls to openSnowcatClient and simpleCollectorClient', async () => {
    const params: DualEmissionParams = {
      category: 'backend_service',
      action: 'calculate',
      label: '+',
      property: '1+2',
      value: 3
    };

    const result = await dispatchDualEmission(params);

    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(1);

    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith({
      category: 'backend_service',
      action: 'calculate',
      label: '+',
      property: '1+2',
      value: 3,
      eventId: result.eventId,
      timestamp: result.timestamp
    });

    expect(simpleCollectorClient.record).toHaveBeenCalledWith({
      event_id: result.eventId,
      timestamp: result.timestamp,
      source: 'backend',
      event_type: 'backend_api'
    });
  });

  it('generates eventId (UUIDv4) and timestamp with exact parity between clients', async () => {
    const params: DualEmissionParams = {
      category: 'backend_service',
      action: 'test_action'
    };

    const result = await dispatchDualEmission(params);

    // Validate UUID format
    expect(result.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    // Validate ISO timestamp
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

    const oscCall = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.calls[0][0];
    const scCall = vi.mocked(simpleCollectorClient.record).mock.calls[0][0];

    expect(oscCall.eventId).toBe(result.eventId);
    expect(oscCall.timestamp).toBe(result.timestamp);
    expect(scCall.event_id).toBe(result.eventId);
    expect(scCall.timestamp).toBe(result.timestamp);
  });

  it('respects custom eventId, timestamp, and eventType overrides', async () => {
    const customEventId = 'custom-event-uuid-1234';
    const customTimestamp = '2026-10-11T12:34:56.789Z';
    const customEventType = 'backend_batch';

    const params: DualEmissionParams = {
      category: 'backend_service',
      action: 'batch_event',
      eventId: customEventId,
      timestamp: customTimestamp,
      eventType: customEventType
    };

    const result = await dispatchDualEmission(params);

    expect(result.eventId).toBe(customEventId);
    expect(result.timestamp).toBe(customTimestamp);

    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: customEventId,
        timestamp: customTimestamp
      })
    );

    expect(simpleCollectorClient.record).toHaveBeenCalledWith({
      event_id: customEventId,
      timestamp: customTimestamp,
      source: 'backend',
      event_type: customEventType
    });
  });

  it('propagates rejection if an external client fails', async () => {
    vi.mocked(openSnowcatClient.emitStructuredEvent).mockRejectedValueOnce(new Error('OSC Collector down'));

    await expect(
      dispatchDualEmission({
        category: 'backend_service',
        action: 'fail_test'
      })
    ).rejects.toThrow('OSC Collector down');
  });
});
