import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCli, parseOptions, runCli } from '../../src/index.js';
import type { Runner } from '../../src/runner.js';
import type { MetricsSummary } from '../../src/utils/metrics.js';

describe('CLI (index.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  describe('createCli', () => {
    it('should create commander program with name opensnowcat-bot', () => {
      const program = createCli();
      expect(program.name()).toBe('opensnowcat-bot');
    });

    it('should have all specified options', () => {
      const program = createCli();
      const optionNames = program.options.map((opt) => opt.attributeName());

      expect(optionNames).toContain('frontendUrl');
      expect(optionNames).toContain('backendUrl');
      expect(optionNames).toContain('simpleCollectorUrl');
      expect(optionNames).toContain('opensnowcatUrl');
      expect(optionNames).toContain('iterations');
      expect(optionNames).toContain('concurrency');
      expect(optionNames).toContain('delayMs');
      expect(optionNames).toContain('closeDelayMs');
      expect(optionNames).toContain('mode');
      expect(optionNames).toContain('headless');
    });
  });

  describe('parseOptions', () => {
    it('should parse default options when no arguments provided', () => {
      delete process.env.FRONTEND_URL;
      delete process.env.BACKEND_URL;
      delete process.env.SIMPLE_COLLECTOR_URL;
      delete process.env.OPENSNOWCAT_URL;
      delete process.env.ITERATIONS;
      delete process.env.CONCURRENCY;
      delete process.env.DELAY_MS;
      delete process.env.CLOSE_DELAY_MS;
      delete process.env.MODE;
      delete process.env.HEADLESS;

      const opts = parseOptions([]);

      expect(opts.targetUrls.frontendUrl).toBe('http://localhost:3000');
      expect(opts.targetUrls.backendUrl).toBe('http://localhost:4000');
      expect(opts.targetUrls.simpleCollectorUrl).toBe('http://localhost:5000');
      expect(opts.targetUrls.opensnowcatUrl).toBe('http://localhost:8080');
      expect(opts.iterations).toBe(100);
      expect(opts.concurrency).toBe(1);
      expect(opts.delayMs).toBe(50);
      expect(opts.closeDelayMs).toBe(0);
      expect(opts.mode).toBe('both');
      expect(opts.headless).toBe(true);
    });

    it('should default headless to true regardless of NODE_ENV', () => {
      delete process.env.MODE;
      delete process.env.HEADLESS;
      process.env.NODE_ENV = 'development';

      const opts = parseOptions([]);

      expect(opts.headless).toBe(true);
    });

    it('should respect environment variables as defaults', () => {
      process.env.FRONTEND_URL = 'http://env-fe:3000';
      process.env.BACKEND_URL = 'http://env-be:4000';
      process.env.SIMPLE_COLLECTOR_URL = 'http://env-sc:5000';
      process.env.OPENSNOWCAT_URL = 'http://env-osc:8080';
      process.env.ITERATIONS = '250';
      process.env.CONCURRENCY = '5';
      process.env.DELAY_MS = '20';
      process.env.CLOSE_DELAY_MS = '2000';
      process.env.MODE = 'frontend';
      process.env.HEADLESS = 'false';

      const opts = parseOptions([]);

      expect(opts.targetUrls.frontendUrl).toBe('http://env-fe:3000');
      expect(opts.targetUrls.backendUrl).toBe('http://env-be:4000');
      expect(opts.targetUrls.simpleCollectorUrl).toBe('http://env-sc:5000');
      expect(opts.targetUrls.opensnowcatUrl).toBe('http://env-osc:8080');
      expect(opts.iterations).toBe(250);
      expect(opts.concurrency).toBe(5);
      expect(opts.delayMs).toBe(20);
      expect(opts.closeDelayMs).toBe(2000);
      expect(opts.mode).toBe('frontend');
      expect(opts.headless).toBe(false);
    });

    it('should parse custom CLI options overriding defaults', () => {
      const opts = parseOptions([
        '--frontend-url',
        'http://custom-fe:3000',
        '--backend-url',
        'http://custom-be:4000',
        '--simple-collector-url',
        'http://custom-sc:5000',
        '--opensnowcat-url',
        'http://custom-osc:8080',
        '--iterations',
        '50',
        '--concurrency',
        '4',
        '--delay-ms',
        '10',
        '--close-delay-ms',
        '500',
        '--mode',
        'backend',
        '--headless',
        'false',
      ]);

      expect(opts.targetUrls.frontendUrl).toBe('http://custom-fe:3000');
      expect(opts.targetUrls.backendUrl).toBe('http://custom-be:4000');
      expect(opts.targetUrls.simpleCollectorUrl).toBe('http://custom-sc:5000');
      expect(opts.targetUrls.opensnowcatUrl).toBe('http://custom-osc:8080');
      expect(opts.iterations).toBe(50);
      expect(opts.concurrency).toBe(4);
      expect(opts.delayMs).toBe(10);
      expect(opts.closeDelayMs).toBe(500);
      expect(opts.mode).toBe('backend');
      expect(opts.headless).toBe(false);
    });

    it('should reject invalid mode', () => {
      expect(() => parseOptions(['--mode', 'invalid-mode'])).toThrow(
        /Invalid mode: "invalid-mode"/
      );
    });

    it('should reject invalid iterations', () => {
      expect(() => parseOptions(['--iterations', '-5'])).toThrow(
        /Invalid iterations/
      );
      expect(() => parseOptions(['--iterations', 'not-a-number'])).toThrow(
        /Invalid iterations/
      );
    });

    it('should reject invalid concurrency', () => {
      expect(() => parseOptions(['--concurrency', '0'])).toThrow(
        /Invalid concurrency/
      );
      expect(() => parseOptions(['--concurrency', '-1'])).toThrow(
        /Invalid concurrency/
      );
    });

    it('should reject invalid delay-ms', () => {
      expect(() => parseOptions(['--delay-ms', '-10'])).toThrow(
        /Invalid delay-ms/
      );
    });

    it('should reject invalid close-delay-ms', () => {
      expect(() => parseOptions(['--close-delay-ms', '-10'])).toThrow(
        /Invalid close-delay-ms/
      );
      expect(() => parseOptions(['--close-delay-ms', 'abc'])).toThrow(
        /Invalid close-delay-ms/
      );
    });
  });

  describe('runCli', () => {
    it('should instantiate runner with parsed options and call start()', async () => {
      const expectedSummary: MetricsSummary = {
        total: 10,
        completed: 10,
        failed: 0,
        successRate: 100,
        latencies: { min: 1, max: 10, avg: 5, p95: 9 },
        errors: [],
      };

      const mockRunner = {
        start: vi.fn().mockResolvedValue(expectedSummary),
      } as unknown as Runner;

      const summary = await runCli(['--iterations', '10', '--mode', 'backend'], mockRunner);

      expect(summary).toBe(expectedSummary);
      expect(mockRunner.start).toHaveBeenCalledTimes(1);
    });
  });
});
