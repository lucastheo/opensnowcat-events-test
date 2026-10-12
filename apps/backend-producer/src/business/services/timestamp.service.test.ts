import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimestampService, timestampService } from './timestamp.service';
import { TimeLocation } from '@/business/domain/timestamp-info';
import { InvalidTimezoneError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

vi.mock('@/business/tracking.dispatcher', () => ({
  dispatchDualEmission: vi.fn().mockResolvedValue({
    eventId: 'mocked-event-id',
    timestamp: '2026-10-11T12:00:00.000Z'
  })
}));

describe('TimestampService', () => {
  let service: TimestampService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TimestampService();
  });

  describe('Timezone formatting & Retrieval', () => {
    it('defaults to UTC timezone when none is specified', async () => {
      const result = await service.getTimestamp();

      expect(result).toBeInstanceOf(TimeLocation);
      expect(result.timezone).toBe('UTC');
      expect(result.formattedLocal).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/);
      expect(new Date(result.timestampIso).toISOString()).toBe(result.timestampIso);

      expect(dispatchDualEmission).toHaveBeenCalledTimes(1);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'backend_service',
          action: 'timestamp',
          label: 'UTC',
          property: result.formattedLocal,
          eventType: 'backend_api',
          timestamp: result.timestampIso
        })
      );
    });

    it('formats timestamp for custom valid timezone (e.g. America/Sao_Paulo)', async () => {
      const result = await service.getTimestamp({ timezone: 'America/Sao_Paulo' });

      expect(result.timezone).toBe('America/Sao_Paulo');
      expect(result.formattedLocal).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/);

      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'backend_service',
          action: 'timestamp',
          label: 'America/Sao_Paulo',
          property: result.formattedLocal,
          eventType: 'backend_api'
        })
      );
    });

    it('formats timestamp correctly across diverse timezones (e.g. Asia/Tokyo, Europe/London)', async () => {
      const tokyo = await service.getTimestamp({ timezone: 'Asia/Tokyo' });
      expect(tokyo.timezone).toBe('Asia/Tokyo');
      expect(tokyo.formattedLocal).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/);

      const london = await service.getTimestamp({ timezone: 'Europe/London' });
      expect(london.timezone).toBe('Europe/London');
      expect(london.formattedLocal).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('Error Handling', () => {
    it('throws error on invalid timezone string and suppresses tracking', async () => {
      await expect(service.getTimestamp({ timezone: 'Mars/Curiosity' })).rejects.toThrow(InvalidTimezoneError);
      await expect(service.getTimestamp({ timezone: 'Mars/Curiosity' })).rejects.toThrow('Invalid timezone: Mars/Curiosity');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error for malformed timezone identifiers', async () => {
      await expect(service.getTimestamp({ timezone: 'Not/A_Real_Timezone' })).rejects.toThrow(InvalidTimezoneError);
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Instance', () => {
    it('exports a default singleton timestampService instance', () => {
      expect(timestampService).toBeInstanceOf(TimestampService);
    });
  });
});
