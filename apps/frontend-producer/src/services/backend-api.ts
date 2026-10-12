import { VITE_BACKEND_URL } from '@/config/env';

export class BackendApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number = 500, data?: unknown) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, BackendApiError.prototype);
  }
}

export type CalcOperator = '+' | '-' | '*' | '/';

export interface CalcResponse {
  result: number;
}

export interface TimestampResponse {
  timestamp_iso: string;
  formatted_local: string;
  timezone: string;
}

export interface DailyExcuseResponse {
  id: number;
  excuse: string;
}

export type DiceSides = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceResponse {
  rolls: number[];
  total: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${VITE_BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network request failed';
    throw new BackendApiError(`Network error: ${errorMsg}`, 0, err);
  }

  if (!response.ok) {
    let errorDetail: unknown;
    let errorMessage = `Backend API error (${response.status} ${response.statusText})`;

    try {
      errorDetail = await response.json();
      if (typeof errorDetail === 'object' && errorDetail !== null) {
        if ('error' in errorDetail && typeof (errorDetail as { error: unknown }).error === 'string') {
          errorMessage = (errorDetail as { error: string }).error;
        } else if ('message' in errorDetail && typeof (errorDetail as { message: unknown }).message === 'string') {
          errorMessage = (errorDetail as { message: string }).message;
        } else if ('errors' in errorDetail) {
          errorMessage = JSON.stringify((errorDetail as { errors: unknown }).errors);
        }
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch {
        // Fallback to status text
      }
    }

    throw new BackendApiError(errorMessage, response.status, errorDetail);
  }

  try {
    return (await response.json()) as T;
  } catch (err: unknown) {
    throw new BackendApiError('Failed to parse backend response as JSON', response.status, err);
  }
}

/**
 * Delegate calculation to Backend API (POST /api/calc).
 */
export async function calculate(
  a: number,
  b: number,
  operator: CalcOperator
): Promise<CalcResponse> {
  return request<CalcResponse>('/api/calc', {
    method: 'POST',
    body: JSON.stringify({ a, b, operator })
  });
}

/**
 * Delegate timestamp fetching to Backend API (POST /api/timestamp).
 */
export async function fetchTimestamp(timezone?: string): Promise<TimestampResponse> {
  const resolvedTz =
    timezone && timezone.trim()
      ? timezone.trim()
      : typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC';

  return request<TimestampResponse>('/api/timestamp', {
    method: 'POST',
    body: JSON.stringify({ timezone: resolvedTz })
  });
}

/**
 * Delegate daily standup excuse retrieval to Backend API (GET /api/daily-excuse).
 */
export async function getDailyExcuse(): Promise<DailyExcuseResponse> {
  return request<DailyExcuseResponse>('/api/daily-excuse', {
    method: 'GET'
  });
}

/**
 * Delegate dice rolling to Backend API (POST /api/dice).
 */
export async function rollDice(
  count: number = 2,
  sides: DiceSides | number | string = 'd6'
): Promise<DiceResponse> {
  const normalizedSides: DiceSides =
    typeof sides === 'number'
      ? (`d${sides}` as DiceSides)
      : typeof sides === 'string' && !sides.startsWith('d')
        ? (`d${sides}` as DiceSides)
        : (sides as DiceSides);

  return request<DiceResponse>('/api/dice', {
    method: 'POST',
    body: JSON.stringify({ count, sides: normalizedSides })
  });
}

export const backendApi = {
  calculate,
  fetchTimestamp,
  getDailyExcuse,
  rollDice
};
