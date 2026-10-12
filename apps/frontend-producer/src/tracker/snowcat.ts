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
  const eventId = params.eventId || crypto.randomUUID();
  const timestamp = params.timestamp
    ? new Date(params.timestamp).toISOString()
    : new Date().toISOString();

  pendingCustomEventId = eventId;
  try {
    trackPageView({
      title: params.title ?? (typeof document !== 'undefined' ? document.title : ''),
      context: params.context,
      timestamp: typeof params.timestamp === 'number'
        ? { type: 'ttm', value: params.timestamp }
        : undefined
    });
  } catch (error) {
    console.warn('[SnowcatTracker] trackPageView error:', error);
  } finally {
    pendingCustomEventId = null;
  }

  return { eventId, timestamp };
}

/**
 * Track structured event in OpenSnowcat.
 */
export function trackSnowcatStructEvent(params: SnowcatStructEventParams): SnowcatEmissionResult {
  const eventId = params.eventId || crypto.randomUUID();
  const timestamp = params.timestamp
    ? new Date(params.timestamp).toISOString()
    : new Date().toISOString();

  pendingCustomEventId = eventId;
  try {
    trackStructEvent({
      category: params.category,
      action: params.action,
      label: params.label,
      property: params.property,
      value: params.value,
      context: params.context,
      timestamp: typeof params.timestamp === 'number'
        ? { type: 'ttm', value: params.timestamp }
        : undefined
    });
  } catch (error) {
    console.warn('[SnowcatTracker] trackStructEvent error:', error);
  } finally {
    pendingCustomEventId = null;
  }

  return { eventId, timestamp };
}

/**
 * Track self-describing event in OpenSnowcat.
 */
export function trackSnowcatSelfDescribingEvent(
  params: SnowcatSelfDescribingEventParams
): SnowcatEmissionResult {
  const eventId = params.eventId || crypto.randomUUID();
  const timestamp = params.timestamp
    ? new Date(params.timestamp).toISOString()
    : new Date().toISOString();

  pendingCustomEventId = eventId;
  try {
    trackSelfDescribingEvent({
      event: params.event,
      context: params.context,
      timestamp: typeof params.timestamp === 'number'
        ? { type: 'ttm', value: params.timestamp }
        : undefined
    });
  } catch (error) {
    console.warn('[SnowcatTracker] trackSelfDescribingEvent error:', error);
  } finally {
    pendingCustomEventId = null;
  }

  return { eventId, timestamp };
}

export function resetSnowcatTracker(): void {
  trackerInstance = null;
  pendingCustomEventId = null;
}
