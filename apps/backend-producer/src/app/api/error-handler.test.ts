import { describe, it, expect } from 'vitest';
import { handleRouteError } from './error-handler';
import {
  BusinessError,
  DivisionByZeroError,
  InvalidTimezoneError,
  InvalidDiceError,
  InvalidBatchCountError,
  UnsupportedOperatorError
} from '@/business/errors/business.error';

describe('handleRouteError', () => {
  it('handles BusinessError base class instance with default status 400', async () => {
    const error = new BusinessError('Custom business constraint violated');
    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Custom business constraint violated' });
  });

  it('handles BusinessError base class instance with custom status code', async () => {
    const error = new BusinessError('Resource conflict', 409);
    const response = handleRouteError(error);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data).toEqual({ error: 'Resource conflict' });
  });

  it('handles DivisionByZeroError subclass (HTTP 400)', async () => {
    const error = new DivisionByZeroError();
    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Division by zero' });
  });

  it('handles UnsupportedOperatorError subclass (HTTP 400)', async () => {
    const error = new UnsupportedOperatorError('^');
    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unsupported operator: ^' });
  });

  it('handles InvalidTimezoneError subclass (HTTP 400)', async () => {
    const error = new InvalidTimezoneError('Mars/Olympus');
    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Invalid timezone: Mars/Olympus' });
  });

  it('handles InvalidDiceError subclass (HTTP 400)', async () => {
    const error = new InvalidDiceError('Dice count must be between 1 and 10');
    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Dice count must be between 1 and 10' });
  });

  it('handles InvalidBatchCountError subclass (HTTP 400)', async () => {
    const error = new InvalidBatchCountError('Batch count must be between 1 and 1000');
    const response = handleRouteError(error);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Batch count must be between 1 and 1000' });
  });

  it('handles standard Error instance returning HTTP 500', async () => {
    const error = new Error('Database connection failed');
    const response = handleRouteError(error);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Database connection failed'
    });
  });

  it('handles non-Error string values returning HTTP 500 with "Unknown error"', async () => {
    const response = handleRouteError('Something completely unexpected occurred');

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Unknown error'
    });
  });

  it('handles non-Error object values returning HTTP 500 with "Unknown error"', async () => {
    const response = handleRouteError({ reason: 'socket closed' });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Unknown error'
    });
  });
});
