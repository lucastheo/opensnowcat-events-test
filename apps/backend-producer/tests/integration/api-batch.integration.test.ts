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
    const oscResults = await Promise.all(
      vi.mocked(openSnowcatClient.emitStructuredEvent).mock.results.map(r => r.value)
    );
    const scCalls = vi.mocked(simpleCollectorClient.record).mock.calls;

    const oscEventIds = oscResults.map(r => r.eventId);
    const scEventIds = scCalls.map(c => c[0].event_id);

    // Ensure all event IDs are unique across emissions
    const uniqueOscIds = new Set(oscEventIds);
    expect(uniqueOscIds.size).toBe(5);

    // OpenSnowcat payloads have required fields
    for (const oscCall of oscCalls) {
      const payload = oscCall[0];
      expect(payload).toEqual(
        expect.objectContaining({
          category: 'backend_service',
          action: 'batch_event'
        })
      );
    }

    // Each OpenSnowcat result matches a corresponding Simple Collector call
    for (const oscResult of oscResults) {
      const matchingScCall = scCalls.find(sc => sc[0].event_id === oscResult.eventId);
      expect(matchingScCall).toBeDefined();
      expect(matchingScCall![0].timestamp).toBe(oscResult.timestamp);
      expect(matchingScCall![0].source).toBe('backend');
      expect(matchingScCall![0].event_type).toBe('backend_batch');
    }

    // 8. Verify sequential flow per emission: OpenSnowcat is invoked before Simple Collector
    const oscOrder = vi.mocked(openSnowcatClient.emitStructuredEvent).mock.invocationCallOrder[0];
    const scOrder = vi.mocked(simpleCollectorClient.record).mock.invocationCallOrder[0];
    expect(oscOrder).toBeLessThan(scOrder);
  });

  it('processes multi-chunk batches across controller and business layers with chunked external emission', async () => {
    let activeOscConcurrent = 0;
    let peakOscConcurrent = 0;

    vi.mocked(openSnowcatClient.emitStructuredEvent).mockImplementation(async (params) => {
      activeOscConcurrent++;
      peakOscConcurrent = Math.max(peakOscConcurrent, activeOscConcurrent);
      await new Promise(resolve => setTimeout(resolve, 5));
      activeOscConcurrent--;
      return {
        eventId: crypto.randomUUID(),
        timestamp: (params as any)?.timestamp ?? new Date().toISOString()
      };
    });

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 12 })
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      status: 'completed',
      events_emitted: 12
    });

    // Peak concurrency for OSC external client cannot exceed CHUNK_SIZE = 5
    expect(peakOscConcurrent).toBe(5);
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(12);
    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(12);
  });
});
