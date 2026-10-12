import { describe, it, expect } from 'vitest';
import {
  ENV,
  VITE_BACKEND_URL,
  VITE_SIMPLE_COLLECTOR_URL,
  VITE_OPENSNOWCAT_URL
} from '@/config/env';

describe('Environment Configuration', () => {
  it('provides sensible defaults for all URLs', () => {
    expect(VITE_BACKEND_URL).toBeDefined();
    expect(VITE_SIMPLE_COLLECTOR_URL).toBeDefined();
    expect(VITE_OPENSNOWCAT_URL).toBeDefined();

    expect(ENV.backendUrl).toBe(VITE_BACKEND_URL);
    expect(ENV.simpleCollectorUrl).toBe(VITE_SIMPLE_COLLECTOR_URL);
    expect(ENV.openSnowcatUrl).toBe(VITE_OPENSNOWCAT_URL);
  });

  it('matches expected default port numbers', () => {
    expect(ENV.backendUrl).toContain('4000');
    expect(ENV.simpleCollectorUrl).toContain('5000');
    expect(ENV.openSnowcatUrl).toContain('8080');
  });
});
