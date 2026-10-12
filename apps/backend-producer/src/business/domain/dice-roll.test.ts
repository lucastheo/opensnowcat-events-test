import { describe, it, expect } from 'vitest';
import { DiceRoll, getSidesNumber, type DiceSides } from './dice-roll';

describe('Dice Roll Domain Entity & Helpers', () => {
  describe('getSidesNumber', () => {
    it('returns the correct numeric side value for each valid DiceSides type', () => {
      const expectations: Record<DiceSides, number> = {
        d4: 4,
        d6: 6,
        d8: 8,
        d10: 10,
        d12: 12,
        d20: 20,
        d100: 100
      };

      (Object.keys(expectations) as DiceSides[]).forEach((dice) => {
        expect(getSidesNumber(dice)).toBe(expectations[dice]);
      });
    });

    it('returns undefined when an invalid dice type is provided', () => {
      expect(getSidesNumber('d1000' as unknown as DiceSides)).toBeUndefined();
      expect(getSidesNumber('' as unknown as DiceSides)).toBeUndefined();
    });
  });

  describe('DiceRoll Class Instantiation & Properties', () => {
    it('instantiates correctly with defaults for rolledAt', () => {
      const before = new Date();
      const diceRoll = new DiceRoll([3, 5], 8, 'd6', 2);
      const after = new Date();

      expect(diceRoll.rolls).toEqual([3, 5]);
      expect(diceRoll.total).toBe(8);
      expect(diceRoll.sides).toBe('d6');
      expect(diceRoll.count).toBe(2);
      expect(diceRoll.rolledAt).toBeInstanceOf(Date);
      expect(diceRoll.rolledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(diceRoll.rolledAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('accepts an explicit rolledAt Date', () => {
      const customDate = new Date('2026-10-11T12:00:00.000Z');
      const diceRoll = new DiceRoll([20], 20, 'd20', 1, customDate);

      expect(diceRoll.rolls).toEqual([20]);
      expect(diceRoll.total).toBe(20);
      expect(diceRoll.sides).toBe('d20');
      expect(diceRoll.count).toBe(1);
      expect(diceRoll.rolledAt).toBe(customDate);
      expect(diceRoll.rolledAt.toISOString()).toBe('2026-10-11T12:00:00.000Z');
    });

    it('handles multi-die roll results correctly', () => {
      const rolls = [12, 10, 8, 15, 20];
      const total = rolls.reduce((acc, curr) => acc + curr, 0);
      const diceRoll = new DiceRoll(rolls, total, 'd20', 5);

      expect(diceRoll.rolls).toHaveLength(5);
      expect(diceRoll.total).toBe(65);
      expect(diceRoll.sides).toBe('d20');
      expect(diceRoll.count).toBe(5);
    });
  });
});
