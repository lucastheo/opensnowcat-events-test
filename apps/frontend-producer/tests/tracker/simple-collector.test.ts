import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportToSimpleCollector } from '@/tracker/simple-collector';
import { VITE_SIMPLE_COLLECTOR_URL } from '@/config/env';

describe('Simple Collector Reporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts event audit record successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ status: 'recorded', event_id: 'test-uuid-1' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await reportToSimpleCollector('test-uuid-1', '2026-10-12T12:00:00Z', 'frontend', 'page_view');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${VITE_SIMPLE_COLLECTOR_URL}/collect`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'test-uuid-1',
          timestamp: '2026-10-12T12:00:00Z',
          source: 'frontend',
          event_type: 'page_view'
        })
      })
    );
    expect(res).toEqual({ status: 'recorded', event_id: 'test-uuid-1' });
  });

  it('returns null when collector responds with HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await reportToSimpleCollector('test-uuid-2', '2026-10-12T12:00:00Z', 'frontend', 'struct_event');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res).toBeNull();
  });

  it('returns null and catches network errors without crashing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await reportToSimpleCollector('test-uuid-3', '2026-10-12T12:00:00Z', 'frontend', 'self_describing');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res).toBeNull();
  });
});
