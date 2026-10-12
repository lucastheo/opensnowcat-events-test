import {
  newTracker,
  trackPageView,
  trackStructEvent,
  trackSelfDescribingEvent,
  type BrowserTracker,
  type SelfDescribingJson
} from '@snowplow/browser-tracker';
import { VITE_OPENSNOWCAT_URL } from '@/config/env';

export interface SnowcatPageViewParams {
  title?: string;
  eventId?: string;
  timestamp?: string | number;
  context?: SelfDescribingJson[];
}

export interface SnowcatStructEventParams {
  category: string;
  action: string;
  label?: string;
  property?: string;
  value?: number;
  eventId?: string;
  timestamp?: string | number;
  context?: SelfDescribingJson[];
}

export interface SnowcatSelfDescribingEventParams {
  event: {
    schema: string;
    data: Record<string, unknown>;
  };
  eventId?: string;
  timestamp?: string | number;
  context?: SelfDescribingJson[];
}

export interface SnowcatEmissionResult {
  eventId: string;
  timestamp: string;
}

let trackerInstance: BrowserTracker | null = null;
let pendingCustomEventId: string | null = null;

const customEventIdPlugin = {
  beforeTrack: (pb: { add: (key: string, value: string) => void }) => {
    if (pendingCustomEventId) {
      pb.add('eid', pendingCustomEventId);
    }
  }
};

/**
 * Execute tracking lifecycle shared by all event emission functions:
 * - Generates / validates eventId
 * - Computes ISO timestamp string and trueTimestamp number
 * - Sets and clears pendingCustomEventId for the tracker plugin
 * - Wraps trackFn in try / catch / finally
 * - Returns { eventId, timestamp }
 */
function executeTrack<T>(
  params: { eventId?: string; timestamp?: string | number },
  trackFn: (trackContext: { eventId: string; trueTimestamp: number }) => T
): SnowcatEmissionResult {
  const eventId = params.eventId || crypto.randomUUID();
  let trueTimestamp: number;
  let timestamp: string;

  if (typeof params.timestamp === 'number') {
    trueTimestamp = params.timestamp;
    timestamp = new Date(params.timestamp).toISOString();
  } else if (typeof params.timestamp === 'string') {
    const parsed = Date.parse(params.timestamp);
    trueTimestamp = isNaN(parsed) ? Date.now() : parsed;
    timestamp = isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
  } else {
    trueTimestamp = Date.now();
    timestamp = new Date(trueTimestamp).toISOString();
  }

  pendingCustomEventId = eventId;
  try {
    trackFn({ eventId, trueTimestamp });
  } catch (error) {
    console.warn('[SnowcatTracker] track execution error:', error);
  } finally {
    pendingCustomEventId = null;
  }

  return { eventId, timestamp };
}

/**
 * Initialize OpenSnowcat browser tracker instance.
 */
export function initSnowcatTracker(endpoint: string = VITE_OPENSNOWCAT_URL): BrowserTracker | undefined {
  if (trackerInstance) {
    return trackerInstance;
  }

  try {
    trackerInstance = newTracker('opensnowcat', endpoint, {
      appId: 'frontend-producer',
      bufferSize: 1,
      plugins: [customEventIdPlugin]
    }) ?? null;

    return trackerInstance ?? undefined;
  } catch (error) {
    console.warn('[SnowcatTracker] Failed to initialize OpenSnowcat tracker:', error);
    return undefined;
  }
}

/**
 * Track page view event in OpenSnowcat.
 */
export function trackSnowcatPageView(params: SnowcatPageViewParams = {}): SnowcatEmissionResult {
  return executeTrack(params, ({ trueTimestamp }) => {
    trackPageView({
      title: params.title ?? (typeof document !== 'undefined' ? document.title : ''),
      context: params.context,
      timestamp: { type: 'ttm', value: trueTimestamp }
    });
  });
}

/**
 * Track structured event in OpenSnowcat.
 */
export function trackSnowcatStructEvent(params: SnowcatStructEventParams): SnowcatEmissionResult {
  return executeTrack(params, ({ trueTimestamp }) => {
    trackStructEvent({
      category: params.category,
      action: params.action,
      label: params.label,
      property: params.property,
      value: params.value,
      context: params.context,
      timestamp: { type: 'ttm', value: trueTimestamp }
    });
  });
}

/**
 * Track self-describing event in OpenSnowcat.
 */
export function trackSnowcatSelfDescribingEvent(
  params: SnowcatSelfDescribingEventParams
): SnowcatEmissionResult {
  return executeTrack(params, ({ trueTimestamp }) => {
    trackSelfDescribingEvent({
      event: params.event,
      context: params.context,
      timestamp: { type: 'ttm', value: trueTimestamp }
    });
  });
}

export function resetSnowcatTracker(): void {
  trackerInstance = null;
  pendingCustomEventId = null;
}
