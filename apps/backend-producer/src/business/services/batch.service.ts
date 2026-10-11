import { InvalidBatchCountError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export interface BatchParams {
  count?: number;
}

export interface BatchResult {
  status: 'completed';
  events_emitted: number;
}

export const CHUNK_SIZE = 5;

export class BatchService {
  static readonly CHUNK_SIZE = CHUNK_SIZE;
  readonly CHUNK_SIZE = CHUNK_SIZE;

  async emitBatch({ count = 50 }: BatchParams = {}): Promise<BatchResult> {
    if (count < 1 || count > 1000 || !Number.isInteger(count)) {
      throw new InvalidBatchCountError('Batch count must be between 1 and 1000');
    }

    for (let chunkStart = 0; chunkStart < count; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, count);
      const chunkPromises: Promise<unknown>[] = [];

      for (let i = chunkStart; i < chunkEnd; i++) {
        const eventId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        chunkPromises.push(
          dispatchDualEmission({
            category: 'backend_service',
            action: 'batch_event',
            label: `batch_item_${i + 1}`,
            value: i + 1,
            eventId,
            timestamp,
            eventType: 'backend_batch'
          })
        );
      }

      await Promise.all(chunkPromises);
    }

    return {
      status: 'completed',
      events_emitted: count
    };
  }
}

export const batchService = new BatchService();
