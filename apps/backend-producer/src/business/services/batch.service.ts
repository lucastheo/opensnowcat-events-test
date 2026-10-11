import { InvalidBatchCountError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export interface BatchParams {
  count?: number;
}

export interface BatchResult {
  status: 'completed';
  events_emitted: number;
}

export class BatchService {
  async emitBatch({ count = 50 }: BatchParams = {}): Promise<BatchResult> {
    if (count < 1 || count > 1000 || !Number.isInteger(count)) {
      throw new InvalidBatchCountError('Batch count must be between 1 and 1000');
    }

    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < count; i++) {
      const eventId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      promises.push(
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

    await Promise.all(promises);

    return {
      status: 'completed',
      events_emitted: count
    };
  }
}

export const batchService = new BatchService();
