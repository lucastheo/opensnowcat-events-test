import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalcService, calcService } from './calc.service';
import { Calculation } from '@/business/domain/calculation';
import {
  DivisionByZeroError,
  UnsupportedOperatorError
} from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

vi.mock('@/business/tracking.dispatcher', () => ({
  dispatchDualEmission: vi.fn().mockResolvedValue({
    eventId: 'mocked-event-id',
    timestamp: '2026-10-11T12:00:00.000Z'
  })
}));

describe('CalcService', () => {
  let service: CalcService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CalcService();
  });

  describe('Arithmetic Operations & Result Calculation', () => {
    it('computes addition (+) correctly and dispatches tracking', async () => {
      const result = await service.calculate({ a: 12, b: 4, operator: '+' });

      expect(result).toBeInstanceOf(Calculation);
      expect(result.a).toBe(12);
      expect(result.b).toBe(4);
      expect(result.operator).toBe('+');
      expect(result.result).toBe(16);

      expect(dispatchDualEmission).toHaveBeenCalledTimes(1);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'backend_service',
          action: 'calculate',
          label: '+',
          property: '12+4',
          value: 16,
          eventType: 'backend_api',
          timestamp: expect.any(String)
        })
      );
    });

    it('computes subtraction (-) correctly and dispatches tracking', async () => {
      const result = await service.calculate({ a: 10, b: 7, operator: '-' });

      expect(result.result).toBe(3);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          label: '-',
          property: '10-7',
          value: 3
        })
      );
    });

    it('computes multiplication (*) correctly and dispatches tracking', async () => {
      const result = await service.calculate({ a: 6, b: 7, operator: '*' });

      expect(result.result).toBe(42);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          label: '*',
          property: '6*7',
          value: 42
        })
      );
    });

    it('computes division (/) correctly and dispatches tracking', async () => {
      const result = await service.calculate({ a: 20, b: 4, operator: '/' });

      expect(result.result).toBe(5);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          label: '/',
          property: '20/4',
          value: 5
        })
      );
    });

    it('handles negative numbers and decimal values', async () => {
      const result = await service.calculate({ a: -10.5, b: 2.5, operator: '+' });

      expect(result.result).toBe(-8);
      expect(dispatchDualEmission).toHaveBeenCalledWith(
        expect.objectContaining({
          property: '-10.5+2.5',
          value: -8
        })
      );
    });
  });

  describe('Error Handling & Invariants', () => {
    it('throws error when dividing by zero (b === 0 && operator === "/")', async () => {
      await expect(service.calculate({ a: 10, b: 0, operator: '/' })).rejects.toThrow(DivisionByZeroError);
      await expect(service.calculate({ a: 10, b: 0, operator: '/' })).rejects.toThrow('Division by zero');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('throws error on unsupported operator', async () => {
      await expect(service.calculate({ a: 10, b: 2, operator: '%' })).rejects.toThrow(UnsupportedOperatorError);
      await expect(service.calculate({ a: 10, b: 2, operator: '%' })).rejects.toThrow('Unsupported operator: %');
      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });

    it('never calls external tracking dispatch if an error is thrown', async () => {
      await expect(service.calculate({ a: 5, b: 0, operator: '/' })).rejects.toThrow(DivisionByZeroError);
      await expect(service.calculate({ a: 5, b: 2, operator: '^' })).rejects.toThrow(UnsupportedOperatorError);

      expect(dispatchDualEmission).not.toHaveBeenCalled();
    });
  });

  describe('Singleton instance', () => {
    it('exports a default singleton calcService instance', () => {
      expect(calcService).toBeInstanceOf(CalcService);
    });
  });
});
