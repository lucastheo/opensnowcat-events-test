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
 * Dispatches tracking events to OpenSnowcat Stream Collector and Simple Collector concurrently.
 * Ensures consistent event_id and timestamp across both audit and analytics streams.
 */
export async function dispatchDualEmission(
  params: DualEmissionParams
): Promise<DualEmissionResult> {
  const eventId = params.eventId ?? crypto.randomUUID();
  const timestamp = params.timestamp ?? new Date().toISOString();
  const eventType = params.eventType ?? 'backend_api';

  await Promise.all([
    openSnowcatClient.emitStructuredEvent({
      category: params.category,
      action: params.action,
      label: params.label,
      property: params.property,
      value: params.value,
      eventId,
      timestamp
    }),
    simpleCollectorClient.record({
      event_id: eventId,
      timestamp,
      source: 'backend',
      event_type: eventType
    })
  ]);

  return { eventId, timestamp };
}
