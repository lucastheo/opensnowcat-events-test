export interface LatencyMetrics {
  min: number;
  max: number;
  avg: number;
  p95: number;
}

export interface MetricsSummary {
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  latencies: LatencyMetrics;
  errors: string[];
}

export class MetricsTracker {
  private completed: number = 0;
  private failed: number = 0;
  private latencies: number[] = [];
  private errors: string[] = [];

  recordIteration(durationMs: number, success: boolean, error?: string): void {
    if (success) {
      this.completed++;
    } else {
      this.failed++;
      if (error) {
        this.errors.push(error);
      }
    }
    this.latencies.push(durationMs);
  }

  getSummary(): MetricsSummary {
    const total = this.completed + this.failed;
    const successRate = total > 0 ? (this.completed / total) * 100 : 0;
    const latencies = this.calculateLatencies();

    return {
      total,
      completed: this.completed,
      failed: this.failed,
      successRate: Math.round(successRate * 100) / 100,
      latencies,
      errors: [...this.errors],
    };
  }

  private calculateLatencies(): LatencyMetrics {
    if (this.latencies.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0 };
    }

    const min = Math.min(...this.latencies);
    const max = Math.max(...this.latencies);
    const sum = this.latencies.reduce((acc, val) => acc + val, 0);
    const avg = Math.round((sum / this.latencies.length) * 100) / 100;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.min(
      Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
      sorted.length - 1
    );
    const p95 = sorted[p95Index];

    return { min, max, avg, p95 };
  }

  formatSummary(): string {
    const summary = this.getSummary();
    const lines = [
      '========================================',
      '         TEST EXECUTION SUMMARY         ',
      '========================================',
      `Total Iterations:     ${summary.total}`,
      `Completed (Success):  ${summary.completed}`,
      `Failed:               ${summary.failed}`,
      `Success Rate:         ${summary.successRate.toFixed(1)}%`,
      '----------------------------------------',
      'Latencies (ms):',
      `  Min:                ${summary.latencies.min.toFixed(2)} ms`,
      `  Max:                ${summary.latencies.max.toFixed(2)} ms`,
      `  Avg:                ${summary.latencies.avg.toFixed(2)} ms`,
      `  P95:                ${summary.latencies.p95.toFixed(2)} ms`,
      '========================================',
    ];

    if (summary.errors.length > 0) {
      lines.push('Errors:');
      const sampleErrors = summary.errors.slice(0, 10);
      sampleErrors.forEach((err, i) => lines.push(`  ${i + 1}. ${err}`));
      if (summary.errors.length > 10) {
        lines.push(`  ... and ${summary.errors.length - 10} more error(s)`);
      }
      lines.push('========================================');
    }

    return lines.join('\n');
  }

  reset(): void {
    this.completed = 0;
    this.failed = 0;
    this.latencies = [];
    this.errors = [];
  }
}
