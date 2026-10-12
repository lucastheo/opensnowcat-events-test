import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as snowcatTracker from '@/tracker/snowcat';
import * as simpleCollector from '@/tracker/simple-collector';
import { eventEmitter } from '@/tracker/event-emitter';

describe('Event Emitter Dual-Emission Dispatcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    eventEmitter.resetSessionEventCount();
    eventEmitter.setEventMode('both');
  });

  it('manages event mode toggle and notifies listeners', () => {
    const listener = vi.fn();
    const unsubscribe = eventEmitter.subscribeEventMode(listener);

    expect(eventEmitter.getEventMode()).toBe('both');

    eventEmitter.setEventMode('no_schema_only');
    expect(eventEmitter.getEventMode()).toBe('no_schema_only');
    expect(listener).toHaveBeenCalledWith('no_schema_only');

    eventEmitter.setEventMode('self_describing_only');
    expect(eventEmitter.getEventMode()).toBe('self_describing_only');
    expect(listener).toHaveBeenCalledWith('self_describing_only');

    unsubscribe();
    eventEmitter.setEventMode('both');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('manages session event count and notifies listeners', () => {
    const listener = vi.fn();
    const unsubscribe = eventEmitter.subscribeEventCount(listener);

    expect(eventEmitter.getEventCount()).toBe(0);

    eventEmitter.incrementSessionEventCount(1);
    expect(eventEmitter.getEventCount()).toBe(1);
    expect(listener).toHaveBeenCalledWith(1);

    eventEmitter.resetSessionEventCount();
    expect(eventEmitter.getEventCount()).toBe(0);
    expect(listener).toHaveBeenCalledWith(0);

    unsubscribe();
  });

  it('emits page view to Snowcat and Simple Collector with matching event_id', async () => {
    const reportSpy = vi.spyOn(simpleCollector, 'reportToSimpleCollector').mockResolvedValue({
      status: 'recorded',
      event_id: 'pageview-id-1'
    });
    const snowcatSpy = vi.spyOn(snowcatTracker, 'trackSnowcatPageView').mockReturnValue({
      eventId: 'pageview-id-1',
      timestamp: '2026-10-12T10:00:00.000Z'
    });

    const result = await eventEmitter.emitPageView({ title: 'Calculator' });

    expect(snowcatSpy).toHaveBeenCalledWith({ title: 'Calculator' });
    expect(reportSpy).toHaveBeenCalledWith(
      'pageview-id-1',
      '2026-10-12T10:00:00.000Z',
      'frontend',
      'page_view'
    );
    expect(eventEmitter.getEventCount()).toBe(1);
    expect(result.eventId).toBe('pageview-id-1');
  });

  it('emits service action in mode "both" (fires both Struct and SD events)', async () => {
    eventEmitter.setEventMode('both');

    const reportSpy = vi.spyOn(simpleCollector, 'reportToSimpleCollector').mockResolvedValue({
      status: 'recorded',
      event_id: 'ok'
    });
    const structSpy = vi.spyOn(snowcatTracker, 'trackSnowcatStructEvent').mockReturnValue({
      eventId: 'struct-uuid-1',
      timestamp: '2026-10-12T10:01:00.000Z'
    });
    const sdSpy = vi.spyOn(snowcatTracker, 'trackSnowcatSelfDescribingEvent').mockReturnValue({
      eventId: 'sd-uuid-2',
      timestamp: '2026-10-12T10:01:00.000Z'
    });

    const result = await eventEmitter.emitServiceAction({
      structEvent: {
        category: 'service',
        action: 'calculate',
        label: 'addition',
        value: 15
      },
      selfDescribingEvent: {
        event: {
          schema: 'iglu:com.opensnowcat.test/calc_event/jsonschema/1-0-0',
          data: { a: 10, b: 5, operator: '+', result: 15 }
        }
      }
    });

    expect(structSpy).toHaveBeenCalledTimes(1);
    expect(sdSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledTimes(2);

    expect(reportSpy).toHaveBeenNthCalledWith(
      1,
      'struct-uuid-1',
      '2026-10-12T10:01:00.000Z',
      'frontend',
      'struct_event'
    );
    expect(reportSpy).toHaveBeenNthCalledWith(
      2,
      'sd-uuid-2',
      '2026-10-12T10:01:00.000Z',
      'frontend',
      'self_describing'
    );

    expect(eventEmitter.getEventCount()).toBe(2);
    expect(result.eventIds).toEqual(['struct-uuid-1', 'sd-uuid-2']);
  });

  it('emits service action in mode "no_schema_only" (fires only Struct event)', async () => {
    eventEmitter.setEventMode('no_schema_only');

    const reportSpy = vi.spyOn(simpleCollector, 'reportToSimpleCollector').mockResolvedValue(null);
    const structSpy = vi.spyOn(snowcatTracker, 'trackSnowcatStructEvent').mockReturnValue({
      eventId: 'struct-uuid-3',
      timestamp: '2026-10-12T10:02:00.000Z'
    });
    const sdSpy = vi.spyOn(snowcatTracker, 'trackSnowcatSelfDescribingEvent');

    const result = await eventEmitter.emitServiceAction({
      structEvent: { category: 'service', action: 'dice' },
      selfDescribingEvent: {
        event: { schema: 'test', data: {} }
      }
    });

    expect(structSpy).toHaveBeenCalledTimes(1);
    expect(sdSpy).not.toHaveBeenCalled();
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(
      'struct-uuid-3',
      '2026-10-12T10:02:00.000Z',
      'frontend',
      'struct_event'
    );
    expect(eventEmitter.getEventCount()).toBe(1);
    expect(result.eventIds).toEqual(['struct-uuid-3']);
  });

  it('emits service action in mode "self_describing_only" (fires only SD event)', async () => {
    eventEmitter.setEventMode('self_describing_only');

    const reportSpy = vi.spyOn(simpleCollector, 'reportToSimpleCollector').mockResolvedValue(null);
    const structSpy = vi.spyOn(snowcatTracker, 'trackSnowcatStructEvent');
    const sdSpy = vi.spyOn(snowcatTracker, 'trackSnowcatSelfDescribingEvent').mockReturnValue({
      eventId: 'sd-uuid-4',
      timestamp: '2026-10-12T10:03:00.000Z'
    });

    const result = await eventEmitter.emitServiceAction({
      structEvent: { category: 'service', action: 'dice' },
      selfDescribingEvent: {
        event: { schema: 'test', data: {} }
      }
    });

    expect(structSpy).not.toHaveBeenCalled();
    expect(sdSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(
      'sd-uuid-4',
      '2026-10-12T10:03:00.000Z',
      'frontend',
      'self_describing'
    );
    expect(eventEmitter.getEventCount()).toBe(1);
    expect(result.eventIds).toEqual(['sd-uuid-4']);
  });
});
