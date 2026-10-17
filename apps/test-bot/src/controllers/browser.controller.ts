import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { Logger, logger as defaultLogger } from '../utils/logger.js';
import type { TargetUrls } from '../runner.js';

export interface BrowserControllerOptions {
  targetUrls?: TargetUrls;
  frontendUrl?: string;
  backendUrl?: string;
  simpleCollectorUrl?: string;
  opensnowcatUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
  closeDelayMs?: number;
  logger?: Logger;
  chromium?: typeof chromium;
}

export interface BrowserCycleResult {
  success: boolean;
  durationMs: number;
  pagesInteracted: number;
  error?: string;
}

export class BrowserController {
  private readonly targetUrls: TargetUrls;
  private readonly headless: boolean;
  private readonly timeoutMs: number;
  private readonly closeDelayMs: number;
  private readonly logger: Logger;
  private readonly launcher: typeof chromium;

  private browser?: Browser;
  private defaultContext?: BrowserContext;
  private readonly contexts: Set<BrowserContext> = new Set();
  private readonly contextPages: Map<BrowserContext, Page> = new Map();

  constructor(options: BrowserControllerOptions) {
    const rawUrls = options.targetUrls ?? {
      frontendUrl: options.frontendUrl ?? 'http://localhost:3000',
      backendUrl: options.backendUrl,
      simpleCollectorUrl: options.simpleCollectorUrl,
      opensnowcatUrl: options.opensnowcatUrl,
    };
    this.targetUrls = {
      frontendUrl: (rawUrls.frontendUrl || options.frontendUrl || 'http://localhost:3000').replace(/\/$/, ''),
      backendUrl: (
        rawUrls.backendUrl ||
        options.backendUrl ||
        process.env.BACKEND_URL ||
        'http://backend-producer:4000'
      ).replace(/\/$/, ''),
      simpleCollectorUrl: (
        rawUrls.simpleCollectorUrl ||
        options.simpleCollectorUrl ||
        process.env.SIMPLE_COLLECTOR_URL ||
        'http://simple-collector:5000'
      ).replace(/\/$/, ''),
      opensnowcatUrl: (
        rawUrls.opensnowcatUrl ||
        options.opensnowcatUrl ||
        process.env.OPENSNOWCAT_URL ||
        'http://localhost:8080'
      ).replace(/\/$/, ''),
    };
    this.headless = options.headless ?? true;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.closeDelayMs = Math.max(0, options.closeDelayMs ?? 0);
    this.logger = options.logger ?? defaultLogger;
    this.launcher = options.chromium ?? chromium;
  }

  async launch(): Promise<Browser> {
    if (!this.browser) {
      this.logger.debug(`Launching Chromium (headless=${this.headless})`);
      this.browser = await this.launcher.launch({
        headless: this.headless,
      });
    }
    return this.browser;
  }

  async newContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.launch();
    }
    const context = await this.browser!.newContext();
    this.contexts.add(context);

    const rewrites: [RegExp, string | undefined][] = [
      [/^http:\/\/localhost:4000/, this.targetUrls.backendUrl],
      [/^http:\/\/localhost:5000/, this.targetUrls.simpleCollectorUrl],
      [/^http:\/\/localhost:8080/, this.targetUrls.opensnowcatUrl],
    ];

    for (const [pattern, target] of rewrites) {
      if (target) {
        await context.route(pattern, (route) => {
          const url = route.request().url().replace(pattern, target);
          route.continue({ url });
        });
      }
    }

    return context;
  }

  private async getOrCreateContext(): Promise<BrowserContext> {
    if (!this.defaultContext) {
      this.defaultContext = await this.newContext();
    }
    return this.defaultContext;
  }

  private async getOrCreatePage(context: BrowserContext): Promise<Page> {
    const existingPage = this.contextPages.get(context);
    if (existingPage && (typeof existingPage.isClosed !== 'function' || !existingPage.isClosed())) {
      return existingPage;
    }

    const page = await context.newPage();
    page.setDefaultTimeout(this.timeoutMs);
    this.contextPages.set(context, page);
    return page;
  }

  private async returnToHome(page: Page): Promise<void> {
    let elementFound = false;
    if (typeof page.$ === 'function') {
      const el = await page.$('#link-nav-home').catch(() => null);
      if (el) {
        elementFound = true;
      }
    }

    if (elementFound) {
      await page.click('#link-nav-home');
    } else if (typeof page.goto === 'function') {
      await page.goto(`${this.targetUrls.frontendUrl}/`, { timeout: this.timeoutMs });
    } else {
      await page.click('#link-nav-home');
    }
  }

  private async navigateToService(page: Page, selector: string, path: string): Promise<void> {
    let elementFound = false;
    if (typeof page.$ === 'function') {
      const el = await page.$(selector).catch(() => null);
      if (el) {
        elementFound = true;
      }
    }

    if (elementFound) {
      await page.click(selector);
    } else if (typeof page.goto === 'function') {
      await page.goto(`${this.targetUrls.frontendUrl}${path}`, { timeout: this.timeoutMs });
    } else {
      await page.click(selector);
    }
  }

  private async waitForResult(page: Page, selector: string): Promise<void> {
    await page.waitForSelector(selector, { state: 'visible', timeout: this.timeoutMs });
    if (typeof page.waitForFunction === 'function') {
      await page.waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          return el !== null && el.textContent !== null && el.textContent.trim().length > 0;
        },
        selector,
        { timeout: this.timeoutMs }
      );
    }
  }

  private async interactWithService(
    page: Page,
    navSelector: string,
    path: string,
    action: (page: Page) => Promise<void>,
    resultSelector: string
  ): Promise<void> {
    await this.navigateToService(page, navSelector, path);
    if (typeof page.evaluate === 'function') {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.textContent = '';
        }
      }, resultSelector).catch(() => {});
    }
    await action(page);
    await this.waitForResult(page, resultSelector);
  }

  async runCycle(context?: BrowserContext): Promise<BrowserCycleResult> {
    const startTime = performance.now();
    let pagesInteracted = 0;

    try {
      const activeContext = context ?? (await this.getOrCreateContext());
      const page = await this.getOrCreatePage(activeContext);

      // Home
      await page.goto(`${this.targetUrls.frontendUrl}/`, { timeout: this.timeoutMs });

      // 1. Calculator
      await this.interactWithService(
        page,
        '#link-nav-calc, #header-nav-calc',
        '/calc',
        async (p) => {
          await p.fill('#calc-input-a', '12');
          await p.fill('#calc-input-b', '4');
          await p.click('#btn-calc-submit');
        },
        '#calc-result'
      );
      pagesInteracted++;

      await this.returnToHome(page);

      // 2. Timestamp
      await this.interactWithService(
        page,
        '#link-nav-timestamp, #header-nav-timestamp',
        '/timestamp',
        async (p) => {
          await p.click('#btn-timestamp-fetch');
        },
        '#timestamp-result'
      );
      pagesInteracted++;

      await this.returnToHome(page);

      // 3. Excuse
      await this.interactWithService(
        page,
        '#link-nav-excuse, #header-nav-excuse',
        '/excuse',
        async (p) => {
          await p.click('#btn-generate-excuse');
        },
        '#excuse-result'
      );
      pagesInteracted++;

      await this.returnToHome(page);

      // 4. Dice
      await this.interactWithService(
        page,
        '#link-nav-dice, #header-nav-dice',
        '/dice',
        async (p) => {
          await p.click('#btn-roll-dice');
        },
        '#dice-result'
      );
      pagesInteracted++;

      const durationMs = Math.round(performance.now() - startTime);
      return {
        success: true,
        durationMs,
        pagesInteracted,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Browser cycle error: ${errorMessage}`);
      return {
        success: false,
        durationMs,
        pagesInteracted,
        error: errorMessage,
      };
    }
  }

  async close(skipDelay: boolean = false): Promise<void> {
    if (!skipDelay && (this.browser || this.contexts.size > 0) && this.closeDelayMs > 0) {
      this.logger.info(`Waiting ${this.closeDelayMs / 1000}s before closing browser...`);
      await new Promise((resolve) => setTimeout(resolve, this.closeDelayMs));
    }

    for (const page of this.contextPages.values()) {
      await page.close().catch(() => {});
    }
    this.contextPages.clear();

    for (const ctx of this.contexts) {
      await ctx.close().catch(() => {});
    }
    this.contexts.clear();
    this.defaultContext = undefined;

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = undefined;
    }
  }

  getBrowser(): Browser | undefined {
    return this.browser;
  }
}
