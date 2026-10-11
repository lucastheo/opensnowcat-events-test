import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { diceService } from '@/business/services/dice.service';
import { DiceRoll } from '@/business/domain/dice-roll';
import { InvalidDiceError } from '@/business/errors/business.error';

vi.mock('@/business/services/dice.service', () => ({
  diceService: {
    roll: vi.fn()
  }
}));

describe('Dice Controller (POST /api/dice)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 Bad Request when request body has invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: 'invalid-json{'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Invalid JSON' });
    expect(diceService.roll).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when count is out of bounds (count=0)', async () => {
    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 0, sides: 'd6' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('count');
    expect(diceService.roll).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when count is out of bounds (count=15)', async () => {
    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 15, sides: 'd6' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('count');
    expect(diceService.roll).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when sides is not a valid enum value (e.g. d1000)', async () => {
    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 2, sides: 'd1000' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('sides');
    expect(diceService.roll).not.toHaveBeenCalled();
  });

  it('delegates valid request to diceService and returns ResponseSchema (HTTP 200)', async () => {
    vi.mocked(diceService.roll).mockResolvedValueOnce(
      new DiceRoll([3, 4], 7, 'd6', 2)
    );

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 2, sides: 'd6' })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({ rolls: [3, 4], total: 7 });
    expect(diceService.roll).toHaveBeenCalledWith({ count: 2, sides: 'd6' });
  });

  it('applies defaults (count=2, sides="d6") when body is empty JSON (HTTP 200)', async () => {
    vi.mocked(diceService.roll).mockResolvedValueOnce(
      new DiceRoll([1, 6], 7, 'd6', 2)
    );

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({ rolls: [1, 6], total: 7 });
    expect(diceService.roll).toHaveBeenCalledWith({ count: 2, sides: 'd6' });
  });

  it('applies defaults when request body is omitted (HTTP 200)', async () => {
    vi.mocked(diceService.roll).mockResolvedValueOnce(
      new DiceRoll([5, 5], 10, 'd6', 2)
    );

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST'
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({ rolls: [5, 5], total: 10 });
    expect(diceService.roll).toHaveBeenCalledWith({ count: 2, sides: 'd6' });
  });

  it('returns 400 Bad Request when business service throws bounds error', async () => {
    vi.mocked(diceService.roll).mockRejectedValueOnce(
      new InvalidDiceError('Dice count must be between 1 and 10')
    );

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 2, sides: 'd6' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Dice count must be between 1 and 10' });
  });

  it('returns 400 Bad Request when business service throws unsupported sides error', async () => {
    vi.mocked(diceService.roll).mockRejectedValueOnce(
      new InvalidDiceError('Unsupported dice sides: d999')
    );

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 2, sides: 'd6' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Unsupported dice sides: d999' });
  });

  it('returns 500 Internal Server Error when unexpected error occurs', async () => {
    vi.mocked(diceService.roll).mockRejectedValueOnce(
      new Error('Hardware RNG failure')
    );

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 2, sides: 'd6' })
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Hardware RNG failure'
    });
  });

  it('handles non-Error thrown objects gracefully with 500 status', async () => {
    vi.mocked(diceService.roll).mockRejectedValueOnce('random failure');

    const req = new NextRequest('http://localhost:4000/api/dice', {
      method: 'POST',
      body: JSON.stringify({ count: 2, sides: 'd6' })
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
