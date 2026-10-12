import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { excuseService } from '@/business/services/excuse.service';
import { Excuse } from '@/business/domain/excuse';

vi.mock('@/business/services/excuse.service', () => ({
  excuseService: {
    getRandomExcuse: vi.fn()
  }
}));

describe('Daily Excuse Controller (GET /api/daily-excuse)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to excuseService and returns excuse payload (HTTP 200)', async () => {
    vi.mocked(excuseService.getRandomExcuse).mockResolvedValueOnce(
      new Excuse(3, "It works on my machine.")
    );

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      id: 3,
      excuse: "It works on my machine."
    });
    expect(excuseService.getRandomExcuse).toHaveBeenCalledTimes(1);
  });

  it('returns 500 Internal Server Error when excuseService throws an Error', async () => {
    vi.mocked(excuseService.getRandomExcuse).mockRejectedValueOnce(
      new Error('Failed to load excuse pool')
    );

    const res = await GET();
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Failed to load excuse pool'
    });
  });

  it('returns 500 Internal Server Error with Unknown error for non-Error exceptions', async () => {
    vi.mocked(excuseService.getRandomExcuse).mockRejectedValueOnce('unexpected string failure');

    const res = await GET();
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Unknown error'
    });
  });
});
