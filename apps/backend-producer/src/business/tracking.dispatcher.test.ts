import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchDualEmission, ZERO_UUID, type DualEmissionParams } from './tracking.dispatcher';
import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';

vi.mock('@/external/opensnowcat.client', () => ({
  openSnowcatClient: {
    emitStructuredEvent: vi.fn()
  }
}));

vi.mock('@/external/simple-collector.client', () => ({
  simpleCollectorClient: {
    record: vi.fn().mockResolvedValue(true)
  }
}));

describe('Tracking Dispatcher (dispatchDualEmission)', () => {
  const defaultSnowcatResult = {
    eventId: 'snowcat-uuid-1111',
    timestamp: '2026-10-11T12:34:56.789Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openSnowcatClient.emitStructuredEvent).mockResolvedValue(defaultSnowcatResult);
    vi.mocked(simpleCollectorClient.record).mockResolvedValue(true);
  });

  it('executes sequentially: calls openSnowcatClient first, then simpleCollectorClient', async () => {
    const executionOrder: string[] = [];

    vi.mocked(openSnowcatClient.emitStructuredEvent).mockImplementationOnce(async () => {
      executionOrder.push('openSnowcat');
      return defaultSnowcatResult;
    });

    vi.mocked(simpleCollectorClient.record).mockImplementationOnce(async () => {
      executionOrder.push('simpleCollector');
      return true;
    });

    const params: DualEmissionParams = {
      category: 'backend_service',
      action: 'calculate',
      label: '+',
      property: '1+2',
      value: 3
    };

    await dispatchDualEmission(params);

    expect(executionOrder).toEqual(['openSnowcat', 'simpleCollector']);
    const oscOrder = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.invocationCallOrder[0];
    const scOrder = vi.mocked(simpleCollectorClient.record).mock.invocationCallOrder[0];
    expect(oscOrder).toBeLessThan(scOrder);
  });

  it('forwards input params to openSnowcatClient and passes exact event_id and timestamp to simpleCollectorClient', async () => {
    const customResult = {
      eventId: 'tracked-uuid-9876',
      timestamp: '2026-10-11T15:00:00.000Z'
    };
    vi.mocked(openSnowcatClient.emitStructuredEvent).mockResolvedValueOnce(customResult);

    const params: DualEmissionParams = {
      category: 'backend_service',
      action: 'calculate',
      label: '*',
      property: '6*7',
      value: 42
    };

    const result = await dispatchDualEmission(params);

    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith(params);

    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(1);
    expect(simpleCollectorClient.record).toHaveBeenCalledWith({
      event_id: customResult.eventId,
      timestamp: customResult.timestamp,
      source: 'backend',
      event_type: 'backend_api'
    });

    expect(result).toEqual({
      eventId: customResult.eventId,
      timestamp: customResult.timestamp
    });
  });

  it('respects custom eventType override on simpleCollectorClient', async () => {
    const params: DualEmissionParams = {
      category: 'backend_service',
      action: 'batch_event',
      eventType: 'backend_batch'
    };

    const result = await dispatchDualEmission(params);

    expect(result.eventId).toBe(defaultSnowcatResult.eventId);
    expect(result.timestamp).toBe(defaultSnowcatResult.timestamp);

    expect(simpleCollectorClient.record).toHaveBeenCalledWith({
      event_id: defaultSnowcatResult.eventId,
      timestamp: defaultSnowcatResult.timestamp,
      source: 'backend',
      event_type: 'backend_batch'
    });
  });

  describe('fallback handling when openSnowcatClient returns null or missing identifiers', () => {
    it('returns zeros uuid and uses params.timestamp when openSnowcatClient returns null and timestamp is provided', async () => {
      vi.mocked(openSnowcatClient.emitStructuredEvent).mockResolvedValueOnce(null);

      const customTimestamp = '2026-10-11T10:00:00.000Z';

      const params: DualEmissionParams = {
        category: 'backend_service',
        action: 'test_action',
        timestamp: customTimestamp
      };

      const result = await dispatchDualEmission(params);

      expect(result.eventId).toBe(ZERO_UUID);
      expect(result.eventId).toBe('00000000-0000-0000-0000-000000000000');
      expect(result.timestamp).toBe(customTimestamp);

      expect(simpleCollectorClient.record).toHaveBeenCalledWith({
        event_id: ZERO_UUID,
        timestamp: customTimestamp,
        source: 'backend',
        event_type: 'backend_api'
      });
    });

    it('returns zeros uuid and generated ISO timestamp when openSnowcatClient returns null without params overrides', async () => {
      vi.mocked(openSnowcatClient.emitStructuredEvent).mockResolvedValueOnce(null);

      const params: DualEmissionParams = {
        category: 'backend_service',
        action: 'test_action'
      };

      const result = await dispatchDualEmission(params);

      expect(result.eventId).toBe(ZERO_UUID);
      expect(result.eventId).toBe('00000000-0000-0000-0000-000000000000');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

      expect(simpleCollectorClient.record).toHaveBeenCalledWith({
        event_id: ZERO_UUID,
        timestamp: result.timestamp,
        source: 'backend',
        event_type: 'backend_api'
      });
    });

    it('returns zeros uuid when openSnowcatClient returns an object with empty eventId', async () => {
      vi.mocked(openSnowcatClient.emitStructuredEvent).mockResolvedValueOnce({
        eventId: '',
        timestamp: '2026-10-11T12:00:00.000Z'
      });

      const params: DualEmissionParams = {
        category: 'backend_service',
        action: 'test_action'
      };

      const result = await dispatchDualEmission(params);

      expect(result.eventId).toBe(ZERO_UUID);
      expect(result.timestamp).toBe('2026-10-11T12:00:00.000Z');

      expect(simpleCollectorClient.record).toHaveBeenCalledWith({
        event_id: ZERO_UUID,
        timestamp: '2026-10-11T12:00:00.000Z',
        source: 'backend',
        event_type: 'backend_api'
      });
    });
  });

  describe('error handling', () => {
    it('propagates rejection if openSnowcatClient fails and does not invoke simpleCollectorClient', async () => {
      vi.mocked(openSnowcatClient.emitStructuredEvent).mockRejectedValueOnce(new Error('OSC Collector down'));

      await expect(
        dispatchDualEmission({
          category: 'backend_service',
          action: 'fail_test'
        })
      ).rejects.toThrow('OSC Collector down');

      expect(simpleCollectorClient.record).not.toHaveBeenCalled();
    });

    it('propagates rejection if simpleCollectorClient fails', async () => {
      vi.mocked(simpleCollectorClient.record).mockRejectedValueOnce(new Error('Simple Collector disk full'));

      await expect(
        dispatchDualEmission({
          category: 'backend_service',
          action: 'fail_test'
        })
      ).rejects.toThrow('Simple Collector disk full');
    });
  });
});
