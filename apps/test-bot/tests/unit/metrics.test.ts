import { describe, it, expect } from 'vitest';
import { MetricsTracker } from '../../src/utils/metrics.js';

describe('MetricsTracker', () => {
  it('should initialize with empty metrics', () => {
    const tracker = new MetricsTracker();
    const summary = tracker.getSummary();

    expect(summary.total).toBe(0);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.latencies).toEqual({ min: 0, max: 0, avg: 0, p95: 0 });
    expect(summary.errors).toEqual([]);
  });

  it('should record successful iterations', () => {
    const tracker = new MetricsTracker();
    tracker.recordIteration(100, true);
    tracker.recordIteration(200, true);

    const summary = tracker.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.successRate).toBe(100);
    expect(summary.latencies.min).toBe(100);
    expect(summary.latencies.max).toBe(200);
    expect(summary.latencies.avg).toBe(150);
    expect(summary.latencies.p95).toBe(200);
  });

  it('should record failed iterations and track errors', () => {
    const tracker = new MetricsTracker();
    tracker.recordIteration(50, false, 'Connection refused');
    tracker.recordIteration(150, true);

    const summary = tracker.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.successRate).toBe(50);
    expect(summary.errors).toEqual(['Connection refused']);
  });

  it('should calculate correct p95 percentile across a larger distribution', () => {
    const tracker = new MetricsTracker();
    // Record latencies 1 through 100
    for (let i = 1; i <= 100; i++) {
      tracker.recordIteration(i, true);
    }

    const summary = tracker.getSummary();
    expect(summary.total).toBe(100);
    expect(summary.latencies.min).toBe(1);
    expect(summary.latencies.max).toBe(100);
    expect(summary.latencies.avg).toBe(50.5);
    // 95th element in 1-100 sorted array is 95
    expect(summary.latencies.p95).toBe(95);
  });

  it('should format summary string cleanly', () => {
    const tracker = new MetricsTracker();
    tracker.recordIteration(25.5, true);
    tracker.recordIteration(50.2, false, 'Timeout error');

    const formatted = tracker.formatSummary();
    expect(formatted).toContain('TEST EXECUTION SUMMARY');
    expect(formatted).toContain('Total Iterations:     2');
    expect(formatted).toContain('Completed (Success):  1');
    expect(formatted).toContain('Failed:               1');
    expect(formatted).toContain('Success Rate:         50.0%');
    expect(formatted).toContain('Min:                25.50 ms');
    expect(formatted).toContain('Max:                50.20 ms');
    expect(formatted).toContain('Errors:');
    expect(formatted).toContain('1. Timeout error');
  });

  it('should reset all tracked state via reset()', () => {
    const tracker = new MetricsTracker();
    tracker.recordIteration(100, true);
    tracker.recordIteration(50, false, 'Error');

    tracker.reset();
    const summary = tracker.getSummary();
    expect(summary.total).toBe(0);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.latencies).toEqual({ min: 0, max: 0, avg: 0, p95: 0 });
    expect(summary.errors).toEqual([]);
  });
});
