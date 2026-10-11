import {
  newTracker,
  buildStructEvent,
  type Tracker
} from '@snowplow/node-tracker';

export interface StructuredEventParams {
  category: string;
  action: string;
  label?: string;
  property?: string;
  value?: number;
  eventId?: string;
  timestamp?: string;
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
  public tracker: Tracker;
  private collectorUrl: string;
  private timeoutMs: number;

  constructor(collectorUrl?: string, timeoutMs: number = 5000) {
    this.collectorUrl = (
      collectorUrl ||
      process.env.OPENSNOWCAT_COLLECTOR_URL ||
      'http://localhost:8080'
    ).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;

    let endpoint = 'localhost';
    let port: number | undefined = 8080;
    let protocol: 'http' | 'https' = 'http';

    try {
      const normalizedUrl =
        this.collectorUrl.startsWith('http://') || this.collectorUrl.startsWith('https://')
          ? this.collectorUrl
          : `http://${this.collectorUrl}`;
      const parsed = new URL(normalizedUrl);
      endpoint = parsed.hostname;
      port = parsed.port ? Number(parsed.port) : undefined;
      protocol = parsed.protocol
        ? (parsed.protocol.replace(':', '') as 'http' | 'https')
        : 'http';
    } catch {
      endpoint = 'localhost';
      port = 8080;
      protocol = 'http';
    }

    this.tracker = newTracker(
      { namespace: 'backend', appId: 'backend-producer' },
      {
        endpoint,
        port,
        protocol,
        bufferSize: 1,
        connectionTimeout: this.timeoutMs
      }
    );
  }

  get endpoint(): string {
    return `${this.collectorUrl}/com.snowplowanalytics.snowplow/tp2`;
  }

  buildPayload(params: StructuredEventParams): SnowplowPayloadEnvelope {
    const parsedDtm = params.timestamp ? Date.parse(params.timestamp) : NaN;
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
          eid: params.eventId ?? crypto.randomUUID(),
          dtm,
          tv: 'backend-producer-1.0.0',
          p: 'srv'
        }
      ]
    };
  }

  emitStructuredEvent(
    params: StructuredEventParams
  ): Promise<{ eventId: string; timestamp: string } | null>;
  emitStructuredEvent(
    params: any
  ): Promise<any>;
  async emitStructuredEvent(
    params: StructuredEventParams
  ): Promise<{ eventId: string; timestamp: string } | null | any> {
    try {
      const pb = buildStructEvent({
        category: params.category,
        action: params.action,
        label: params.label,
        property: params.property,
        value: params.value
      });

      const payload = this.tracker.track(pb);

      try {
        await this.tracker.flush();
      } catch (flushError) {
        console.error(
          '[OpenSnowcatClient] Failed to flush tracker emitter:',
          flushError
        );
      }

      if (!payload || !payload.eid) {
        console.warn('[OpenSnowcatClient] Tracker did not return payload with eid');
        return null;
      }

      const eventId = String(payload.eid);
      const timestamp = new Date(Number(payload.dtm) || Date.now()).toISOString();

      return { eventId, timestamp };
    } catch (error) {
      console.error(
        '[OpenSnowcatClient] Error emitting structured event to OpenSnowcat:',
        error
      );
      return null;
    }
  }

  // Alias for emitStructuredEvent to support trackEvent references if used
  async trackEvent(
    params: StructuredEventParams
  ): Promise<{ eventId: string; timestamp: string } | null> {
    return this.emitStructuredEvent(params);
  }
}

export const openSnowcatClient = new OpenSnowcatClient();
