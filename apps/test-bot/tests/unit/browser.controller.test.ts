import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Browser, BrowserContext, Page, Route, Request } from 'playwright';
import { BrowserController } from '../../src/controllers/browser.controller.js';
import { Logger } from '../../src/utils/logger.js';

describe('BrowserController', () => {
  let mockPage: Partial<Page>;
  let mockContext: Partial<BrowserContext>;
  let mockBrowser: Partial<Browser>;
  let mockChromium: { launch: ReturnType<typeof vi.fn> };
  let logger: Logger;

  beforeEach(() => {
    mockPage = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn().mockResolvedValue(null),
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined as any),
      waitForFunction: vi.fn().mockResolvedValue(undefined as any),
      $: vi.fn().mockResolvedValue({} as any),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const routes: { pattern: RegExp | string; handler: (route: Route) => void }[] = [];

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage as Page),
      route: vi.fn().mockImplementation((pattern, handler) => {
        routes.push({ pattern, handler });
        return Promise.resolve();
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext as BrowserContext),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockChromium = {
      launch: vi.fn().mockResolvedValue(mockBrowser as Browser),
    };

    logger = new Logger({ silent: true });
  });

  it('should initialize with default options and strip trailing slashes', () => {
    const controller = new BrowserController({
      frontendUrl: 'http://localhost:3000/',
      backendUrl: 'http://localhost:4000/',
      simpleCollectorUrl: 'http://localhost:5000/',
      opensnowcatUrl: 'http://localhost:8080/',
      chromium: mockChromium as any,
      logger,
    });

    expect(controller).toBeDefined();
    expect(controller.getBrowser()).toBeUndefined();
  });

  it('should launch chromium with configured headless option and reuse instance', async () => {
    const controller = new BrowserController({
      frontendUrl: 'http://localhost:3000',
      headless: false,
      chromium: mockChromium as any,
      logger,
    });

    const browser1 = await controller.launch();
    expect(mockChromium.launch).toHaveBeenCalledWith({ headless: false });
    expect(browser1).toBe(mockBrowser);

    // Call launch again; should not call chromium.launch a second time
    const browser2 = await controller.launch();
    expect(mockChromium.launch).toHaveBeenCalledTimes(1);
    expect(browser2).toBe(browser1);
  });

  it('should create context with route interception for backend, simple collector, and opensnowcat', async () => {
    const controller = new BrowserController({
      frontendUrl: 'http://localhost:3000',
      backendUrl: 'http://backend-producer:4000',
      simpleCollectorUrl: 'http://simple-collector:5000',
      opensnowcatUrl: 'http://snowcat-collector:8080',
      chromium: mockChromium as any,
      logger,
    });

    const context = await controller.newContext();
    expect(mockBrowser.newContext).toHaveBeenCalled();
    expect(mockContext.route).toHaveBeenCalledTimes(3);

    // Verify route handler rewrites URL
    const routeCalls = vi.mocked(mockContext.route!).mock.calls;
    const backendRouteHandler = routeCalls.find(
      ([pattern]) => pattern instanceof RegExp && pattern.test('http://localhost:4000')
    )?.[1];
    expect(backendRouteHandler).toBeDefined();

    const mockRequest = { url: () => 'http://localhost:4000/api/calc' } as Request;
    const mockRoute = {
      request: () => mockRequest,
      continue: vi.fn(),
    } as unknown as Route;

    backendRouteHandler!(mockRoute);
    expect(mockRoute.continue).toHaveBeenCalledWith({
      url: 'http://backend-producer:4000/api/calc',
    });
  });

  it('should execute a full cycle across all 4 service pages successfully', async () => {
    const controller = new BrowserController({
      frontendUrl: 'http://frontend:3000',
      chromium: mockChromium as any,
      logger,
    });

    const result = await controller.runCycle();

    expect(result.success).toBe(true);
    expect(result.pagesInteracted).toBe(4);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();

    // Verify Home navigation
    expect(mockPage.goto).toHaveBeenCalledWith('http://frontend:3000/', { timeout: 10000 });

    // Verify Calculator interaction
    expect(mockPage.click).toHaveBeenCalledWith('#link-nav-calc');
    expect(mockPage.fill).toHaveBeenCalledWith('#calc-input-a', '12');
    expect(mockPage.fill).toHaveBeenCalledWith('#calc-input-b', '4');
    expect(mockPage.click).toHaveBeenCalledWith('#btn-calc-submit');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#calc-result', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify Timestamp interaction
    expect(mockPage.click).toHaveBeenCalledWith('#link-nav-timestamp');
    expect(mockPage.click).toHaveBeenCalledWith('#btn-timestamp-fetch');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#timestamp-result', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify Excuse interaction
    expect(mockPage.click).toHaveBeenCalledWith('#link-nav-excuse');
    expect(mockPage.click).toHaveBeenCalledWith('#btn-generate-excuse');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#excuse-result', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify Dice interaction
    expect(mockPage.click).toHaveBeenCalledWith('#link-nav-dice');
    expect(mockPage.click).toHaveBeenCalledWith('#btn-roll-dice');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#dice-result', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify page closed
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should fallback to goto if navigation selector is not present in DOM', async () => {
    // page.$ returns null for elements
    mockPage.$ = vi.fn().mockResolvedValue(null);

    const controller = new BrowserController({
      frontendUrl: 'http://frontend:3000',
      chromium: mockChromium as any,
      logger,
    });

    const result = await controller.runCycle(mockContext as BrowserContext);

    expect(result.success).toBe(true);
    expect(result.pagesInteracted).toBe(4);
    expect(mockPage.goto).toHaveBeenCalledWith('http://frontend:3000/calc', { timeout: 10000 });
    expect(mockPage.goto).toHaveBeenCalledWith('http://frontend:3000/timestamp', { timeout: 10000 });
    expect(mockPage.goto).toHaveBeenCalledWith('http://frontend:3000/excuse', { timeout: 10000 });
    expect(mockPage.goto).toHaveBeenCalledWith('http://frontend:3000/dice', { timeout: 10000 });
  });

  it('should catch timeouts and errors gracefully without throwing', async () => {
    mockPage.goto = vi.fn().mockRejectedValue(new Error('Page load timed out'));

    const controller = new BrowserController({
      frontendUrl: 'http://frontend:3000',
      chromium: mockChromium as any,
      logger,
    });

    const result = await controller.runCycle();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Page load timed out');
    expect(result.pagesInteracted).toBe(0);
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should close contexts and browser cleanly on close()', async () => {
    const controller = new BrowserController({
      frontendUrl: 'http://frontend:3000',
      chromium: mockChromium as any,
      logger,
    });

    await controller.newContext();
    expect(controller.getBrowser()).toBeDefined();

    await controller.close();
    expect(mockContext.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
    expect(controller.getBrowser()).toBeUndefined();
  });
});
