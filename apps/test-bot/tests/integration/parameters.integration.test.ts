import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Runner, type RunnerOptions } from '../../src/runner.js';
import { Logger } from '../../src/utils/logger.js';
import { startMockServers, type MockServers } from './helpers/mock-servers.js';

describe('Test Bot parameter integration tests', { timeout: 60000 }, () => {
  let mock: MockServers;

  beforeAll(async () => {
    mock = await startMockServers();
  });

  afterAll(async () => {
    await mock.close();
  });

  beforeEach(() => {
    mock.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const run = (opts: Partial<RunnerOptions>) =>
    new Runner({
      targetUrls: {
        frontendUrl: mock.frontendUrl,
        backendUrl: mock.backendUrl,
      },
      mode: 'backend',
      iterations: 1,
      concurrency: 1,
      delayMs: 0,
      closeDelayMs: 0,
      logger: new Logger({ silent: true }),
      ...opts,
    });

  describe('--iterations', () => {
    it.each([1, 3, 7])('executes exactly %i iterations and hits each endpoint that many times', async (n) => {
      const summary = await run({ iterations: n }).start();

      expect(summary.total).toBe(n);
      expect(summary.completed).toBe(n);
      expect(mock.stats.calc).toBe(n);
      expect(mock.stats.timestamp).toBe(n);
      expect(mock.stats.excuse).toBe(n);
      expect(mock.stats.dice).toBe(n);
    });

    it('executes nothing when iterations is 0', async () => {
      const summary = await run({ iterations: 0 }).start();

      expect(summary.total).toBe(0);
      expect(mock.stats.calc).toBe(0);
    });
  });

  describe('--concurrency', () => {
    it('runs iterations strictly one at a time with concurrency=1', async () => {
      mock.setCalcLatencyMs(80);
      await run({ iterations: 4, concurrency: 1 }).start();

      expect(mock.stats.calc).toBe(4);
      expect(mock.stats.maxInFlightCalc).toBe(1);
    });

    it('runs iterations in parallel up to the concurrency limit', async () => {
      mock.setCalcLatencyMs(150);
      await run({ iterations: 6, concurrency: 3 }).start();

      expect(mock.stats.calc).toBe(6);
      expect(mock.stats.maxInFlightCalc).toBe(3);
    });

    it('caps parallelism at the number of iterations', async () => {
      mock.setCalcLatencyMs(150);
      await run({ iterations: 2, concurrency: 10 }).start();

      expect(mock.stats.calc).toBe(2);
      expect(mock.stats.maxInFlightCalc).toBe(2);
    });

    it('finishes faster with higher concurrency', async () => {
      mock.setCalcLatencyMs(100);

      const t0 = performance.now();
      await run({ iterations: 4, concurrency: 1 }).start();
      const serial = performance.now() - t0;

      mock.reset();
      mock.setCalcLatencyMs(100);
      const t1 = performance.now();
      await run({ iterations: 4, concurrency: 4 }).start();
      const parallel = performance.now() - t1;

      expect(serial).toBeGreaterThanOrEqual(400);
      expect(parallel).toBeLessThan(serial);
    }, 30000);
  });

  describe('--delay-ms', () => {
    it('pauses delayMs after each iteration', async () => {
      const t0 = performance.now();
      await run({ iterations: 3, delayMs: 200 }).start();
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeGreaterThanOrEqual(3 * 200 - 30);
    });

    it('does not pause when delayMs is 0', async () => {
      const t0 = performance.now();
      await run({ iterations: 3, delayMs: 0 }).start();
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('--mode', () => {
    it('"backend" calls only the API and never loads the frontend', async () => {
      await run({ mode: 'backend', iterations: 2 }).start();

      expect(mock.stats.frontendPageLoads).toBe(0);
      expect(mock.stats.calc).toBe(2);
    });

    it('"frontend" drives the browser (page loaded, API reached through the UI)', async () => {
      const summary = await run({ mode: 'frontend', iterations: 1, headless: true }).start();

      expect(summary.failed).toBe(0);
      expect(mock.stats.frontendPageLoads).toBeGreaterThan(0);
      expect(mock.stats.calc).toBe(1);
    });

    it('"both" loads the frontend AND calls the API directly (double API traffic)', async () => {
      const summary = await run({ mode: 'both', iterations: 1, headless: true }).start();

      expect(summary.failed).toBe(0);
      expect(mock.stats.frontendPageLoads).toBeGreaterThan(0);
      expect(mock.stats.calc).toBe(2);
    });
  });

  describe('--headless', () => {
    it('executes successfully in headless mode when headless=true', async () => {
      const summary = await run({ mode: 'frontend', headless: true }).start();

      expect(summary.completed).toBe(1);
      expect(summary.failed).toBe(0);
      expect(mock.stats.frontendPageLoads).toBeGreaterThan(0);
      expect(mock.stats.calc).toBe(1);
    });

    it('defaults to headless mode when not specified and executes successfully', async () => {
      const summary = await run({ mode: 'frontend' }).start();

      expect(summary.completed).toBe(1);
      expect(summary.failed).toBe(0);
      expect(mock.stats.frontendPageLoads).toBeGreaterThan(0);
      expect(mock.stats.calc).toBe(1);
    });

    it('does not launch a browser at all in backend mode regardless of headless setting', async () => {
      const summary = await run({ mode: 'backend', headless: false }).start();

      expect(summary.completed).toBe(1);
      expect(summary.failed).toBe(0);
      expect(mock.stats.frontendPageLoads).toBe(0);
      expect(mock.stats.calc).toBe(1);
    });
  });

  describe('closeDelayMs (CLOSE_DELAY_MS)', () => {
    it('keeps each page open for closeDelayMs after the cycle', async () => {
      const t0 = performance.now();
      await run({ mode: 'frontend', closeDelayMs: 0 }).start();
      const fast = performance.now() - t0;

      const t1 = performance.now();
      await run({ mode: 'frontend', closeDelayMs: 1000 }).start();
      const slow = performance.now() - t1;

      expect(slow - fast).toBeGreaterThanOrEqual(800);
    });
  });
});
