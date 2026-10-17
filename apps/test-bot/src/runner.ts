import type { BrowserContext } from 'playwright';
import { BrowserController, type BrowserCycleResult } from './controllers/browser.controller.js';
import { ApiController, type ExecuteAllResult } from './controllers/api.controller.js';
import { Logger, logger as defaultLogger } from './utils/logger.js';
import { MetricsTracker, type MetricsSummary } from './utils/metrics.js';

export type ExecutionMode = 'frontend' | 'backend' | 'both';

export interface RunnerOptions {
  frontendUrl: string;
  backendUrl: string;
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
}

export class Runner {
  private readonly frontendUrl: string;
  private readonly backendUrl: string;
  private readonly simpleCollectorUrl?: string;
  private readonly opensnowcatUrl?: string;
  private readonly iterations: number;
  private readonly concurrency: number;
  private readonly delayMs: number;
  private readonly closeDelayMs?: number;
  private readonly mode: ExecutionMode;
  private readonly headless: boolean;
  private readonly logger: Logger;
  private readonly metrics: MetricsTracker;

  private readonly browserController?: BrowserController;
  private readonly apiController: ApiController;

  private aborted: boolean = false;
  private completedIterations: number = 0;

  constructor(options: RunnerOptions) {
    this.frontendUrl = options.frontendUrl;
    this.backendUrl = options.backendUrl;
    this.simpleCollectorUrl = options.simpleCollectorUrl;
    this.opensnowcatUrl = options.opensnowcatUrl;
    this.iterations = options.iterations ?? 100;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.delayMs = Math.max(0, options.delayMs ?? 50);
    this.closeDelayMs = options.closeDelayMs ?? 10000;
    this.mode = options.mode ?? 'both';
    this.headless = options.headless ?? true;
    this.logger = options.logger ?? defaultLogger;
    this.metrics = options.metrics ?? new MetricsTracker();

    this.apiController =
      options.apiController ??
      new ApiController({
        backendUrl: this.backendUrl,
      });

    if (this.mode === 'frontend' || this.mode === 'both') {
      this.browserController =
        options.browserController ??
        new BrowserController({
          frontendUrl: this.frontendUrl,
          backendUrl: this.backendUrl,
          simpleCollectorUrl: this.simpleCollectorUrl,
          opensnowcatUrl: this.opensnowcatUrl,
          headless: this.headless,
          closeDelayMs: this.closeDelayMs,
          logger: this.logger,
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
        await this.browserController.close().catch(() => {});
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

      const durationMs = Math.round(performance.now() - startTime);

      let success = true;
      const errors: string[] = [];

      if (browserRes) {
        if (!browserRes.success) {
          success = false;
          if (browserRes.error) errors.push(`Browser: ${browserRes.error}`);
        }
      }

      if (apiRes) {
        if (!apiRes.success) {
          success = false;
          if (apiRes.errors.length > 0) {
            errors.push(`API: ${apiRes.errors.join('; ')}`);
          }
        }
      }

      const errorMsg = errors.length > 0 ? errors.join(' | ') : undefined;
      this.metrics.recordIteration(durationMs, success, errorMsg);
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.metrics.recordIteration(durationMs, false, errorMsg);
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
