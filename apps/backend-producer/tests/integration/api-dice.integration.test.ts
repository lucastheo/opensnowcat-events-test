import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/dice/route';
import { DiceResponseSchema } from '@/app/api/dice/schema';
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

describe('Integration Test: POST /api/dice Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs real Controller and real Business logic, mocking ONLY External services', async () => {
    // 1. Dispatch real HTTP Request into Controller
    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 3, sides: 'd20' })
    });

    // 2. Execute real Route Handler
    const response = await POST(req);

    // 3. Validate HTTP Status
    expect(response.status).toBe(200);

    // 4. Validate API Response against Zod ResponseSchema
    const responseBody = await response.json();
    const schemaValidation = DiceResponseSchema.safeParse(responseBody);
    expect(schemaValidation.success).toBe(true);
    expect(responseBody.rolls).toHaveLength(3);
    for (const roll of responseBody.rolls) {
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
    }
    const computedTotal = responseBody.rolls.reduce((sum: number, r: number) => sum + r, 0);
    expect(responseBody.total).toBe(computedTotal);

    // 5. Verify the real Business Service invoked the External OpenSnowcat Client
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'backend_service',
        action: 'dice_roll',
        label: 'd20',
        property: responseBody.rolls.join(','),
        value: responseBody.total
      })
    );

    // 6. Verify the real Business Service invoked the External Simple Collector Client
    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(1);
    expect(simpleCollectorClient.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: expect.any(String),
        timestamp: expect.any(String),
        source: 'backend',
        event_type: 'backend_api'
      })
    );

    // 7. Verify deterministic parity: resulting event_id and timestamp from OpenSnowcat match Simple Collector audit record
    const snowcatResult = await vi.mocked(openSnowcatClient.emitStructuredEvent).mock.results[0].value;
    const simpleCollectorCall = vi.mocked(simpleCollectorClient.record).mock.calls[0][0];
    expect(simpleCollectorCall.event_id).toBe(snowcatResult.eventId);
    expect(simpleCollectorCall.timestamp).toBe(snowcatResult.timestamp);

    // 8. Verify sequential flow: OpenSnowcat is invoked before Simple Collector
    const oscOrder = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.invocationCallOrder[0];
    const scOrder = vi.mocked(simpleCollectorClient.record).mock.invocationCallOrder[0];
    expect(oscOrder).toBeLessThan(scOrder);
  });
});
