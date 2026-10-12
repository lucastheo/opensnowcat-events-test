import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/daily-excuse/route';
import { DailyExcuseResponseSchema } from '@/app/api/daily-excuse/schema';
import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';

// STRICT RULE: ONLY External services are mocked in integration tests!
// Controller, Business services, and Domain entities are 100% real.
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

describe('Integration Test: GET /api/daily-excuse Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs real Controller and real Business logic, mocking ONLY External services', async () => {
    // 1. Execute real Route Handler
    const response = await GET();

    // 2. Validate HTTP Status
    expect(response.status).toBe(200);

    // 3. Validate API Response against Zod ResponseSchema
    const responseBody = await response.json();
    const schemaValidation = DailyExcuseResponseSchema.safeParse(responseBody);
    expect(schemaValidation.success).toBe(true);
    expect(responseBody.id).toBeGreaterThanOrEqual(1);
    expect(typeof responseBody.excuse).toBe('string');
    expect(responseBody.excuse.length).toBeGreaterThan(0);

    // 4. Verify the real Business Service invoked the External OpenSnowcat Client
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'backend_service',
        action: 'daily_excuse',
        label: responseBody.excuse,
        value: responseBody.id
      })
    );

    // 5. Verify the real Business Service invoked the External Simple Collector Client
    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(1);
    expect(simpleCollectorClient.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: expect.any(String),
        timestamp: expect.any(String),
        source: 'backend',
        event_type: 'backend_api'
      })
    );

    // 6. Verify deterministic parity: resulting event_id and timestamp from OpenSnowcat match Simple Collector audit record
    const snowcatResult = await vi.mocked(openSnowcatClient.emitStructuredEvent).mock.results[0].value;
    const simpleCollectorCall = vi.mocked(simpleCollectorClient.record).mock.calls[0][0];
    expect(simpleCollectorCall.event_id).toBe(snowcatResult.eventId);
    expect(simpleCollectorCall.timestamp).toBe(snowcatResult.timestamp);

    // 7. Verify sequential flow: OpenSnowcat is invoked before Simple Collector
    const oscOrder = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.invocationCallOrder[0];
    const scOrder = vi.mocked(simpleCollectorClient.record).mock.invocationCallOrder[0];
    expect(oscOrder).toBeLessThan(scOrder);
  });
});
