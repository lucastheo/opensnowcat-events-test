import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { calcService } from '@/business/services/calc.service';
import { Calculation } from '@/business/domain/calculation';

vi.mock('@/business/services/calc.service', () => ({
  calcService: {
    calculate: vi.fn()
  }
}));

describe('Calc Controller (POST /api/calc)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 Bad Request when request body has invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: 'invalid-json{'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Invalid JSON' });
    expect(calcService.calculate).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when request body fails Zod schema (missing fields)', async () => {
    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 10 })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('b');
    expect(data.errors).toHaveProperty('operator');
    expect(calcService.calculate).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when request body fails Zod schema (invalid types & operator)', async () => {
    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 'not-a-number', b: 5, operator: '^' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('a');
    expect(data.errors).toHaveProperty('operator');
    expect(calcService.calculate).not.toHaveBeenCalled();
  });

  it('delegates valid body to Business Service and returns ResponseSchema (HTTP 200)', async () => {
    vi.mocked(calcService.calculate).mockResolvedValueOnce(
      new Calculation(10, 5, '+', 15)
    );

    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 10, b: 5, operator: '+' })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({ result: 15 });
    expect(calcService.calculate).toHaveBeenCalledWith({ a: 10, b: 5, operator: '+' });
  });

  it('returns 400 Bad Request when business service throws Division by zero', async () => {
    vi.mocked(calcService.calculate).mockRejectedValueOnce(new Error('Division by zero'));

    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 10, b: 0, operator: '/' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Division by zero' });
    expect(calcService.calculate).toHaveBeenCalledWith({ a: 10, b: 0, operator: '/' });
  });

  it('returns 400 Bad Request when business service throws Unsupported operator', async () => {
    vi.mocked(calcService.calculate).mockRejectedValueOnce(new Error('Unsupported operator: %'));

    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 10, b: 2, operator: '+' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Unsupported operator: %' });
  });

  it('returns 500 Internal Server Error when unexpected error occurs', async () => {
    vi.mocked(calcService.calculate).mockRejectedValueOnce(new Error('Database unavailable'));

    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 10, b: 5, operator: '+' })
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Database unavailable'
    });
  });

  it('handles non-Error thrown objects gracefully with 500 status', async () => {
    vi.mocked(calcService.calculate).mockRejectedValueOnce('string error');

    const req = new NextRequest('http://localhost:4000/api/calc', {
      method: 'POST',
      body: JSON.stringify({ a: 10, b: 5, operator: '+' })
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Unknown error'
    });
  });
});
