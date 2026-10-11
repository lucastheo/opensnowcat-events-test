import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';

export interface DualEmissionParams {
  category: string;
  action: string;
  label?: string;
  property?: string;
  value?: number;
  eventId?: string;
  timestamp?: string;
  eventType?: string;
}

export interface DualEmissionResult {
  eventId: string;
  timestamp: string;
}

/**
 * Dispatches tracking events sequentially:
 * 1. Produces the event to OpenSnowcat via official @snowplow/node-tracker.
 * 2. Extracts the resulting event_id and timestamp (with fallbacks if needed).
 * 3. Records the audit log entry to Simple Collector with identical event_id and timestamp.
 */
export async function dispatchDualEmission(
  params: DualEmissionParams
): Promise<DualEmissionResult> {
  const snowcatResult = await openSnowcatClient.emitStructuredEvent(params);

  const eventId = snowcatResult?.eventId ?? params.eventId ?? crypto.randomUUID();
  const timestamp = snowcatResult?.timestamp ?? params.timestamp ?? new Date().toISOString();

  await simpleCollectorClient.record({
    event_id: eventId,
    timestamp,
    source: 'backend',
    event_type: params.eventType ?? 'backend_api'
  });

  return { eventId, timestamp };
}
