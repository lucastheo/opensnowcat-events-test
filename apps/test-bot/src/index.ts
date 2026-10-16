#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Runner, type RunnerOptions, type ExecutionMode } from './runner.js';
import type { MetricsSummary } from './utils/metrics.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('opensnowcat-bot')
    .description('Test Bot driving synthetic traffic to Frontend and Backend Producers')
    .version('1.0.0')
    .option(
      '--frontend-url <url>',
      'Target URL of the Frontend Application',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    )
    .option(
      '--backend-url <url>',
      'Target URL of the Backend Application',
      process.env.BACKEND_URL || 'http://localhost:4000'
    )
    .option(
      '--simple-collector-url <url>',
      'Target URL of Simple Collector',
      process.env.SIMPLE_COLLECTOR_URL || 'http://localhost:5000'
    )
    .option(
      '--opensnowcat-url <url>',
      'Target URL of OpenSnowcat',
      process.env.OPENSNOWCAT_URL || 'http://localhost:8080'
    )
    .option(
      '--iterations <number>',
      'Total number of test cycles to execute',
      (val) => parseInt(val, 10),
      parseInt(process.env.ITERATIONS || '100', 10)
    )
    .option(
      '--concurrency <number>',
      'Number of parallel worker threads / browser contexts',
      (val) => parseInt(val, 10),
      parseInt(process.env.CONCURRENCY || '1', 10)
    )
    .option(
      '--delay-ms <number>',
      'Artificial pause between iterations in milliseconds',
      (val) => parseInt(val, 10),
      parseInt(process.env.DELAY_MS || '50', 10)
    )
    .option(
      '--mode <mode>',
      'Execution target: frontend, backend, or both',
      process.env.MODE || 'both'
    )
    .option(
      '--headless <boolean>',
      'Run browser in headless mode',
      (val) => val !== 'false',
      process.env.HEADLESS !== undefined
        ? process.env.HEADLESS !== 'false'
        : process.env.NODE_ENV !== 'development'
    );

  return program;
}

export function parseOptions(argv: string[] = process.argv): RunnerOptions {
  const program = createCli();
  program.exitOverride();

  const isUserArgs = argv.length > 0 && argv[0].startsWith('-');
  program.parse(argv, isUserArgs ? { from: 'user' } : undefined);

  const opts = program.opts();

  if (isNaN(opts.iterations) || opts.iterations < 0) {
    throw new Error(`Invalid iterations: "${opts.iterations}". Must be a non-negative number.`);
  }

  if (isNaN(opts.concurrency) || opts.concurrency < 1) {
    throw new Error(`Invalid concurrency: "${opts.concurrency}". Must be an integer >= 1.`);
  }

  if (isNaN(opts.delayMs) || opts.delayMs < 0) {
    throw new Error(`Invalid delay-ms: "${opts.delayMs}". Must be a non-negative number.`);
  }

  const mode = opts.mode as ExecutionMode;
  if (!['frontend', 'backend', 'both'].includes(mode)) {
    throw new Error(`Invalid mode: "${opts.mode}". Must be "frontend", "backend", or "both".`);
  }

  return {
    frontendUrl: opts.frontendUrl,
    backendUrl: opts.backendUrl,
    simpleCollectorUrl: opts.simpleCollectorUrl,
    opensnowcatUrl: opts.opensnowcatUrl,
    iterations: opts.iterations,
    concurrency: opts.concurrency,
    delayMs: opts.delayMs,
    mode,
    headless: opts.headless,
  };
}

export async function runCli(
  argv: string[] = process.argv,
  customRunner?: Runner
): Promise<MetricsSummary> {
  const options = parseOptions(argv);
  const runner = customRunner ?? new Runner(options);
  return await runner.start();
}

const isMain = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
);

if (isMain) {
  runCli(process.argv)
    .then((summary) => {
      if (summary.failed > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      if (err && typeof err === 'object' && 'code' in err) {
        if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
          process.exit(typeof err.exitCode === 'number' ? err.exitCode : 0);
        }
      }
      console.error(err);
      process.exit(1);
    });
}
