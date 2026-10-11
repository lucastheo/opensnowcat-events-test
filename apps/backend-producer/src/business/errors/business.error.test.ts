import { describe, it, expect } from 'vitest';
import {
  BusinessError,
  DivisionByZeroError,
  UnsupportedOperatorError,
  InvalidTimezoneError,
  InvalidDiceError,
  InvalidBatchCountError
} from './business.error';

describe('Business Errors', () => {
  describe('BusinessError base class', () => {
    it('instantiates with domain message and sets name properly', () => {
      const error = new BusinessError('Default bad request');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error.name).toBe('BusinessError');
      expect(error.message).toBe('Default bad request');
    });
  });

  describe('DivisionByZeroError', () => {
    it('instantiates with default message and inherits from BusinessError and Error', () => {
      const error = new DivisionByZeroError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error).toBeInstanceOf(DivisionByZeroError);
      expect(error.name).toBe('DivisionByZeroError');
      expect(error.message).toBe('Division by zero');
    });

    it('instantiates with custom message and inherits from BusinessError and Error', () => {
      const error = new DivisionByZeroError('Cannot divide operand by zero');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error).toBeInstanceOf(DivisionByZeroError);
      expect(error.name).toBe('DivisionByZeroError');
      expect(error.message).toBe('Cannot divide operand by zero');
    });
  });

  describe('UnsupportedOperatorError', () => {
    it('formats message with operator and inherits from BusinessError and Error', () => {
      const error = new UnsupportedOperatorError('%');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error).toBeInstanceOf(UnsupportedOperatorError);
      expect(error.name).toBe('UnsupportedOperatorError');
      expect(error.message).toBe('Unsupported operator: %');
    });
  });

  describe('InvalidTimezoneError', () => {
    it('formats message with timezone and inherits from BusinessError and Error', () => {
      const error = new InvalidTimezoneError('Atlantis/City');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error).toBeInstanceOf(InvalidTimezoneError);
      expect(error.name).toBe('InvalidTimezoneError');
      expect(error.message).toBe('Invalid timezone: Atlantis/City');
    });
  });

  describe('InvalidDiceError', () => {
    it('sets custom message and inherits from BusinessError and Error', () => {
      const error = new InvalidDiceError('Dice count must be between 1 and 10');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error).toBeInstanceOf(InvalidDiceError);
      expect(error.name).toBe('InvalidDiceError');
      expect(error.message).toBe('Dice count must be between 1 and 10');
    });
  });

  describe('InvalidBatchCountError', () => {
    it('sets custom message and inherits from BusinessError and Error', () => {
      const error = new InvalidBatchCountError('Batch count must be between 1 and 1000');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BusinessError);
      expect(error).toBeInstanceOf(InvalidBatchCountError);
      expect(error.name).toBe('InvalidBatchCountError');
      expect(error.message).toBe('Batch count must be between 1 and 1000');
    });
  });
});
