import {
  trackSnowcatPageView,
  trackSnowcatStructEvent,
  trackSnowcatSelfDescribingEvent,
  type SnowcatPageViewParams,
  type SnowcatStructEventParams,
  type SnowcatSelfDescribingEventParams
} from './snowcat';
import { reportToSimpleCollector } from './simple-collector';

export type EventMode = 'both' | 'no_schema_only' | 'self_describing_only';

export interface EmittedEventInfo {
  eventId: string;
  timestamp: string;
  eventType: 'page_view' | 'struct_event' | 'self_describing';
}

export interface ServiceActionParams {
  mode?: EventMode;
  structEvent: SnowcatStructEventParams;
  selfDescribingEvent: SnowcatSelfDescribingEventParams;
}

export interface ServiceActionEmissionResult {
  mode: EventMode;
  structEvent?: EmittedEventInfo;
  selfDescribingEvent?: EmittedEventInfo;
  eventIds: string[];
}

type ModeListener = (mode: EventMode) => void;
type CountListener = (count: number) => void;

class EventEmitterManager {
  private mode: EventMode = 'both';
  private sessionEventCount: number = 0;
  private modeListeners: Set<ModeListener> = new Set();
  private countListeners: Set<CountListener> = new Set();

  public getEventMode(): EventMode {
    return this.mode;
  }

  public setEventMode(newMode: EventMode): void {
    if (this.mode !== newMode) {
      this.mode = newMode;
      this.modeListeners.forEach((listener) => listener(this.mode));
    }
  }

  public subscribeEventMode(listener: ModeListener): () => void {
    this.modeListeners.add(listener);
    return () => {
      this.modeListeners.delete(listener);
    };
  }

  public getEventCount(): number {
    return this.sessionEventCount;
  }

  public incrementSessionEventCount(amount: number = 1): number {
    this.sessionEventCount += amount;
    this.countListeners.forEach((listener) => listener(this.sessionEventCount));
    return this.sessionEventCount;
  }

  public resetSessionEventCount(): void {
    this.sessionEventCount = 0;
    this.countListeners.forEach((listener) => listener(this.sessionEventCount));
  }

  public subscribeEventCount(listener: CountListener): () => void {
    this.countListeners.add(listener);
    return () => {
      this.countListeners.delete(listener);
    };
  }

  /**
   * Emit Page View event with dual-emission:
   * 1. Snowcat trackSnowcatPageView
   * 2. Simple Collector audit ping (page_view)
   * 3. Session counter increment
   */
  public async emitPageView(
    params: SnowcatPageViewParams = {}
  ): Promise<EmittedEventInfo> {
    const { eventId, timestamp } = trackSnowcatPageView(params);

    await reportToSimpleCollector(eventId, timestamp, 'frontend', 'page_view');
    this.incrementSessionEventCount(1);

    return {
      eventId,
      timestamp,
      eventType: 'page_view'
    };
  }

  /**
   * Emit Structured Event with dual-emission.
   */
  public async emitStructEvent(
    params: SnowcatStructEventParams
  ): Promise<EmittedEventInfo> {
    const { eventId, timestamp } = trackSnowcatStructEvent(params);

    await reportToSimpleCollector(eventId, timestamp, 'frontend', 'struct_event');
    this.incrementSessionEventCount(1);

    return {
      eventId,
      timestamp,
      eventType: 'struct_event'
    };
  }

  /**
   * Emit Self-Describing Event with dual-emission.
   */
  public async emitSelfDescribingEvent(
    params: SnowcatSelfDescribingEventParams
  ): Promise<EmittedEventInfo> {
    const { eventId, timestamp } = trackSnowcatSelfDescribingEvent(params);

    await reportToSimpleCollector(eventId, timestamp, 'frontend', 'self_describing');
    this.incrementSessionEventCount(1);

    return {
      eventId,
      timestamp,
      eventType: 'self_describing'
    };
  }

  /**
   * Unified dual-emission service action dispatcher according to current or specified mode.
   * - 'both': Fires both Structured and Self-Describing events
   * - 'no_schema_only': Fires only Structured event
   * - 'self_describing_only': Fires only Self-Describing event
   */
  public async emitServiceAction(
    params: ServiceActionParams
  ): Promise<ServiceActionEmissionResult> {
    const activeMode = params.mode ?? this.mode;
    const result: ServiceActionEmissionResult = {
      mode: activeMode,
      eventIds: []
    };

    if (activeMode === 'both' || activeMode === 'no_schema_only') {
      const structRes = await this.emitStructEvent(params.structEvent);
      result.structEvent = structRes;
      result.eventIds.push(structRes.eventId);
    }

    if (activeMode === 'both' || activeMode === 'self_describing_only') {
      const sdRes = await this.emitSelfDescribingEvent(params.selfDescribingEvent);
      result.selfDescribingEvent = sdRes;
      result.eventIds.push(sdRes.eventId);
    }

    return result;
  }
}

export const eventEmitter = new EventEmitterManager();
