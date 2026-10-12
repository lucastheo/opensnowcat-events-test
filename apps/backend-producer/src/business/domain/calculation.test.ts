import { describe, it, expect } from 'vitest';
import { Calculation } from './calculation';

describe('Calculation Domain Entity', () => {
  describe('Instantiation & Properties', () => {
    it('instantiates correctly with required properties and defaults calculatedAt to current Date', () => {
      const before = new Date();
      const calc = new Calculation(10, 5, '+', 15);
      const after = new Date();

      expect(calc.a).toBe(10);
      expect(calc.b).toBe(5);
      expect(calc.operator).toBe('+');
      expect(calc.result).toBe(15);
      expect(calc.calculatedAt).toBeInstanceOf(Date);
      expect(calc.calculatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(calc.calculatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('accepts an explicit calculatedAt Date', () => {
      const customDate = new Date('2026-10-11T10:00:00.000Z');
      const calc = new Calculation(20, 4, '/', 5, customDate);

      expect(calc.calculatedAt).toBe(customDate);
      expect(calc.calculatedAt.toISOString()).toBe('2026-10-11T10:00:00.000Z');
    });

    it('handles negative numbers and decimals', () => {
      const calc = new Calculation(-12.5, 2.5, '*', -31.25);

      expect(calc.a).toBe(-12.5);
      expect(calc.b).toBe(2.5);
      expect(calc.operator).toBe('*');
      expect(calc.result).toBe(-31.25);
    });
  });

  describe('isDivision helper', () => {
    it('returns true when operator is "/"', () => {
      const calc = new Calculation(10, 2, '/', 5);
      expect(calc.isDivision()).toBe(true);
    });

    it('returns false when operator is not "/"', () => {
      expect(new Calculation(10, 2, '+', 12).isDivision()).toBe(false);
      expect(new Calculation(10, 2, '-', 8).isDivision()).toBe(false);
      expect(new Calculation(10, 2, '*', 20).isDivision()).toBe(false);
      expect(new Calculation(10, 2, '%', 0).isDivision()).toBe(false);
    });
  });
});
