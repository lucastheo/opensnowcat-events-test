import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { POST as postCalc } from '@/app/api/calc/route';
import { GET as getExcuse } from '@/app/api/daily-excuse/route';
import { openSnowcatClient } from '@/external/opensnowcat.client';
import { simpleCollectorClient } from '@/external/simple-collector.client';
import nextConfig from '../../next.config';

// STRICT RULE: ONLY External services are mocked in integration tests!
vi.mock('@/external/opensnowcat.client', () => ({
  openSnowcatClient: {
    emitStructuredEvent: vi.fn().mockImplementation(async (params) => ({
      eventId: params?.eventId ?? crypto.randomUUID(),
      timestamp: params?.timestamp ?? new Date().toISOString(),
    })),
  },
}));

vi.mock('@/external/simple-collector.client', () => ({
  simpleCollectorClient: {
    record: vi.fn().mockResolvedValue({ status: 'ok', event_id: 'test' }),
  },
}));

describe('Integration Test: CORS Support & Preflight Flow', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    if (originalCorsOrigin !== undefined) {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    } else {
      delete process.env.CORS_ORIGIN;
    }
  });

  it('validates next.config.ts specifies CORS headers for /api/:path*', async () => {
    expect(nextConfig.headers).toBeDefined();
    if (nextConfig.headers) {
      const headerConfigs = await nextConfig.headers();
      const apiHeaderConfig = headerConfigs.find((cfg) => cfg.source === '/api/:path*');
      expect(apiHeaderConfig).toBeDefined();

      const headersMap = Object.fromEntries(
        (apiHeaderConfig?.headers ?? []).map((h) => [h.key, h.value])
      );
      expect(headersMap['Access-Control-Allow-Origin']).toBe('*');
      expect(headersMap['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(headersMap['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization, X-Requested-With');
      expect(headersMap['Access-Control-Max-Age']).toBe('86400');
    }
  });

  it('handles browser preflight OPTIONS requests across API endpoints without invoking business logic', async () => {
    const endpoints = [
      'http://localhost:4000/api/calc',
      'http://localhost:4000/api/timestamp',
      'http://localhost:4000/api/daily-excuse',
      'http://localhost:4000/api/dice',
      'http://localhost:4000/api/batch',
      'http://localhost:4000/api/health',
    ];

    for (const url of endpoints) {
      const preflightReq = new NextRequest(url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      const preflightRes = middleware(preflightReq);

      expect(preflightRes.status).toBe(204);
      expect(preflightRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(preflightRes.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(preflightRes.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization, X-Requested-With');
      expect(preflightRes.headers.get('Access-Control-Max-Age')).toBe('86400');
    }

    // Preflight must never invoke external emitters
    expect(openSnowcatClient.emitStructuredEvent).not.toHaveBeenCalled();
    expect(simpleCollectorClient.record).not.toHaveBeenCalled();
  });

  it('simulates full preflight + POST flow with CORS headers and dual emission', async () => {
    const origin = 'http://localhost:3000';
    process.env.CORS_ORIGIN = origin;

    // 1. Browser sends preflight OPTIONS request
    const preflightReq = new NextRequest('http://localhost:4000/api/calc', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    const preflightRes = middleware(preflightReq);
    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(preflightRes.headers.get('Access-Control-Allow-Methods')).toContain('POST');

    // 2. Browser sends actual POST request through middleware
    const postReq = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ a: 25, b: 5, operator: '/' }),
    });

    const middlewareRes = middleware(postReq);
    expect(middlewareRes.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(middlewareRes.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');

    // 3. Controller processes request, verifies real business logic and dual emission
    const response = await postCalc(postReq);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ result: 5 });

    // 4. Verify external clients received dual emission
    expect(openSnowcatClient.emitStructuredEvent).toHaveBeenCalledTimes(1);
    expect(simpleCollectorClient.record).toHaveBeenCalledTimes(1);
  });

  it('simulates preflight + GET request with custom CORS origin', async () => {
    process.env.CORS_ORIGIN = 'http://frontend.example.com';

    const getReq = new NextRequest('http://localhost:4000/api/daily-excuse', {
      method: 'GET',
      headers: {
        Origin: 'http://frontend.example.com',
      },
    });

    const middlewareRes = middleware(getReq);
    expect(middlewareRes.headers.get('Access-Control-Allow-Origin')).toBe('http://frontend.example.com');

    const response = await getExcuse();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('excuse');
    expect(body).toHaveProperty('id');
  });
});
