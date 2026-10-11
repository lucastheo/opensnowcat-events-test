import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { timestampService } from '@/business/services/timestamp.service';
import { TimeLocation } from '@/business/domain/timestamp-info';
import { InvalidTimezoneError } from '@/business/errors/business.error';

vi.mock('@/business/services/timestamp.service', () => ({
  timestampService: {
    getTimestamp: vi.fn()
  }
}));

describe('Timestamp Controller (POST /api/timestamp)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 Bad Request when request body has invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: 'invalid-json{'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Invalid JSON' });
    expect(timestampService.getTimestamp).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when timezone is not a string', async () => {
    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: JSON.stringify({ timezone: 12345 })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('timezone');
    expect(timestampService.getTimestamp).not.toHaveBeenCalled();
  });

  it('delegates valid timezone to Business Service and returns ResponseSchema (HTTP 200)', async () => {
    vi.mocked(timestampService.getTimestamp).mockResolvedValueOnce(
      new TimeLocation(
        '2026-10-11T19:00:00.000Z',
        '10/11/2026, 4:00:00 PM',
        'America/Sao_Paulo'
      )
    );

    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: JSON.stringify({ timezone: 'America/Sao_Paulo' })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      timestamp_iso: '2026-10-11T19:00:00.000Z',
      formatted_local: '10/11/2026, 4:00:00 PM',
      timezone: 'America/Sao_Paulo'
    });
    expect(timestampService.getTimestamp).toHaveBeenCalledWith({
      timezone: 'America/Sao_Paulo'
    });
  });

  it('handles empty body by defaulting timezone to UTC (HTTP 200)', async () => {
    vi.mocked(timestampService.getTimestamp).mockResolvedValueOnce(
      new TimeLocation(
        '2026-10-11T19:00:00.000Z',
        '10/11/2026, 7:00:00 PM',
        'UTC'
      )
    );

    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      timestamp_iso: '2026-10-11T19:00:00.000Z',
      formatted_local: '10/11/2026, 7:00:00 PM',
      timezone: 'UTC'
    });
    expect(timestampService.getTimestamp).toHaveBeenCalledWith({
      timezone: 'UTC'
    });
  });

  it('handles empty/whitespace body text by defaulting timezone to UTC (HTTP 200)', async () => {
    vi.mocked(timestampService.getTimestamp).mockResolvedValueOnce(
      new TimeLocation(
        '2026-10-11T19:00:00.000Z',
        '10/11/2026, 7:00:00 PM',
        'UTC'
      )
    );

    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST'
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      timestamp_iso: '2026-10-11T19:00:00.000Z',
      formatted_local: '10/11/2026, 7:00:00 PM',
      timezone: 'UTC'
    });
    expect(timestampService.getTimestamp).toHaveBeenCalledWith({
      timezone: 'UTC'
    });
  });

  it('returns 400 Bad Request when business service throws Invalid timezone error', async () => {
    vi.mocked(timestampService.getTimestamp).mockRejectedValueOnce(
      new InvalidTimezoneError('Atlantis/City')
    );

    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: JSON.stringify({ timezone: 'Atlantis/City' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Invalid timezone: Atlantis/City' });
  });

  it('returns 500 Internal Server Error when unexpected error occurs', async () => {
    vi.mocked(timestampService.getTimestamp).mockRejectedValueOnce(
      new Error('Internal failure')
    );

    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: JSON.stringify({ timezone: 'UTC' })
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Internal failure'
    });
  });

  it('handles non-Error thrown objects gracefully with 500 status', async () => {
    vi.mocked(timestampService.getTimestamp).mockRejectedValueOnce('string error');

    const req = new NextRequest('http://localhost:4000/api/timestamp', {
      method: 'POST',
      body: JSON.stringify({ timezone: 'UTC' })
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
