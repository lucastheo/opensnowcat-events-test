import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/health/route';
import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';

// STRICT RULE: ONLY External services are mocked in integration tests!
vi.mock('@/external/opensnowcat.client', () => ({
  openSnowcatClient: {
    emitStructuredEvent: vi.fn().mockImplementation(async (params) => ({
      eventId: params?.eventId ?? crypto.randomUUID(),
      timestamp: params?.timestamp ?? new Date().toISOString()
    }))
  }
}));

vi.mock('@/external/simple-collector.client', () => ({
  simpleCollectorClient: {
    record: vi.fn().mockResolvedValue({ status: 'ok', event_id: 'test' })
  }
}));

describe('Integration Test: GET /api/health Full Flow', () => {
  it('returns HTTP 200 with ok status and backend-producer service name without external dispatch', async () => {
    // 1. Execute real Route Handler
    const response = await GET();

    // 2. Validate HTTP Status
    expect(response.status).toBe(200);

    // 3. Validate API Response body
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      status: 'ok',
      service: 'backend-producer'
    });

    // 4. Validate that health check does not dispatch external telemetry or audit records
    expect(openSnowcatClient.emitStructuredEvent).not.toHaveBeenCalled();
    expect(simpleCollectorClient.record).not.toHaveBeenCalled();
  });
});
