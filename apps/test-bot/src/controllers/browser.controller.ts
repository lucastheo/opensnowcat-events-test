import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { Logger, logger as defaultLogger } from '../utils/logger.js';

export interface BrowserControllerOptions {
  frontendUrl: string;
  backendUrl?: string;
  simpleCollectorUrl?: string;
  opensnowcatUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
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
  private readonly frontendUrl: string;
  private readonly backendUrl?: string;
  private readonly simpleCollectorUrl?: string;
  private readonly opensnowcatUrl?: string;
  private readonly headless: boolean;
  private readonly timeoutMs: number;
  private readonly logger: Logger;
  private readonly launcher: typeof chromium;

  private browser?: Browser;
  private defaultContext?: BrowserContext;
  private readonly contexts: Set<BrowserContext> = new Set();

  constructor(options: BrowserControllerOptions) {
    this.frontendUrl = options.frontendUrl.replace(/\/$/, '');
    this.backendUrl = options.backendUrl
      ? options.backendUrl.replace(/\/$/, '')
      : process.env.BACKEND_URL || 'http://backend-producer:4000';
    this.simpleCollectorUrl = options.simpleCollectorUrl
      ? options.simpleCollectorUrl.replace(/\/$/, '')
      : process.env.SIMPLE_COLLECTOR_URL || 'http://simple-collector:5000';
    this.opensnowcatUrl = options.opensnowcatUrl
      ? options.opensnowcatUrl.replace(/\/$/, '')
      : process.env.OPENSNOWCAT_URL || 'http://localhost:8080';
    this.headless = options.headless ?? true;
    this.timeoutMs = options.timeoutMs ?? 10000;
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
      [/^http:\/\/localhost:4000/, this.backendUrl],
      [/^http:\/\/localhost:5000/, this.simpleCollectorUrl],
      [/^http:\/\/localhost:8080/, this.opensnowcatUrl],
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
      await page.goto(`${this.frontendUrl}${path}`, { timeout: this.timeoutMs });
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
    await action(page);
    await this.waitForResult(page, resultSelector);
  }

  async runCycle(context?: BrowserContext): Promise<BrowserCycleResult> {
    const startTime = performance.now();
    let page: Page | undefined;
    let pagesInteracted = 0;

    try {
      const activeContext = context ?? (await this.getOrCreateContext());
      page = await activeContext.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      // Home
      await page.goto(`${this.frontendUrl}/`, { timeout: this.timeoutMs });

      // 1. Calculator
      await this.interactWithService(
        page,
        '#header-nav-calc, #link-nav-calc',
        '/calc',
        async (p) => {
          await p.fill('#calc-input-a', '12');
          await p.fill('#calc-input-b', '4');
          await p.click('#btn-calc-submit');
        },
        '#calc-result'
      );
      pagesInteracted++;

      // 2. Timestamp
      await this.interactWithService(
        page,
        '#header-nav-timestamp, #link-nav-timestamp',
        '/timestamp',
        async (p) => {
          await p.click('#btn-timestamp-fetch');
        },
        '#timestamp-result'
      );
      pagesInteracted++;

      // 3. Excuse
      await this.interactWithService(
        page,
        '#header-nav-excuse, #link-nav-excuse',
        '/excuse',
        async (p) => {
          await p.click('#btn-generate-excuse');
        },
        '#excuse-result'
      );
      pagesInteracted++;

      // 4. Dice
      await this.interactWithService(
        page,
        '#header-nav-dice, #link-nav-dice',
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
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  async close(): Promise<void> {
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
