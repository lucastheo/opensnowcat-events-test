import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchService, batchService, CHUNK_SIZE } from './batch.service';
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

  describe('CHUNK_SIZE Configuration', () => {
    it('defines CHUNK_SIZE constant as 5', () => {
      expect(CHUNK_SIZE).toBe(5);
      expect(BatchService.CHUNK_SIZE).toBe(5);
      expect(service.CHUNK_SIZE).toBe(5);
    });
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
          eventType: 'backend_batch'
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

    it('dispatches batch events with unique labels for each batch event', async () => {
      await service.emitBatch({ count: 5 });

      const calls = vi.mocked(dispatchDualEmission).mock.calls;
      const labels = calls.map((c) => c[0].label);
      const uniqueLabels = new Set(labels);

      expect(uniqueLabels.size).toBe(5);
    });

    it('verifies chunked execution behavior across multiple chunks (count=12 across 3 chunks: 5 + 5 + 2)', async () => {
      const result = await service.emitBatch({ count: 12 });

      expect(result).toEqual({
        status: 'completed',
        events_emitted: 12
      });

      expect(dispatchDualEmission).toHaveBeenCalledTimes(12);

      // Verify all 12 events are dispatched with sequential indices (batch_item_1 to batch_item_12)
      for (let i = 1; i <= 12; i++) {
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

    it('limits concurrent executions to CHUNK_SIZE (5) and executes chunks sequentially', async () => {
      let activeConcurrency = 0;
      let peakConcurrency = 0;
      const chunkExecutionOrder: number[][] = [];
      let currentChunk: number[] = [];

      vi.mocked(dispatchDualEmission).mockImplementation(async (params) => {
        activeConcurrency++;
        peakConcurrency = Math.max(peakConcurrency, activeConcurrency);
        if (typeof params.value === 'number') {
          currentChunk.push(params.value);
        }

        // Simulate async I/O delay
        await new Promise((resolve) => setTimeout(resolve, 10));

        activeConcurrency--;
        if (activeConcurrency === 0) {
          chunkExecutionOrder.push([...currentChunk]);
          currentChunk = [];
        }

        return {
          eventId: 'test-event-id',
          timestamp: '2026-10-11T12:00:00.000Z'
        };
      });

      const result = await service.emitBatch({ count: 12 });

      expect(result).toEqual({
        status: 'completed',
        events_emitted: 12
      });

      // Peak concurrency must strictly equal CHUNK_SIZE (5)
      expect(peakConcurrency).toBe(5);
      expect(activeConcurrency).toBe(0);

      // Verify chunks were executed in distinct sequential batches: [1..5], [6..10], [11..12]
      expect(chunkExecutionOrder).toEqual([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12]
      ]);
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
