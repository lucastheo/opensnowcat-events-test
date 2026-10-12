export interface ApiControllerOptions {
  backendUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface EndpointResult<T = unknown> {
  success: boolean;
  durationMs: number;
  statusCode?: number;
  data?: T;
  error?: string;
}

export type CalcOperator = '+' | '-' | '*' | '/';
export type DiceSides = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface CalcResponse {
  result: number;
}

export interface TimestampResponse {
  timestamp_iso: string;
  formatted_local: string;
  timezone: string;
}

export interface ExcuseResponse {
  id: number;
  excuse: string;
}

export interface DiceResponse {
  rolls: number[];
  total: number;
}

export interface ExecuteAllResult {
  success: boolean;
  durationMs: number;
  results: Record<string, EndpointResult>;
  errors: string[];
}

export class ApiController {
  private readonly backendUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiControllerOptions) {
    this.backendUrl = options.backendUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<EndpointResult<T>> {
    const url = `${this.backendUrl}${endpoint}`;
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await this.fetchFn(url, {
        ...init,
        signal: init.signal ?? controller.signal,
        headers: {
          Accept: 'application/json',
          ...init.headers,
        },
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      const durationMs = Math.round(performance.now() - startTime);

      let responseBody: unknown;
      const text = await response.text();
      if (text) {
        try {
          responseBody = JSON.parse(text);
        } catch {
          responseBody = text;
        }
      }

      if (response.status !== 200) {
        const errorMsg =
          typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody
            ? String((responseBody as { error: unknown }).error)
            : `Expected HTTP 200, received HTTP ${response.status} ${response.statusText}`;

        return {
          success: false,
          durationMs,
          statusCode: response.status,
          error: errorMsg,
        };
      }

      return {
        success: true,
        durationMs,
        statusCode: response.status,
        data: responseBody as T,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `Request timed out after ${this.timeoutMs}ms`
            : err.message
          : String(err);

      return {
        success: false,
        durationMs,
        error: errorMessage,
      };
    }
  }

  async executeCalc(
    a: number = 10,
    b: number = 5,
    operator: CalcOperator = '+'
  ): Promise<EndpointResult<CalcResponse>> {
    const res = await this.request<CalcResponse>('/api/calc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a, b, operator }),
    });

    if (res.success && res.data) {
      if (typeof res.data.result !== 'number' || isNaN(res.data.result)) {
        return {
          ...res,
          success: false,
          error: 'Invalid payload signature: result must be a valid number',
        };
      }
    }
    return res;
  }

  async executeTimestamp(
    timezone?: string
  ): Promise<EndpointResult<TimestampResponse>> {
    const resolvedTz =
      timezone ??
      (typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC') ??
      'UTC';

    const res = await this.request<TimestampResponse>('/api/timestamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: resolvedTz }),
    });

    if (res.success && res.data) {
      if (
        typeof res.data.timestamp_iso !== 'string' ||
        typeof res.data.timezone !== 'string'
      ) {
        return {
          ...res,
          success: false,
          error: 'Invalid payload signature: timestamp_iso and timezone must be strings',
        };
      }
    }
    return res;
  }

  async executeExcuse(): Promise<EndpointResult<ExcuseResponse>> {
    const res = await this.request<ExcuseResponse>('/api/daily-excuse', {
      method: 'GET',
    });

    if (res.success && res.data) {
      if (typeof res.data.id !== 'number' || typeof res.data.excuse !== 'string') {
        return {
          ...res,
          success: false,
          error: 'Invalid payload signature: id must be a number and excuse a string',
        };
      }
    }
    return res;
  }

  async executeDice(
    count: number = 2,
    sides: DiceSides = 'd6'
  ): Promise<EndpointResult<DiceResponse>> {
    const res = await this.request<DiceResponse>('/api/dice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, sides }),
    });

    if (res.success && res.data) {
      if (!Array.isArray(res.data.rolls) || typeof res.data.total !== 'number') {
        return {
          ...res,
          success: false,
          error: 'Invalid payload signature: rolls must be an array and total a number',
        };
      }
    }
    return res;
  }

  async executeAll(): Promise<ExecuteAllResult> {
    const startTime = performance.now();

    const [calc, timestamp, excuse, dice] = await Promise.all([
      this.executeCalc(),
      this.executeTimestamp(),
      this.executeExcuse(),
      this.executeDice(),
    ]);

    const durationMs = Math.round(performance.now() - startTime);

    const errors: string[] = [];
    if (!calc.success && calc.error) errors.push(`Calc error: ${calc.error}`);
    if (!timestamp.success && timestamp.error) errors.push(`Timestamp error: ${timestamp.error}`);
    if (!excuse.success && excuse.error) errors.push(`Excuse error: ${excuse.error}`);
    if (!dice.success && dice.error) errors.push(`Dice error: ${dice.error}`);

    const results: Record<string, EndpointResult> = {
      calc,
      timestamp,
      excuse,
      dice,
    };

    return {
      success: errors.length === 0,
      durationMs,
      results,
      errors,
    };
  }
}
