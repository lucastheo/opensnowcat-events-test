import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiceService, diceService } from './dice.service';
import { DiceRoll, type DiceSides } from '@/business/domain/dice-roll';
import { InvalidDiceError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

vi.mock('@/business/tracking.dispatcher', () => ({
  dispatchDualEmission: vi.fn().mockResolvedValue({
    eventId: 'mocked-event-id',
    timestamp: '2026-10-11T12:00:00.000Z'
  })
}));

describe('DiceService', () => {
  let service: DiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DiceService();
  });

  describe('Rolling Dice Logic & Calculations', () => {
    it('rolls with default parameters (count=2, sides="d6")', async () => {
      const result = await service.roll();

      expect(result).toBeInstanceOf(DiceRoll);
      expect(result.count).toBe(2);
      expect(result.sides).toBe('d6');
      expect(result.rolls).toHaveLength(2);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      });
      expect(result.total).toBe(result.rolls[0] + result.rolls[1]);

      expect(dispatchDualEmission).toHaveBeenCalledTimes(1);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'backend_service',
          action: 'dice_roll',
          label: 'd6',
          property: result.rolls.join(','),
          value: result.total,
          eventType: 'backend_api',
          eventId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          timestamp: expect.any(String)
        })
      );
    });

    it('rolls with custom parameters (count=5, sides="d20")', async () => {
      const result = await service.roll({ count: 5, sides: 'd20' });

      expect(result.count).toBe(5);
      expect(result.sides).toBe('d20');
      expect(result.rolls).toHaveLength(5);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(20);
      });
      const expectedTotal = result.rolls.reduce((sum, val) => sum + val, 0);
      expect(result.total).toBe(expectedTotal);

      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'd20',
          property: result.rolls.join(','),
          value: expectedTotal
        })
      );
    });

    it('rolls with high-sided dice (sides="d100")', async () => {
      const result = await service.roll({ count: 3, sides: 'd100' });

      expect(result.count).toBe(3);
      expect(result.sides).toBe('d100');
      expect(result.rolls).toHaveLength(3);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(100);
      });
      expect(result.total).toBe(result.rolls.reduce((a, b) => a + b, 0));
    });
  });

  describe('Validation & Error Handling', () => {
    it('throws error when count is less than 1', async () => {
      await expect(service.roll({ count: 0 })).rejects.toThrow(InvalidDiceError);
      await expect(service.roll({ count: 0 })).rejects.toThrow('Dice count must be between 1 and 10');
      await expect(service.roll({ count: -3 })).rejects.toThrow(InvalidDiceError);
      await expect(service.roll({ count: -3 })).rejects.toThrow('Dice count must be between 1 and 10');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error when count is greater than 10', async () => {
      await expect(service.roll({ count: 11 })).rejects.toThrow(InvalidDiceError);
      await expect(service.roll({ count: 11 })).rejects.toThrow('Dice count must be between 1 and 10');
      await expect(service.roll({ count: 100 })).rejects.toThrow(InvalidDiceError);
      await expect(service.roll({ count: 100 })).rejects.toThrow('Dice count must be between 1 and 10');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error when count is not an integer', async () => {
      await expect(service.roll({ count: 2.5 })).rejects.toThrow(InvalidDiceError);
      await expect(service.roll({ count: 2.5 })).rejects.toThrow('Dice count must be between 1 and 10');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error when sides is unsupported', async () => {
      // @ts-expect-error testing invalid sides runtime validation
      await expect(service.roll({ sides: 'd1000' })).rejects.toThrow(InvalidDiceError);
      // @ts-expect-error testing invalid sides runtime validation
      await expect(service.roll({ sides: 'd1000' })).rejects.toThrow('Unsupported dice sides: d1000');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Instance', () => {
    it('exports a default singleton diceService instance', () => {
      expect(diceService).toBeInstanceOf(DiceService);
    });
  });
});
