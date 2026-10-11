export interface StructuredEventParams {
  category: string;
  action: string;
  label?: string;
  property?: string;
  value?: number;
  eventId: string;
  timestamp: string;
}

export interface SnowplowPayloadEnvelope {
  schema: string;
  data: Array<{
    e: string;
    se_ca: string;
    se_ac: string;
    se_la?: string;
    se_pr?: string;
    se_va?: string;
    eid: string;
    dtm: string;
    tv: string;
    p: string;
  }>;
}

export class OpenSnowcatClient {
  private collectorUrl: string;
  private timeoutMs: number;

  constructor(collectorUrl?: string, timeoutMs: number = 5000) {
    this.collectorUrl = (
      collectorUrl ||
      process.env.OPENSNOWCAT_COLLECTOR_URL ||
      'http://localhost:8080'
    ).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  get endpoint(): string {
    return `${this.collectorUrl}/com.snowplowanalytics.snowplow/tp2`;
  }

  buildPayload(params: StructuredEventParams): SnowplowPayloadEnvelope {
    const parsedDtm = Date.parse(params.timestamp);
    const dtm = String(!isNaN(parsedDtm) ? parsedDtm : Date.now());

    return {
      schema: 'iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4',
      data: [
        {
          e: 'se',
          se_ca: params.category,
          se_ac: params.action,
          se_la: params.label,
          se_pr: params.property,
          se_va: params.value !== undefined ? String(params.value) : undefined,
          eid: params.eventId,
          dtm,
          tv: 'backend-producer-1.0.0',
          p: 'srv'
        }
      ]
    };
  }

  async emitStructuredEvent(params: StructuredEventParams): Promise<boolean> {
    const payload = this.buildPayload(params);
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
          `[OpenSnowcatClient] Failed to emit event. Status: ${response.status} ${response.statusText}`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        '[OpenSnowcatClient] Error emitting structured event to OpenSnowcat:',
        error
      );
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  // Alias for emitStructuredEvent to support trackEvent references if used
  async trackEvent(params: StructuredEventParams): Promise<boolean> {
    return this.emitStructuredEvent(params);
  }
}

export const openSnowcatClient = new OpenSnowcatClient();
