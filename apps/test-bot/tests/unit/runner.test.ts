import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runner } from '../../src/runner.js';
import type { BrowserController } from '../../src/controllers/browser.controller.js';
import type { ApiController } from '../../src/controllers/api.controller.js';
import { Logger } from '../../src/utils/logger.js';
import { MetricsTracker } from '../../src/utils/metrics.js';

describe('Runner', () => {
  let mockBrowserController: Partial<BrowserController>;
  let mockApiController: Partial<ApiController>;
  let logger: Logger;
  let metrics: MetricsTracker;

  beforeEach(() => {
    mockBrowserController = {
      launch: vi.fn().mockResolvedValue(undefined as any),
      newContext: vi.fn().mockResolvedValue({
        close: vi.fn().mockResolvedValue(undefined),
      } as any),
      runCycle: vi.fn().mockResolvedValue({
        success: true,
        durationMs: 10,
        pagesInteracted: 4,
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockApiController = {
      executeAll: vi.fn().mockResolvedValue({
        success: true,
        durationMs: 5,
        results: {},
        errors: [],
      }),
    };

    logger = new Logger({ silent: true });
    metrics = new MetricsTracker();
  });

  it('should initialize with default options', () => {
    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      logger,
    });

    expect(runner).toBeDefined();
    expect(runner.isAborted()).toBe(false);
  });

  it('should execute iterations in backend mode without calling browser controller', async () => {
    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'backend',
      iterations: 3,
      concurrency: 1,
      delayMs: 0,
      apiController: mockApiController as ApiController,
      browserController: mockBrowserController as BrowserController,
      logger,
      metrics,
    });

    const summary = await runner.start();

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.successRate).toBe(100);

    expect(mockApiController.executeAll).toHaveBeenCalledTimes(3);
    expect(mockBrowserController.launch).not.toHaveBeenCalled();
    expect(mockBrowserController.runCycle).not.toHaveBeenCalled();
  });

  it('should execute iterations in frontend mode calling browser controller', async () => {
    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'frontend',
      iterations: 2,
      concurrency: 1,
      delayMs: 0,
      apiController: mockApiController as ApiController,
      browserController: mockBrowserController as BrowserController,
      logger,
      metrics,
    });

    const summary = await runner.start();

    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(0);

    expect(mockBrowserController.launch).toHaveBeenCalledTimes(1);
    expect(mockBrowserController.runCycle).toHaveBeenCalledTimes(2);
    expect(mockApiController.executeAll).not.toHaveBeenCalled();
    expect(mockBrowserController.close).toHaveBeenCalledWith(false);
  });

  it('should execute iterations in both mode calling browser and api concurrently', async () => {
    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'both',
      iterations: 4,
      concurrency: 2,
      delayMs: 0,
      apiController: mockApiController as ApiController,
      browserController: mockBrowserController as BrowserController,
      logger,
      metrics,
    });

    const summary = await runner.start();

    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(4);
    expect(summary.failed).toBe(0);

    expect(mockBrowserController.launch).toHaveBeenCalledTimes(1);
    expect(mockBrowserController.runCycle).toHaveBeenCalledTimes(4);
    expect(mockApiController.executeAll).toHaveBeenCalledTimes(4);
    expect(mockBrowserController.close).toHaveBeenCalledWith(false);
  });

  it('should record failure when browser or api cycle fails', async () => {
    mockBrowserController.runCycle = vi.fn().mockResolvedValue({
      success: false,
      durationMs: 15,
      pagesInteracted: 1,
      error: 'Selector #calc-result timed out',
    });

    mockApiController.executeAll = vi.fn().mockResolvedValue({
      success: false,
      durationMs: 10,
      results: {},
      errors: ['Calc failed: HTTP 500'],
    });

    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'both',
      iterations: 2,
      concurrency: 1,
      delayMs: 0,
      apiController: mockApiController as ApiController,
      browserController: mockBrowserController as BrowserController,
      logger,
      metrics,
    });

    const summary = await runner.start();

    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(2);
    expect(summary.successRate).toBe(0);
    expect(summary.errors.length).toBe(2);
    expect(summary.errors[0]).toContain('Browser: Selector #calc-result timed out');
    expect(summary.errors[0]).toContain('API: Calc failed: HTTP 500');
  });

  it('should record failure and latency when execution throws an unhandled exception', async () => {
    mockApiController.executeAll = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'backend',
      iterations: 1,
      concurrency: 1,
      delayMs: 0,
      apiController: mockApiController as ApiController,
      logger,
      metrics,
    });

    const summary = await runner.start();

    expect(summary.total).toBe(1);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toContain('Network disconnected');
    expect(summary.latencies.min).toBeGreaterThanOrEqual(0);
  });

  it('should abort immediately when stop() is called and pass aborted=true to close', async () => {
    let callCount = 0;
    mockApiController.executeAll = vi.fn().mockImplementation(async () => {
      callCount++;
      return { success: true, durationMs: 1, results: {}, errors: [] };
    });

    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'backend',
      iterations: 10,
      concurrency: 1,
      delayMs: 10,
      apiController: mockApiController as ApiController,
      browserController: mockBrowserController as BrowserController,
      logger,
      metrics,
    });

    // Stop runner after 1 iteration
    const startPromise = runner.start();
    // Allow the first iteration to begin
    await new Promise((resolve) => setTimeout(resolve, 5));
    runner.stop();

    const summary = await startPromise;

    expect(runner.isAborted()).toBe(true);
    expect(summary.total).toBeLessThan(10);
    expect(mockBrowserController.close).toHaveBeenCalledWith(true);
  });

  it('should pass headless option to browser controller and launcher', async () => {
    const mockLaunch = vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          setDefaultTimeout: vi.fn(),
          goto: vi.fn().mockResolvedValue(null),
          click: vi.fn().mockResolvedValue(undefined),
          fill: vi.fn().mockResolvedValue(undefined),
          evaluate: vi.fn().mockResolvedValue(undefined),
          waitForSelector: vi.fn().mockResolvedValue(undefined as any),
          waitForFunction: vi.fn().mockResolvedValue(undefined as any),
          $: vi.fn().mockResolvedValue({} as any),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        route: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      mode: 'frontend',
      iterations: 1,
      headless: false,
      chromium: { launch: mockLaunch } as any,
      logger,
    });

    await runner.start();
    expect(mockLaunch).toHaveBeenCalledWith({ headless: false });
  });

  it('should handle zero iterations without error', async () => {
    const runner = new Runner({
      targetUrls: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:4000',
      },
      iterations: 0,
      apiController: mockApiController as ApiController,
      browserController: mockBrowserController as BrowserController,
      logger,
      metrics,
    });

    const summary = await runner.start();

    expect(summary.total).toBe(0);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(0);
  });
});

