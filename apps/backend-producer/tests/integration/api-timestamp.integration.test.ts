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

describe('Integration Test: POST /api/timestamp Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validTimezones = [
    { name: 'default (omitted timezone)', body: {} as Record<string, string>, expectedTz: 'UTC' },
    { name: 'UTC canonical', body: { timezone: 'UTC' }, expectedTz: 'UTC' },
    { name: 'Area/City format (America/Sao_Paulo)', body: { timezone: 'America/Sao_Paulo' }, expectedTz: 'America/Sao_Paulo' },
    { name: 'Area/City format (Europe/London)', body: { timezone: 'Europe/London' }, expectedTz: 'Europe/London' },
    { name: 'Area/City format (Asia/Tokyo)', body: { timezone: 'Asia/Tokyo' }, expectedTz: 'Asia/Tokyo' },
    { name: 'Etc/GMT offset format (Etc/GMT+3)', body: { timezone: 'Etc/GMT+3' }, expectedTz: 'Etc/GMT+3' }
  ];

  for (const { name, body, expectedTz } of validTimezones) {
    it(`runs full stack for ${name}`, async () => {
      // 1. Dispatch real HTTP Request into Controller
      const req = new NextRequest('http://localhost:4000/api/timestamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // 2. Execute real Route Handler
      const response = await POST(req);

      // 3. Validate HTTP Status
      expect(response.status).toBe(200);

      // 4. Validate API Response against Zod ResponseSchema
      const responseBody = await response.json();
      const schemaValidation = TimestampResponseSchema.safeParse(responseBody);
      expect(schemaValidation.success).toBe(true);
      expect(responseBody.timezone).toBe(expectedTz);
      expect(responseBody.timestamp_iso).toBeDefined();
      expect(responseBody.formatted_local).toBeDefined();
      expect(new Date(responseBody.timestamp_iso).toISOString()).toBe(responseBody.timestamp_iso);
      expect(responseBody.formatted_local).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/);

      // 5. Verify the real Business Service invoked the External OpenSnowcat Client
      expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
      expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'backend_service',
          action: 'timestamp',
          label: expectedTz,
          property: responseBody.formatted_local
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
  }

  it('rejects invalid timezone with HTTP 400 and suppresses external tracking', async () => {
    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'Invalid/NonExistent_Zone' })
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const responseBody = await response.json();
    expect(responseBody).toEqual({ error: 'Invalid timezone: Invalid/NonExistent_Zone' });

    expect(openSnowcatClient.emitStructuredEvent).not.toHaveBeenCalled();
    expect(simpleCollectorClient.record).not.toHaveBeenCalled();
  });
});
