import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config, ALLOWED_METHODS, ALLOWED_HEADERS, MAX_AGE } from './middleware';

describe('Middleware (CORS)', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    if (originalCorsOrigin !== undefined) {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    } else {
      delete process.env.CORS_ORIGIN;
    }
  });

  it('exports matcher configuration for /api/:path*', () => {
    expect(config.matcher).toEqual(['/api/:path*']);
  });

  it('exports expected CORS constants', () => {
    expect(ALLOWED_METHODS).toBe('GET, POST, OPTIONS');
    expect(ALLOWED_HEADERS).toBe('Content-Type, Authorization, X-Requested-With');
    expect(MAX_AGE).toBe('86400');
  });

  it('handles OPTIONS preflight requests: returns HTTP 204 with full CORS headers', () => {
    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'OPTIONS',
    });

    const res = middleware(req);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe(ALLOWED_METHODS);
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe(ALLOWED_HEADERS);
    expect(res.headers.get('Access-Control-Max-Age')).toBe(MAX_AGE);
  });

  it('handles normal requests: passes through via NextResponse.next() and adds CORS headers without Max-Age', () => {
    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
    });

    const res = middleware(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe(ALLOWED_METHODS);
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe(ALLOWED_HEADERS);
    expect(res.headers.get('Access-Control-Max-Age')).toBeNull();
  });

  it('handles both /api and /api/* paths correctly', () => {
    const rootReq = new NextRequest('http://localhost:4000/api', {
      method: 'OPTIONS',
    });
    const rootRes = middleware(rootReq);
    expect(rootRes.status).toBe(204);
    expect(rootRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(rootRes.headers.get('Access-Control-Allow-Methods')).toBe(ALLOWED_METHODS);

    const subReq = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'GET',
    });
    const subRes = middleware(subReq);
    expect(subRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(subRes.headers.get('Access-Control-Allow-Methods')).toBe(ALLOWED_METHODS);
  });

  it('respects custom process.env.CORS_ORIGIN for preflight and normal requests', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';

    const preflightReq = new NextRequest('http://localhost:4000/api/daily-excuse', {
      method: 'OPTIONS',
    });
    const preflightRes = middleware(preflightReq);
    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(preflightRes.headers.get('Access-Control-Allow-Methods')).toBe(ALLOWED_METHODS);
    expect(preflightRes.headers.get('Access-Control-Allow-Headers')).toBe(ALLOWED_HEADERS);
    expect(preflightRes.headers.get('Access-Control-Max-Age')).toBe(MAX_AGE);

    const normalReq = new NextRequest('http://localhost:4000/api/daily-excuse', {
      method: 'GET',
    });
    const normalRes = middleware(normalReq);
    expect(normalRes.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(normalRes.headers.get('Access-Control-Allow-Methods')).toBe(ALLOWED_METHODS);
    expect(normalRes.headers.get('Access-Control-Allow-Headers')).toBe(ALLOWED_HEADERS);
    expect(normalRes.headers.get('Access-Control-Max-Age')).toBeNull();
  });

  it('passes through non-api path without modification', () => {
    const req = new NextRequest('http://localhost:4000/health', {
      method: 'GET',
    });

    const res = middleware(req);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Methods')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Headers')).toBeNull();
    expect(res.headers.get('Access-Control-Max-Age')).toBeNull();
  });
});
