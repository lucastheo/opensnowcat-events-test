export interface SimpleCollectorRecord {
  event_id: string;
  timestamp: string;
  source: 'backend' | 'frontend';
  event_type: string;
}

export class SimpleCollectorClient {
  private collectorUrl: string;
  private timeoutMs: number;

  constructor(collectorUrl?: string, timeoutMs: number = 5000) {
    this.collectorUrl = (
      collectorUrl ||
      process.env.SIMPLE_COLLECTOR_URL ||
      'http://localhost:5000'
    ).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  get endpoint(): string {
    return `${this.collectorUrl}/collect`;
  }

  async record(payload: SimpleCollectorRecord): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        console.error(
          `[SimpleCollectorClient] Failed to record event. Status: ${response.status} ${response.statusText}`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        '[SimpleCollectorClient] Error recording event to Simple Collector:',
        error
      );
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const simpleCollectorClient = new SimpleCollectorClient();
