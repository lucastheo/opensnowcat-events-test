import type { BrowserContext, chromium } from 'playwright';
import { BrowserController, type BrowserCycleResult } from './controllers/browser.controller.js';
import { ApiController, type ExecuteAllResult } from './controllers/api.controller.js';
import { Logger, logger as defaultLogger } from './utils/logger.js';
import { MetricsTracker, type MetricsSummary } from './utils/metrics.js';

export type ExecutionMode = 'frontend' | 'backend' | 'both';

export interface TargetUrls {
  frontendUrl: string;
  backendUrl?: string;
  simpleCollectorUrl?: string;
  opensnowcatUrl?: string;
}

export interface RunnerOptions {
  targetUrls?: TargetUrls;
  frontendUrl?: string;
  backendUrl?: string;
  simpleCollectorUrl?: string;
  opensnowcatUrl?: string;
  iterations?: number;
  concurrency?: number;
  delayMs?: number;
  closeDelayMs?: number;
  mode?: ExecutionMode;
  headless?: boolean;
  logger?: Logger;
  metrics?: MetricsTracker;
  browserController?: BrowserController;
  apiController?: ApiController;
  chromium?: typeof chromium;
}

export class Runner {
  private readonly targetUrls: TargetUrls;
  private readonly iterations: number;
  private readonly concurrency: number;
  private readonly delayMs: number;
  private readonly closeDelayMs: number;
  private readonly mode: ExecutionMode;
  private readonly headless: boolean;
  private readonly logger: Logger;
  private readonly metrics: MetricsTracker;

  private readonly browserController?: BrowserController;
  private readonly apiController: ApiController;

  private aborted: boolean = false;
  private completedIterations: number = 0;

  constructor(options: RunnerOptions) {
    const rawUrls = options.targetUrls ?? {
      frontendUrl: options.frontendUrl ?? 'http://localhost:3000',
      backendUrl: options.backendUrl,
      simpleCollectorUrl: options.simpleCollectorUrl,
      opensnowcatUrl: options.opensnowcatUrl,
    };
    this.targetUrls = {
      frontendUrl: rawUrls.frontendUrl || options.frontendUrl || 'http://localhost:3000',
      backendUrl: rawUrls.backendUrl || options.backendUrl || process.env.BACKEND_URL || 'http://localhost:4000',
      simpleCollectorUrl: rawUrls.simpleCollectorUrl ?? options.simpleCollectorUrl,
      opensnowcatUrl: rawUrls.opensnowcatUrl ?? options.opensnowcatUrl,
    };
    this.iterations = options.iterations ?? 100;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.delayMs = Math.max(0, options.delayMs ?? 50);
    this.closeDelayMs = Math.max(0, options.closeDelayMs ?? 0);
    this.mode = options.mode ?? 'both';
    this.headless = options.headless ?? true;
    this.logger = options.logger ?? defaultLogger;
    this.metrics = options.metrics ?? new MetricsTracker();

    this.apiController =
      options.apiController ??
      new ApiController({
        backendUrl: this.targetUrls.backendUrl!,
      });

    if (this.mode === 'frontend' || this.mode === 'both') {
      this.browserController =
        options.browserController ??
        new BrowserController({
          targetUrls: this.targetUrls,
          headless: this.headless,
          closeDelayMs: this.closeDelayMs,
          logger: this.logger,
          chromium: options.chromium,
        });
    } else {
      this.browserController = options.browserController;
    }
  }

  async start(): Promise<MetricsSummary> {
    this.aborted = false;
    this.completedIterations = 0;
    this.metrics.reset();

    this.logger.info(
      `Starting test run: iterations=${this.iterations}, concurrency=${this.concurrency}, mode=${this.mode}, delay=${this.delayMs}ms`
    );

    const sigintHandler = () => {
      this.logger.warn('\nReceived SIGINT (Ctrl+C), terminating gracefully...');
      this.stop();
    };
    const sigtermHandler = () => {
      this.logger.warn('\nReceived SIGTERM, terminating gracefully...');
      this.stop();
    };

    process.on('SIGINT', sigintHandler);
    process.on('SIGTERM', sigtermHandler);

    try {
      if (this.iterations > 0) {
        if (this.browserController && (this.mode === 'frontend' || this.mode === 'both')) {
          await this.browserController.launch();
        }

        let currentIndex = 0;
        const workerCount = Math.min(this.concurrency, this.iterations);
        const workers: Promise<void>[] = [];

        for (let i = 0; i < workerCount; i++) {
          workers.push(
            this.runWorker(() => {
              if (this.aborted || currentIndex >= this.iterations) {
                return null;
              }
              return currentIndex++;
            })
          );
        }

        await Promise.all(workers);
      }
    } finally {
      process.removeListener('SIGINT', sigintHandler);
      process.removeListener('SIGTERM', sigtermHandler);

      if (this.browserController) {
        await this.browserController.close(this.aborted).catch(() => {});
      }

      this.logger.info(`\n${this.metrics.formatSummary()}`);
    }

    return this.metrics.getSummary();
  }

  stop(): void {
    this.aborted = true;
  }

  isAborted(): boolean {
    return this.aborted;
  }

  getMetrics(): MetricsTracker {
    return this.metrics;
  }

  private async runWorker(getNextIndex: () => number | null): Promise<void> {
    let context: BrowserContext | undefined;
    if (this.browserController && (this.mode === 'frontend' || this.mode === 'both')) {
      context = await this.browserController.newContext();
    }

    while (!this.aborted) {
      const iter = getNextIndex();
      if (iter === null) {
        break;
      }

      await this.executeIteration(context);

      if (this.delayMs > 0 && !this.aborted) {
        await this.sleep(this.delayMs);
      }
    }
  }

  private async executeIteration(context?: BrowserContext): Promise<void> {
    const startTime = performance.now();
    let browserRes: BrowserCycleResult | undefined;
    let apiRes: ExecuteAllResult | undefined;
    let success = true;
    let errorMsg: string | undefined;

    try {
      if (this.mode === 'frontend') {
        if (this.browserController) {
          browserRes = await this.browserController.runCycle(context);
        }
      } else if (this.mode === 'backend') {
        apiRes = await this.apiController.executeAll();
      } else {
        // mode === 'both'
        const tasks: [Promise<BrowserCycleResult>?, Promise<ExecuteAllResult>?] = [];
        if (this.browserController) {
          tasks[0] = this.browserController.runCycle(context);
        }
        tasks[1] = this.apiController.executeAll();

        const [bRes, aRes] = await Promise.all(tasks);
        browserRes = bRes;
        apiRes = aRes;
      }

      const errors: string[] = [];

      if (browserRes && !browserRes.success) {
        success = false;
        if (browserRes.error) errors.push(`Browser: ${browserRes.error}`);
      }

      if (apiRes && !apiRes.success) {
        success = false;
        if (apiRes.errors.length > 0) {
          errors.push(`API: ${apiRes.errors.join('; ')}`);
        }
      }

      if (errors.length > 0) {
        errorMsg = errors.join(' | ');
      }
    } catch (err) {
      success = false;
      errorMsg = err instanceof Error ? err.message : String(err);
    } finally {
      const durationMs = Math.round(performance.now() - startTime);
      this.metrics.recordIteration(durationMs, success, errorMsg);
    }

    this.completedIterations++;
    const summary = this.metrics.getSummary();
    this.logger.logProgress(this.completedIterations, this.iterations, {
      success: summary.completed,
      failed: summary.failed,
      avgMs: summary.latencies.avg,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      const interval = setInterval(() => {
        if (this.aborted) {
          clearTimeout(timer);
          clearInterval(interval);
          resolve();
        }
      }, 50);
      timer.unref?.();
      interval.unref?.();
    });
  }
}
