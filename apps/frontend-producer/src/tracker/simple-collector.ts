import { VITE_SIMPLE_COLLECTOR_URL } from '@/config/env';

export interface SimpleCollectorPayload {
  event_id: string;
  timestamp: string;
  source: 'frontend' | 'backend';
  event_type: string;
}

export interface SimpleCollectorResponse {
  status: string;
  event_id: string;
}

/**
 * Report audit ping to Simple Collector service.
 */
export async function reportToSimpleCollector(
  eventId: string,
  timestamp: string,
  source: 'frontend' | 'backend' = 'frontend',
  eventType: string = 'generic'
): Promise<SimpleCollectorResponse | null> {
  const payload: SimpleCollectorPayload = {
    event_id: eventId,
    timestamp,
    source,
    event_type: eventType
  };

  try {
    const response = await fetch(`${VITE_SIMPLE_COLLECTOR_URL}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(
        `[SimpleCollector] Server returned HTTP ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as SimpleCollectorResponse;
    return data;
  } catch (error) {
    console.warn('[SimpleCollector] Failed to report event to Simple Collector:', error);
    return null;
  }
}
