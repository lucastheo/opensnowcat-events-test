import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/batch/route';
import { BatchResponseSchema } from '@/app/api/batch/schema';
import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';

// STRICT RULE: ONLY External services are mocked in integration tests!
// Controller, Business services, and Domain entities are 100% real.
vi.mock('@/external/opensnowcat.client', () => ({
  openSnowcatClient: {
    emitStructuredEvent: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('@/external/simple-collector.client', () => ({
  simpleCollectorClient: {
    record: vi.fn().mockResolvedValue(true)
  }
}));

describe('Integration Test: POST /api/batch Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs real Controller and real Business logic, mocking ONLY External services', async () => {
    // 1. Dispatch real HTTP Request into Controller
    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 5 })
    });

    // 2. Execute real Route Handler
    const response = await POST(req);

    // 3. Validate HTTP Status
    expect(response.status).toBe(200);

    // 4. Validate API Response against Zod ResponseSchema
    const responseBody = await response.json();
    const schemaValidation = BatchResponseSchema.safeParse(responseBody);
    expect(schemaValidation.success).toBe(true);
    expect(responseBody).toEqual({
      status: 'completed',
      events_emitted: 5
    });

    // 5. Verify the real Business Service invoked the External OpenSnowcat Client 5 times
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(5);

    // 6. Verify the real Business Service invoked the External Simple Collector Client 5 times
    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(5);

    // 7. Verify deterministic parity: event_id and timestamp match across external services for all 5 events
    const oscCalls = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.calls;
    const scCalls = vi.mocked(simpleCollectorClient.record).mock.calls;

    const oscEventIds = oscCalls.map(c => c[0].eventId);
    const scEventIds = scCalls.map(c => c[0].event_id);

    // Ensure all event IDs are unique across emissions
    const uniqueOscIds = new Set(oscEventIds);
    expect(uniqueOscIds.size).toBe(5);

    // Each OpenSnowcat call should match a corresponding Simple Collector call
    for (const oscCall of oscCalls) {
      const payload = oscCall[0];
      expect(payload).toEqual(
        expect.objectContaining({
          category: 'backend_service',
          action: 'batch_event',
          eventId: expect.any(String),
          timestamp: expect.any(String)
        })
      );

      const matchingScCall = scCalls.find(sc => sc[0].event_id === payload.eventId);
      expect(matchingScCall).toBeDefined();
      expect(matchingScCall![0].timestamp).toBe(payload.timestamp);
      expect(matchingScCall![0].source).toBe('backend');
      expect(matchingScCall![0].event_type).toBe('backend_batch');
    }
  });
});
