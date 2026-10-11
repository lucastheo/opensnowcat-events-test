import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/timestamp/route';
import { TimestampResponseSchema } from '@/app/api/timestamp/schema';
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

describe('Integration Test: POST /api/timestamp Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs real Controller and real Business logic, mocking ONLY External services', async () => {
    // 1. Dispatch real HTTP Request into Controller
    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'America/Sao_Paulo' })
    });

    // 2. Execute real Route Handler
    const response = await POST(req);

    // 3. Validate HTTP Status
    expect(response.status).toBe(200);

    // 4. Validate API Response against Zod ResponseSchema
    const responseBody = await response.json();
    const schemaValidation = TimestampResponseSchema.safeParse(responseBody);
    expect(schemaValidation.success).toBe(true);
    expect(responseBody.timezone).toBe('America/Sao_Paulo');
    expect(responseBody.timestamp_iso).toBeDefined();
    expect(responseBody.formatted_local).toBeDefined();

    // 5. Verify the real Business Service invoked the External OpenSnowcat Client
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'backend_service',
        action: 'timestamp',
        label: 'America/Sao_Paulo',
        property: responseBody.formatted_local,
        eventId: expect.any(String),
        timestamp: expect.any(String)
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

    // 7. Verify deterministic parity: event_id and timestamp match across external services
    const openSnowcatCall = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.calls[0][0];
    const simpleCollectorCall = vi.mocked(simpleCollectorClient.record).mock.calls[0][0];
    expect(openSnowcatCall.eventId).toBe(simpleCollectorCall.event_id);
    expect(openSnowcatCall.timestamp).toBe(simpleCollectorCall.timestamp);
  });
});
