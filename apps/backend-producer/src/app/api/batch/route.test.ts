import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { batchService } from '@/business/services/batch.service';

vi.mock('@/business/services/batch.service', () => ({
  batchService: {
    emitBatch: vi.fn()
  }
}));

describe('Batch Controller (POST /api/batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 Bad Request when request body has invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: 'invalid-json{'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Invalid JSON' });
    expect(batchService.emitBatch).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when count is below minimum (count=0)', async () => {
    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 0 })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('count');
    expect(batchService.emitBatch).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when count exceeds maximum (count=2000)', async () => {
    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 2000 })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('count');
    expect(batchService.emitBatch).not.toHaveBeenCalled();
  });

  it('returns 400 Bad Request when count is not an integer', async () => {
    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 12.5 })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.errors).toHaveProperty('count');
    expect(batchService.emitBatch).not.toHaveBeenCalled();
  });

  it('delegates valid count to batchService and returns ResponseSchema (HTTP 200)', async () => {
    vi.mocked(batchService.emitBatch).mockResolvedValueOnce({
      status: 'completed',
      events_emitted: 50
    });

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 50 })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      status: 'completed',
      events_emitted: 50
    });
    expect(batchService.emitBatch).toHaveBeenCalledWith({ count: 50 });
  });

  it('applies default count (50) when body is empty JSON (HTTP 200)', async () => {
    vi.mocked(batchService.emitBatch).mockResolvedValueOnce({
      status: 'completed',
      events_emitted: 50
    });

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      status: 'completed',
      events_emitted: 50
    });
    expect(batchService.emitBatch).toHaveBeenCalledWith({ count: 50 });
  });

  it('applies default count (50) when request body is omitted (HTTP 200)', async () => {
    vi.mocked(batchService.emitBatch).mockResolvedValueOnce({
      status: 'completed',
      events_emitted: 50
    });

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST'
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      status: 'completed',
      events_emitted: 50
    });
    expect(batchService.emitBatch).toHaveBeenCalledWith({ count: 50 });
  });

  it('returns 400 Bad Request when business service throws bounds error', async () => {
    vi.mocked(batchService.emitBatch).mockRejectedValueOnce(
      new Error('Batch count must be between 1 and 1000')
    );

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 50 })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toEqual({ error: 'Batch count must be between 1 and 1000' });
  });

  it('returns 500 Internal Server Error when unexpected error occurs', async () => {
    vi.mocked(batchService.emitBatch).mockRejectedValueOnce(
      new Error('Network batch failure')
    );

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 50 })
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Network batch failure'
    });
  });

  it('handles non-Error thrown objects gracefully with 500 status', async () => {
    vi.mocked(batchService.emitBatch).mockRejectedValueOnce('raw string error');

    const req = new NextRequest('http://localhost:4000/api/batch', {
      method: 'POST',
      body: JSON.stringify({ count: 50 })
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
