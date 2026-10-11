import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchService, batchService } from './batch.service';
import { InvalidBatchCountError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

vi.mock('@/business/tracking.dispatcher', () => ({
  dispatchDualEmission: vi.fn().mockResolvedValue({
    eventId: 'mocked-event-id',
    timestamp: '2026-10-11T12:00:00.000Z'
  })
}));

describe('BatchService', () => {
  let service: BatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BatchService();
  });

  describe('emitBatch Logic & Execution', () => {
    it('executes batch emission with default count=50 and returns completed result', async () => {
      const result = await service.emitBatch();

      expect(result).toEqual({
        status: 'completed',
        events_emitted: 50
      });

      expect(dispatchDualEmission).toHaveBeenCalledTimes(50);
      expect(dispatchDualEmission).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          category: 'backend_service',
          action: 'batch_event',
          label: 'batch_item_1',
          value: 1,
          eventType: 'backend_batch',
          eventId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          timestamp: expect.any(String)
        })
      );
      expect(dispatchDualEmission).toHaveBeenNthCalledWith(
        50,
        expect.objectContaining({
          category: 'backend_service',
          action: 'batch_event',
          label: 'batch_item_50',
          value: 50,
          eventType: 'backend_batch'
        })
      );
    });

    it('executes batch emission with custom count (e.g. count=10)', async () => {
      const result = await service.emitBatch({ count: 10 });

      expect(result).toEqual({
        status: 'completed',
        events_emitted: 10
      });

      expect(dispatchDualEmission).toHaveBeenCalledTimes(10);
      for (let i = 1; i <= 10; i++) {
        expect(dispatchDualEmission).toHaveBeenNthCalledWith(
          i,
          expect.objectContaining({
            category: 'backend_service',
            action: 'batch_event',
            label: `batch_item_${i}`,
            value: i,
            eventType: 'backend_batch'
          })
        );
      }
    });

    it('generates distinct eventIds for each batch event', async () => {
      await service.emitBatch({ count: 5 });

      const calls = vi.mocked(dispatchDualEmission).mock.calls;
      const eventIds = calls.map((c) => c[0].eventId);
      const uniqueEventIds = new Set(eventIds);

      expect(uniqueEventIds.size).toBe(5);
    });
  });

  describe('Bounds Checking & Error Handling', () => {
    it('throws error when count is less than 1', async () => {
      await expect(service.emitBatch({ count: 0 })).rejects.toThrow(InvalidBatchCountError);
      await expect(service.emitBatch({ count: 0 })).rejects.toThrow('Batch count must be between 1 and 1000');
      await expect(service.emitBatch({ count: -5 })).rejects.toThrow(InvalidBatchCountError);
      await expect(service.emitBatch({ count: -5 })).rejects.toThrow('Batch count must be between 1 and 1000');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error when count is greater than 1000', async () => {
      await expect(service.emitBatch({ count: 1001 })).rejects.toThrow(InvalidBatchCountError);
      await expect(service.emitBatch({ count: 1001 })).rejects.toThrow('Batch count must be between 1 and 1000');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error when count is not an integer', async () => {
      await expect(service.emitBatch({ count: 12.5 })).rejects.toThrow(InvalidBatchCountError);
      await expect(service.emitBatch({ count: 12.5 })).rejects.toThrow('Batch count must be between 1 and 1000');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Instance', () => {
    it('exports a default singleton batchService instance', () => {
      expect(batchService).toBeInstanceOf(BatchService);
    });
  });
});
