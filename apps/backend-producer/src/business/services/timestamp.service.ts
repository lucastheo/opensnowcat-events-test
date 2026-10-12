import { TimeLocation, isValidTimezone } from '@/business/domain/timestamp-info';
import { InvalidTimezoneError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export interface TimestampParams {
  timezone?: string;
}

export class TimestampService {
  async getTimestamp({ timezone }: TimestampParams = {}): Promise<TimeLocation> {
    const tz = timezone ?? 'UTC';

    if (!isValidTimezone(tz)) {
      throw new InvalidTimezoneError(tz);
    }

    const now = new Date();
    const timestamp = now.toISOString();

    const pad = (n: number) => String(n).padStart(2, '0');
    const formattedLocal = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}, ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    await dispatchDualEmission({
      category: 'backend_service',
      action: 'timestamp',
      label: tz,
      property: formattedLocal,
      eventType: 'backend_api'
    });

    return new TimeLocation(timestamp, formattedLocal, tz);
  }
}

export const timestampService = new TimestampService();
