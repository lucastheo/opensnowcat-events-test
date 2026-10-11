import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExcuseService, excuseService } from './excuse.service';
import { Excuse, DEVELOPER_EXCUSES } from '@/business/domain/excuse';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

vi.mock('@/business/tracking.dispatcher', () => ({
  dispatchDualEmission: vi.fn().mockResolvedValue({
    eventId: 'mocked-event-id',
    timestamp: '2026-10-11T12:00:00.000Z'
  })
}));

describe('ExcuseService', () => {
  let service: ExcuseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExcuseService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRandomExcuse', () => {
    it('returns an Excuse domain entity with valid id and text from pool', async () => {
      const excuse = await service.getRandomExcuse();

      expect(excuse).toBeInstanceOf(Excuse);
      expect(typeof excuse.id).toBe('number');
      expect(excuse.id).toBeGreaterThanOrEqual(1);
      expect(excuse.id).toBeLessThanOrEqual(DEVELOPER_EXCUSES.length);
      expect(typeof excuse.excuse).toBe('string');
      expect(excuse.excuse.length).toBeGreaterThan(0);
      expect(DEVELOPER_EXCUSES).toContain(excuse.excuse);
      expect(DEVELOPER_EXCUSES[excuse.id - 1]).toBe(excuse.excuse);
    });

    it('dispatches dual tracking with expected metadata', async () => {
      const excuse = await service.getRandomExcuse();

      expect(dispatchDualEmission).toHaveBeenCalledTimes(1);
      expect(dispatchDualEmission).toHaveBeenCalledWith({
        category: 'backend_service',
        action: 'daily_excuse',
        label: excuse.excuse,
        value: excuse.id,
        eventId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        timestamp: expect.any(String),
        eventType: 'backend_api'
      });
    });

    it('selects first excuse when Math.random returns 0', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const excuse = await service.getRandomExcuse();

      expect(excuse.id).toBe(1);
      expect(excuse.excuse).toBe(DEVELOPER_EXCUSES[0]);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          label: DEVELOPER_EXCUSES[0],
          value: 1
        })
      );
    });

    it('selects last excuse when Math.random is close to 1', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999999);

      const lastIndex = DEVELOPER_EXCUSES.length - 1;
      const excuse = await service.getRandomExcuse();

      expect(excuse.id).toBe(DEVELOPER_EXCUSES.length);
      expect(excuse.excuse).toBe(DEVELOPER_EXCUSES[lastIndex]);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          label: DEVELOPER_EXCUSES[lastIndex],
          value: DEVELOPER_EXCUSES.length
        })
      );
    });
  });

  describe('Singleton Instance', () => {
    it('exports a default singleton excuseService instance', () => {
      expect(excuseService).toBeInstanceOf(ExcuseService);
    });
  });
});
